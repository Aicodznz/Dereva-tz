import { 
  resolvePlace, 
  splitTwoLocations, 
  getRoadDistanceAndDuration, 
  Place 
} from './geocoder.js';

export interface SMSSession {
  phone: string;
  step: string;
  selectedService?: string;
  busRoute?: string;
  selectedOperatorId?: string;
  selectedOperatorName?: string;
  selectedSeat?: string;
  taxiRoute?: string;
  selectedDriverName?: string;
  selectedDriverPrice?: number;
  selectedSalonCategory?: string;
  selectedSalonId?: string;
  selectedSalonName?: string;
  selectedProductId?: string;
  selectedProductName?: string;
  selectedProductPrice?: number;
  foodCart?: { name: string; price: number; qty: number; productId?: string }[];
  selectedVendorName?: string;
  selectedVendorCategory?: string;
  selectedSubCategory?: string;
  deliveryLocation?: string;
  deliveryFee?: number;
  paymentMethod?: string;
  optionsList?: any[]; // To track numeric selection maps (e.g. 1 to operator id)
  lastUpdated: number;
  resolvedPickup?: Place;
  resolvedDest?: Place;
  tempRawDestination?: string;
  passengerName?: string;
  passengerPhone?: string;
  // Driver USSD Offline fields
  driverPhone?: string;
  driverId?: string;
  activeRideId?: string;
  // Tracking fields
  trackingCode?: string;
  // PapoSend parcel fields
  parcelPickup?: string;
  parcelDest?: string;
  parcelDesc?: string;
  parcelReceiverPhone?: string;
  parcelPrice?: number;
  // Wallet, Points, Language & Promo fields
  language?: 'sw' | 'en';
  walletBalance?: number;
  topupNetwork?: string;
  papoPoints?: number;
  appliedPromoCode?: string;
  promoDiscount?: number;
  reorderItem?: any;
  // Saved locations, split fare, and voice callback
  savedLocations?: { home?: string; work?: string; custom?: string };
  splitFarePhone?: string;
  splitFareAmount?: number;
  // Driver verification & registration
  isDriverVerified?: boolean;
  driverName?: string;
  driverRegName?: string;
  driverRegPhone?: string;
  driverRegVehicle?: string;
  driverRegBrand?: string;
  driverRegColor?: string;
  driverRegPlate?: string;
  driverRegYear?: string;
  driverRegLicense?: string;
  driverRegLicenseExp?: string;
  driverRegLatra?: string;
  driverRegLatraExp?: string;
  driverRegNida?: string;
  driverRegAvailability?: string;
}

// In-memory fallback sessions state
const inMemorySessions = new Map<string, SMSSession>();

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

export async function getSortedVendorsForCategory(
  dbAdmin: any,
  categories: string[],
  fallbackVendors: Array<{ id: string; name: string; defaultDist: number; lat?: number; lng?: number }>,
  session: SMSSession
) {
  let userLat = session.resolvedPickup?.latitude ?? -6.7924;
  let userLng = session.resolvedPickup?.longitude ?? 39.2083;

  const rawDocs: Array<{ id: string; data: any }> = [];
  if (dbAdmin) {
    try {
      const snap = await dbAdmin.collection('vendors').where('category', 'in', categories).get();
      snap.forEach((doc: any) => {
        rawDocs.push({ id: doc.id, data: doc.data() });
      });
    } catch (e) {
      console.warn("Error fetching vendors for categories:", categories, e);
    }
  }

  const seenNames = new Set<string>();
  const processed: Array<{ id: string; name: string; distance: string; distanceNum: number }> = [];

  rawDocs.forEach(({ id, data }, idx) => {
    const rawName = (data.businessName || data.name || 'Vendor').trim();
    if (!rawName) return;
    const normName = rawName.toLowerCase();
    if (seenNames.has(normName)) return; // Deduplicate vendor names
    seenNames.add(normName);

    let distKm: number;
    const vLat = data.location?.lat ?? data.lat ?? data.coordinates?.lat;
    const vLng = data.location?.lng ?? data.lng ?? data.coordinates?.lng;

    if (typeof vLat === 'number' && typeof vLng === 'number' && !isNaN(vLat) && !isNaN(vLng) && vLat !== 0 && vLng !== 0) {
      distKm = calculateDistanceKm(userLat, userLng, vLat, vLng);
    } else {
      // Distinct, realistic distance based on vendor index & name so they don't all show the same value
      distKm = 0.4 + (idx * 0.5) + ((rawName.length % 5) * 0.1);
    }

    const distanceNum = Math.round(distKm * 10) / 10;
    const distanceStr = distanceNum < 0.1 ? '0.2 km' : `${distanceNum.toFixed(1)} km`;

    processed.push({
      id,
      name: rawName,
      distance: distanceStr,
      distanceNum
    });
  });

  // If no Firestore vendors found, use fallback list
  if (processed.length === 0) {
    fallbackVendors.forEach((fb) => {
      const normName = fb.name.trim().toLowerCase();
      if (!seenNames.has(normName)) {
        seenNames.add(normName);
        let distKm = fb.defaultDist;
        if (fb.lat && fb.lng) {
          distKm = calculateDistanceKm(userLat, userLng, fb.lat, fb.lng);
        }
        const distanceNum = Math.round(distKm * 10) / 10;
        processed.push({
          id: fb.id,
          name: fb.name,
          distance: `${distanceNum.toFixed(1)} km`,
          distanceNum
        });
      }
    });
  }

  // Sort ascending by distance (closest first)
  processed.sort((a, b) => a.distanceNum - b.distanceNum);

  return processed;
}

// Simple in-memory global config for Twilio Responder (can be updated by vendors)
export interface TwilioConfig {
  isEnabled: boolean;
  welcomeMessage: string;
  phoneNumber: string; 
  vendorRules: Record<string, { welcome: string; services: string[] }>;
}

export const defaultTwilioConfig: TwilioConfig = {
  isEnabled: true,
  welcomeMessage: "Karibu Papo Hapo! \n\nChagua huduma:\n1. PapoRide (Taxi)\n2. PapoSend (Mzigo)\n3. PapoDriver (Dereva)\n4. PapoBus (Tiketi)\n5. PapoStyle (Saluni)\n6. PapoFood (Chakula)\n7. Hali ya Agizo\n8. PapoWallet & Points\n9. Lugha / Language",
  phoneNumber: "+14155238886", // Default twilio sandbox or custom
  vendorRules: {
    "all-stores": {
      welcome: "Karibu kwenye duka zetu zote!",
      services: ["Dawa", "Chakula", "Mboga", "Matunda"]
    }
  }
};

export async function getBusinessConfig(dbAdmin: any): Promise<any> {
  if (!dbAdmin) return null;
  try {
    const snap = await dbAdmin.collection('config').doc('business').get();
    if (snap.exists) {
      return snap.data();
    }
  } catch (e) {
    console.warn("[SMS Bot] Error fetching business config:", e);
  }
  return null;
}

export interface USSDServiceDef {
  id: string;
  key: string;
  emoji: string;
  titleSw: string;
  titleEn: string;
  isMaintenance: boolean;
  maintenanceMessage?: string;
}

export function getAvailableServices(session: SMSSession, businessConfig?: any): USSDServiceDef[] {
  const isEn = session.language === 'en';
  const servicesConfig = businessConfig?.services || {};

  const masterList: {
    id: string;
    key: string;
    emoji: string;
    titleSw: string;
    titleEn: string;
    defaultMaintSw: string;
    defaultMaintEn: string;
    enabledByDefault?: boolean;
    alwaysVisible?: boolean;
  }[] = [
    {
      id: 'teksi',
      key: 'paporide',
      emoji: '',
      titleSw: 'PapoRide (Taxi)',
      titleEn: 'PapoRide (Taxi)',
      defaultMaintSw: 'Huduma ya Teksi ipo kwenye matengenezo mafupi.',
      defaultMaintEn: 'Taxi service is under brief maintenance.'
    },
    {
      id: 'vifurushi',
      key: 'paposend',
      emoji: '',
      titleSw: 'PapoSend (Mzigo)',
      titleEn: 'PapoSend (Parcel)',
      defaultMaintSw: 'Huduma ya Mzigo ipo kwenye matengenezo.',
      defaultMaintEn: 'Parcel service is under maintenance.'
    },
    {
      id: 'chakula',
      key: 'papofood',
      emoji: '',
      titleSw: 'PapoFood (Chakula)',
      titleEn: 'PapoFood (Food)',
      defaultMaintSw: 'Huduma ya Chakula inafanyiwa marekebisho.',
      defaultMaintEn: 'Food service is under maintenance.'
    },
    {
      id: 'sokoni',
      key: 'papomart',
      emoji: '',
      titleSw: 'PapoMart (Sokoni)',
      titleEn: 'PapoMart (Groceries)',
      defaultMaintSw: 'Huduma ya Sokoni inafanyiwa marekebisho.',
      defaultMaintEn: 'Groceries service is under maintenance.',
      enabledByDefault: false
    },
    {
      id: 'bus_ticket',
      key: 'papobus',
      emoji: '',
      titleSw: 'PapoBus (Tiketi)',
      titleEn: 'PapoBus (Tickets)',
      defaultMaintSw: 'Kukata tiketi kuko kwenye maboresho.',
      defaultMaintEn: 'Bus ticketing is under maintenance.',
      enabledByDefault: false
    },
    {
      id: 'saluni',
      key: 'papostyle',
      emoji: '',
      titleSw: 'PapoStyle (Saluni)',
      titleEn: 'PapoStyle (Beauty)',
      defaultMaintSw: 'Huduma za Saluni ziko kwenye maboresho.',
      defaultMaintEn: 'Beauty service is under maintenance.',
      enabledByDefault: false
    },
    {
      id: 'fundi',
      key: 'papofix',
      emoji: '',
      titleSw: 'PapoFix (Mafundi)',
      titleEn: 'PapoFix (Handyman)',
      defaultMaintSw: 'Huduma za Mafundi zipo kwenye maboresho.',
      defaultMaintEn: 'Handyman service is under maintenance.',
      enabledByDefault: false
    },
    {
      id: 'hoteli',
      key: 'papostay',
      emoji: '',
      titleSw: 'PapoStay (Hoteli)',
      titleEn: 'PapoStay (Hotels)',
      defaultMaintSw: 'Huduma ya Hoteli ipo kwenye maboresho.',
      defaultMaintEn: 'Hotel service is under maintenance.',
      enabledByDefault: false
    },
    {
      id: 'car_rental',
      key: 'paporent',
      emoji: '',
      titleSw: 'PapoRent (Kukodi)',
      titleEn: 'PapoRent (Rentals)',
      defaultMaintSw: 'Kukodi magari kupo kwenye marekebisho.',
      defaultMaintEn: 'Rental service is under maintenance.',
      enabledByDefault: false
    },
    {
      id: 'driver',
      key: 'papodriver',
      emoji: '',
      titleSw: 'PapoDriver (Dereva)',
      titleEn: 'PapoDriver (Driver)',
      defaultMaintSw: 'Portal ya dereva ipo kwenye matengenezo.',
      defaultMaintEn: 'Driver portal is under maintenance.',
      alwaysVisible: true
    },
    {
      id: 'status',
      key: 'status',
      emoji: '',
      titleSw: 'Hali ya Agizo',
      titleEn: 'Order Status',
      defaultMaintSw: '',
      defaultMaintEn: '',
      alwaysVisible: true
    },
    {
      id: 'wallet',
      key: 'wallet',
      emoji: '',
      titleSw: 'PapoWallet & Points',
      titleEn: 'PapoWallet & Points',
      defaultMaintSw: '',
      defaultMaintEn: '',
      alwaysVisible: true
    },
    {
      id: 'language',
      key: 'language',
      emoji: '',
      titleSw: 'Lugha / Language',
      titleEn: 'Language / Lugha',
      defaultMaintSw: '',
      defaultMaintEn: '',
      alwaysVisible: true
    }
  ];

  const available: USSDServiceDef[] = [];

  for (const item of masterList) {
    const adminConfig = servicesConfig[item.id];
    // Filter out if Admin disabled or if item is disabledByDefault and not explicitly enabled
    if (!item.alwaysVisible) {
      if (adminConfig && adminConfig.enabled === false) {
        continue;
      }
      if (item.enabledByDefault === false && (!adminConfig || adminConfig.enabled !== true)) {
        continue; // Skip service that hasn't been added/enabled yet
      }
    }

    const isMaint = adminConfig?.maintenance === true;
    const maintMessage = adminConfig?.message || (isEn ? item.defaultMaintEn : item.defaultMaintSw);

    available.push({
      id: item.id,
      key: item.key,
      emoji: item.emoji,
      titleSw: item.titleSw,
      titleEn: item.titleEn,
      isMaintenance: isMaint,
      maintenanceMessage: maintMessage
    });
  }

  return available;
}

export function getWelcomeMessage(session: SMSSession, businessConfig?: any): string {
  const isEn = session.language === 'en';

  if (businessConfig?.maintenanceMode) {
    return isEn
      ? " SYSTEM MAINTENANCE:\n\nThe entire system is under maintenance. Please try again later."
      : " MATENGENEZO YA MFUMO:\n\nMfumo mzima upo kwenye matengenezo kwa sasa. Tafadhali jaribu tena baadaye.";
  }

  const available = getAvailableServices(session, businessConfig);

  const header = isEn ? "Welcome to Papo Hapo! \n\nSelect service:" : "Karibu Papo Hapo! \n\nChagua huduma:";
  const itemsText = available.map((s, idx) => {
    const num = idx + 1;
    const title = isEn ? s.titleEn : s.titleSw;
    const maintTag = s.isMaintenance ? (isEn ? " [ Maint]" : " [ Matengenezo]") : "";
    return `${num}. ${s.emoji} ${title}${maintTag}`;
  }).join("\n");

  return `${header}\n${itemsText}`;
}

export function getPapoWalletText(session: SMSSession): string {
  const isEn = session.language === 'en';
  const balance = (session.walletBalance ?? 0).toLocaleString();
  const points = session.papoPoints ?? 0;
  const promo = session.appliedPromoCode ? `\n Promo: ${session.appliedPromoCode}` : '';

  if (isEn) {
    return ` PAPOWALLET & POINTS\n\nBal: TZS ${balance} | PTS: ${points}${promo}\n\n1. Top-Up Wallet\n2. Redeem Points\n3. Promo Code\n4. Split Fare\n5. Pay for Friend\n6. History\n\n0. Main Menu`;
  }

  return ` PAPOWALLET & POINTS\n\nSalio: TZS ${balance} | PTS: ${points}${promo}\n\n1. Weka Salio\n2. Badili Points\n3. Promo Code\n4. Gawana Nauli\n5. Lipia Mwingine\n6. Miamala\n\n0. Rudi Mwanzo`;
}

export function getSavedLocationsText(session: SMSSession): string {
  const isEn = session.language === 'en';
  const home = session.savedLocations?.home;
  const work = session.savedLocations?.work;
  const custom = session.savedLocations?.custom;

  const homeStr = home || (isEn ? '[Not set]' : '[Hajaweka]');
  const workStr = work || (isEn ? '[Not set]' : '[Hajaweka]');
  const customStr = custom || (isEn ? '[Not set]' : '[Hajaweka]');

  if (isEn) {
    return ` SAVED LOCATIONS (MAENEO PENDWA)\n\n1. Home: ${homeStr}\n2. Work: ${workStr}\n3. Custom: ${customStr}\n\nActions:\n4. Edit Home Address\n5. Edit Work Address\n6. Add Custom Location\n\n0. Main Menu`;
  }
  return ` MAENEO PENDWA (Saved Locations)\n\n1. Nyumbani: ${homeStr}\n2. Ofisini: ${workStr}\n3. Eneo Lingine: ${customStr}\n\nHatua:\n4. Hariri Nyumbani\n5. Hariri Ofisini\n6. Weka Eneo Lingine\n\n0. Rudi Mwanzo`;
}

export function getVoiceCallbackText(session: SMSSession): string {
  const isEn = session.language === 'en';
  const phone = session.phone.replace('ussd:', '');

  if (isEn) {
    return ` AUTOMATED USSD VOICE CALLBACK \n\nSystem is dispatching an interactive audio call to ${phone}...\n\n Voice Audio Prompt (Preview):\n"Hello! Your Papo Hapo order PH-88219 (PapoFood, TZS 12,500) is on the way with driver Bakari Juma (0712345678). Press 1 to speak with courier or 2 to confirm delivery."\n\n1. Request Call Again\n0. Main Menu`;
  }
  return ` SIMU YA SAUTI YA MFUMO (Automated IVR Call) \n\nMfumo unapiga simu ya sauti kwenye namba yako ${phone}...\n\n Maelezo ya Ujumbe wa Sauti (Audio Preview):\n"Habari! Agizo yako PH-88219 la PapoFood (TZS 12,500) liko njiani na Dereva Bakari Juma (0712345678). Bofya 1 kuongea na dereva au 2 kuthibitisha umepokea."\n\n1. Piga Tena Simu ya Sauti\n0. Rudi Mwanzo`;
}

export function getQuickReOrderText(session: SMSSession): string {
  const isEn = session.language === 'en';
  if (isEn) {
    return ` QUICK RE-ORDER (AGIZA TENA)\n\nSelect a previous order to re-order instantly:\n\n1. PapoRide: Mwenge  Posta (TZS 4,500)\n2. PapoFood: Papo Pizza - 2x Burger (TZS 12,500)\n3. PapoSend: Parcel to Kariakoo (TZS 3,500)\n4. PapoBus: DAR  MWANZA (TZS 45,000)\n\n0. Main Menu`;
  }
  return ` AGIZA TENA KWA BOFYA MOJA (Quick Re-Order)\n\nChagua agizo lako la zamani kurudia papo hapo:\n\n1. PapoRide: Mwenge  Posta (TZS 4,500)\n2. PapoFood: Papo Pizza - 2x Burger (TZS 12,500)\n3. PapoSend: Kifurushi Kariakoo (TZS 3,500)\n4. PapoBus: DAR  MWANZA (TZS 45,000)\n\n0. Rudi Mwanzo`;
}

export async function getActiveOrderStatusText(session: SMSSession, dbAdmin: any, orderQueryInput?: string): Promise<string> {
  const isEn = session.language === 'en';
  let allMatchingOrders: any[] = [];
  let foundOrder: any = null;

  if (dbAdmin) {
    try {
      const snap = await dbAdmin.collection('orders').get();
      if (!snap.empty) {
        const cleanPhone = session.phone.replace('ussd:', '').replace(/\D/g, '');
        const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

        allMatchingOrders = docs.filter((o: any) => {
          const p = (o.customerPhone || '').replace(/\D/g, '');
          return p.length > 5 && (p.endsWith(cleanPhone.slice(-8)) || cleanPhone.endsWith(p.slice(-8)));
        });

        allMatchingOrders.sort((a: any, b: any) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return tB - tA;
        });
      }
    } catch (err) {
      console.warn("[USSD Order Status] Error querying active order:", err);
    }
  }

  // If no live DB orders or only 1 DB order, enrich with demo active orders for multiple service demonstration
  if (allMatchingOrders.length === 0) {
    allMatchingOrders = [
      {
        bookingId: 'PR-90123',
        serviceType: 'PapoRide',
        serviceIcon: '',
        vendorName: 'PapoRide Taxi (Mwenge  Posta)',
        status: 'in_transit',
        totalAmount: 4500,
        driverName: 'Bakari Juma (0712 345 678 - Boda #34)',
        paymentMethod: 'PapoWallet'
      },
      {
        bookingId: 'PF-88219',
        serviceType: 'PapoFood',
        serviceIcon: '',
        vendorName: 'Papo Pizza & Burger (Kinondoni)',
        status: 'accepted',
        totalAmount: 12500,
        driverName: 'Juma Shariff (0755 889 001 - Boda #12)',
        paymentMethod: 'M-Pesa'
      },
      {
        bookingId: 'PS-44912',
        serviceType: 'PapoSend',
        serviceIcon: '',
        vendorName: 'PapoSend Parcel (Kijitonyama  Kariakoo)',
        status: 'pending',
        totalAmount: 3500,
        driverName: 'Inasubiri kupangiwa dereva',
        paymentMethod: 'PapoWallet'
      }
    ];
  }

  // Check if user requested a specific order by ID or index (1, 2, 3...)
  const trimmedInput = orderQueryInput?.trim().toUpperCase() || '';

  if (trimmedInput && !['7'].includes(trimmedInput)) {
    const idx = parseInt(trimmedInput, 10);
    if (!isNaN(idx) && idx >= 1 && idx <= allMatchingOrders.length) {
      foundOrder = allMatchingOrders[idx - 1];
    } else {
      foundOrder = allMatchingOrders.find((o: any) =>
        (o.id && o.id.toUpperCase().includes(trimmedInput)) ||
        (o.bookingId && o.bookingId.toUpperCase().includes(trimmedInput)) ||
        (o.orderId && o.orderId.toUpperCase().includes(trimmedInput))
      );
    }
  }

  // If user has MULTIPLE orders and hasn't selected a specific one yet:
  if (!foundOrder && allMatchingOrders.length > 1 && (!trimmedInput || trimmedInput === '7' || trimmedInput === '1')) {
    let listText = isEn
      ? ` YOUR ACTIVE ORDERS (${allMatchingOrders.length})\n\n`
      : ` MAAGIZO YAKO YANAYOENDELEA (${allMatchingOrders.length})\n\n`;

    allMatchingOrders.forEach((o, index) => {
      const orderId = o.bookingId || o.orderId || o.id || `ORD-${index + 1}`;
      const service = o.serviceType || o.type || o.vendorName || 'Papo Service';
      const icon = o.serviceIcon || (service.includes('Ride') ? '' : service.includes('Food') ? '' : service.includes('Send') ? '' : '');
      const amt = (o.totalAmount || o.price || 0).toLocaleString();
      const rawStatus = (o.status || 'pending').toLowerCase();
      
      let stText = isEn ? ' Preparing' : ' Inatengenezwa';
      if (['accepted', 'confirmed'].includes(rawStatus)) stText = isEn ? ' Confirmed' : ' Imethibitishwa';
      else if (['in_transit', 'delivering', 'on_the_way'].includes(rawStatus)) stText = isEn ? ' On the way' : ' Njia Inakujia';
      else if (rawStatus === 'completed') stText = isEn ? ' Completed' : ' Imekamilika';

      listText += `${index + 1}. ${icon} ${service}\n   🆔 Msimbo: ${orderId}\n    Status: ${stText}\n    TZS ${amt}\n\n`;
    });

    listText += isEn
      ? `Send 1-${allMatchingOrders.length} to view details, or enter Order ID:\n\n0. Main Menu`
      : `Tuma namba (1-${allMatchingOrders.length}) au Ingiza Msimbo kuangalia:\n\n0. Rudi Mwanzo`;

    return listText;
  }

  // Default to first order if not found
  if (!foundOrder && allMatchingOrders.length > 0) {
    foundOrder = allMatchingOrders[0];
  }

  if (foundOrder) {
    const rawStatus = (foundOrder.status || 'pending').toLowerCase();
    let statusText = isEn ? ' In Progress / Preparing' : ' Inakaguliwa na Inatengenezwa';
    if (['accepted', 'confirmed'].includes(rawStatus)) {
      statusText = isEn ? ' Confirmed by Vendor' : ' Imethibitishwa na Muuzaji';
    } else if (['in_transit', 'delivering', 'on_the_way'].includes(rawStatus)) {
      statusText = isEn ? ' On the way (Driver Assigned)' : ' Inawasilishwa na Boda/Dereva';
    } else if (rawStatus === 'completed') {
      statusText = isEn ? ' Completed' : ' Imekamilika Vizuri';
    } else if (rawStatus === 'cancelled') {
      statusText = isEn ? ' Cancelled' : ' Imeghatishwa';
    }

    const orderId = foundOrder.bookingId || foundOrder.orderId || foundOrder.id || 'PH-88219';
    const amount = (foundOrder.totalAmount || foundOrder.price || 0).toLocaleString();
    const serviceName = foundOrder.vendorName || foundOrder.serviceType || foundOrder.type || 'Papo Hapo Service';
    const driver = foundOrder.driverName || 'Bakari Juma (Boda Papo Hapo - 0712345678)';
    const pay = foundOrder.paymentMethod || 'PapoWallet';

    if (isEn) {
      return ` LIVE ORDER DETAILS\n\n🆔 Order ID: ${orderId}\n Service: ${serviceName}\n Status: ${statusText}\n Total: TZS ${amount}\n Payment: ${pay}\n Driver/Courier: ${driver}\n\n7. Back to All Active Orders\n0. Main Menu`;
    }
    return ` MAELEZO YA AGIZO (Order Details)\n\n🆔 Msimbo: ${orderId}\n Huduma: ${serviceName}\n Status: ${statusText}\n Gharama: TZS ${amount}\n Malipo: ${pay}\n Dereva/Boda: ${driver}\n\n7. Angalia Maagizo Yote Yaliyo Hai\n0. Rudi Mwanzo`;
  }

  if (isEn) {
    return ` NO ACTIVE ORDERS FOUND\n\nYou currently have no active orders under this phone number.\n\nEnter Order ID (e.g. PS-82910, PH-10293) to search:\n\n0. Main Menu`;
  }
  return ` HUNA AGIZO LINALOENDELEA\n\nHujaweka agizo lililo hai kwa sasa kwa namba hii.\n\nIngiza Msimbo wa Agizo (mf. PS-82910, PH-10293) kufuatilia:\n\n0. Rudi Mwanzo`;
}

/**
 * Gets or creates session for a phone number
 */
export async function getSession(phone: string, dbAdmin: any): Promise<SMSSession> {
  // Try to load from firestore first if db is active
  if (dbAdmin) {
    try {
      const docRef = dbAdmin.collection('sms_sessions').doc(phone);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data() as SMSSession;
        if (data.language === undefined) data.language = 'sw';
        if (data.walletBalance === undefined) data.walletBalance = 0;
        if (data.papoPoints === undefined) data.papoPoints = 0;
        if (!data.savedLocations) {
          data.savedLocations = { home: 'Mwenge, Dar es Salaam', work: 'Posta Mpya, Victoria', custom: 'Mlimani City Mall' };
        }
        return data;
      }
    } catch (err) {
      console.warn("[SMS Bot] Failed to load session from Firestore, using memory:", err);
    }
  }

  // Fallback to in-memory
  const existing = inMemorySessions.get(phone);
  if (existing) {
    if (existing.language === undefined) existing.language = 'sw';
    if (existing.walletBalance === undefined) existing.walletBalance = 0;
    if (existing.papoPoints === undefined) existing.papoPoints = 0;
    if (!existing.savedLocations) {
      existing.savedLocations = { home: 'Mwenge, Dar es Salaam', work: 'Posta Mpya, Victoria', custom: 'Mlimani City Mall' };
    }
    return existing;
  }

  const fresh: SMSSession = {
    phone,
    step: 'START',
    language: 'sw',
    walletBalance: 0,
    papoPoints: 0,
    savedLocations: { home: 'Mwenge, Dar es Salaam', work: 'Posta Mpya, Victoria', custom: 'Mlimani City Mall' },
    lastUpdated: Date.now()
  };
  inMemorySessions.set(phone, fresh);
  return fresh;
}

/**
 * Saves session
 */
export async function saveSession(session: SMSSession, dbAdmin: any): Promise<void> {
  session.lastUpdated = Date.now();
  inMemorySessions.set(session.phone, session);

  if (dbAdmin) {
    try {
      await dbAdmin.collection('sms_sessions').doc(session.phone).set(session);
    } catch (err) {
      console.warn("[SMS Bot] Failed to write session to Firestore:", err);
    }
  }
}

/**
 * Creates a simulator or real order in the background so the dashboard sees it!
 */
async function triggerMockOrder(
  dbAdmin: any, 
  vendorId: string, 
  category: string, 
  items: any[], 
  total: number, 
  customerPhone: string,
  customerName: string = "SMS customer",
  notes: string = ""
) {
  if (!dbAdmin) return;
  try {
    const orderData = {
      customerId: "sms-client-" + customerPhone.replace(/\D/g, ''),
      vendorId: vendorId || "papo-hapo-express",
      customerName: customerName,
      customerPhone: customerPhone,
      items: items,
      totalAmount: total,
      subtotal: total,
      status: "pending",
      type: category, // restaurant, bus_ticket, etc.
      orderSource: "online",
      orderType: "booking",
      paymentMethod: "Mobile Money (Tanzania)",
      paymentStatus: "pending",
      notes: notes || "Order created automatically via Twilio SMS Responder Bot",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await dbAdmin.collection('orders').add(orderData);
    console.log(`[SMS Bot] Succeeded in creating automated order in DB for vendor: ${vendorId}`);
  } catch (err) {
    console.error("[SMS Bot] Error triggering mock order:", err);
  }
}

export function stripUSSDFormatting(text: string): string {
  if (!text) return text;
  return text
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{fe00}-\u{fe0f}\u{200d}]/gu, '')
    .split('\n')
    .map(line => line.replace(/(\d+\.) +/g, '$1 ').trimEnd())
    .join('\n');
}

/**
 * Master dispatcher handling the conversation text and state transitions
 */
export async function handleSMSInput(
  fromPhone: string, 
  textBody: string, 
  dbAdmin: any,
  vendorId: string = 'admin-global'
): Promise<string> {
  const result = await handleSMSInputRaw(fromPhone, textBody, dbAdmin, vendorId);
  return stripUSSDFormatting(result);
}

async function handleSMSInputRaw(
  fromPhone: string, 
  textBody: string, 
  dbAdmin: any,
  vendorId: string = 'admin-global'
): Promise<string> {
  const cleanInput = textBody.trim();
  const lowerInput = cleanInput.toLowerCase();
  
  // Get existing flow session
  const session = await getSession(fromPhone, dbAdmin);

  // Fetch business config for service status & maintenance check
  const businessConfig = await getBusinessConfig(dbAdmin);

  // Fetch custom welcome message if available
  let welcomeMessage = defaultTwilioConfig.welcomeMessage;
  if (dbAdmin) {
    try {
      const docRef = dbAdmin.collection('vendors').doc(vendorId).collection('settings').doc('sms_config');
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data();
        if (data.welcomeText) {
          welcomeMessage = data.welcomeText;
        }
      }
    } catch (e) {
      console.warn("[SMS Bot] Failed to load custom welcome message:", e);
    }
  }

  // Force legacy or overly verbose welcome messages to clean, concise USSD menu
  if (
    welcomeMessage.includes("SALUNI (Salons)") ||
    welcomeMessage.includes("Karibu kwenye Mfumo wa") ||
    welcomeMessage.includes("Tafadhali chagua huduma unayotaka") ||
    welcomeMessage.includes("TAXI (Agiza / Nauli)") ||
    welcomeMessage.includes("MZIGO (Kufuatilia)")
  ) {
    welcomeMessage = getWelcomeMessage(session, businessConfig);
  }

  // Restart trigger, Back Navigation & Step Initializer
  const isGreeting = ['hi', 'mambo', 'vip', 'vipi', 'habari', 'hello', 'habari gani', 'anza', 'start', 'menu', 'ya', 'oje', 'hodi', ''].includes(lowerInput);
  const isBackToMain = [
    '0', '00', 'rudi', 'back', 'mwanzo', '0. rudi mwanzo', '0. main menu', 
    '0. rudi', 'kurudi', 'main menu', 'rudi mwanzo', 'menu', 'start', '00. rudi mwanzo'
  ].includes(lowerInput) || lowerInput === '0' || lowerInput === '00';

  if (session.step === 'START' || isGreeting || isBackToMain) {
    session.selectedService = undefined;
    session.busRoute = undefined;
    session.selectedOperatorId = undefined;
    session.selectedOperatorName = undefined;
    session.selectedSeat = undefined;
    session.taxiRoute = undefined;
    session.selectedDriverName = undefined;
    session.selectedDriverPrice = undefined;
    session.selectedSalonCategory = undefined;
    session.selectedSalonName = undefined;
    session.selectedProductId = undefined;
    session.selectedProductName = undefined;
    session.selectedProductPrice = undefined;
    session.foodCart = [];
    session.optionsList = [];

    // If it's a greeting, back command, or empty input, show the welcome menu
    if (isGreeting || isBackToMain || !cleanInput) {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session, businessConfig);
    }

    // If user sent a direct selection (e.g. "1" or "taxi") while step was START, transition step to SELECT_SERVICE
    session.step = 'SELECT_SERVICE';
  }

  // Step 1: Selecting Category Service (Dynamic from Business Config)
  if (session.step === 'SELECT_SERVICE') {
    const available = getAvailableServices(session, businessConfig);

    let selectedDef: USSDServiceDef | undefined = undefined;

    // Check numeric selection
    const numChoice = parseInt(cleanInput, 10);
    if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= available.length) {
      selectedDef = available[numChoice - 1];
    } else {
      // Keyword matching
      selectedDef = available.find(s => {
        if (s.key === 'paporide' && (lowerInput.includes('paporide') || lowerInput.includes('taxi') || lowerInput.includes('teksi'))) return true;
        if (s.key === 'paposend' && (lowerInput.includes('paposend') || lowerInput.includes('mzigo') || lowerInput.includes('kifurushi') || lowerInput.includes('parcel') || lowerInput.includes('track') || lowerInput.includes('send'))) return true;
        if (s.key === 'papofood' && (lowerInput.includes('papofood') || lowerInput.includes('chakula') || lowerInput.includes('food') || lowerInput.includes('restaurant') || lowerInput.includes('mgahawa'))) return true;
        if (s.key === 'papomart' && (lowerInput.includes('papomart') || lowerInput.includes('soko') || lowerInput.includes('sokoni') || lowerInput.includes('mart') || lowerInput.includes('duka') || lowerInput.includes('grocery'))) return true;
        if (s.key === 'papobus' && (lowerInput.includes('papobus') || lowerInput.includes('basi') || lowerInput.includes('mabasi') || lowerInput.includes('bus'))) return true;
        if (s.key === 'papostyle' && (lowerInput.includes('papostyle') || lowerInput.includes('saluni') || lowerInput.includes('salon') || lowerInput.includes('urembo'))) return true;
        if (s.key === 'papostay' && (lowerInput.includes('papostay') || lowerInput.includes('hoteli') || lowerInput.includes('hotel') || lowerInput.includes('malazi') || lowerInput.includes('guest'))) return true;
        if (s.key === 'paporent' && (lowerInput.includes('paporent') || lowerInput.includes('rent') || lowerInput.includes('kukodi') || lowerInput.includes('kodisha'))) return true;
        if (s.key === 'papodriver' && (lowerInput.includes('papodriver') || lowerInput.includes('dereva') || lowerInput.includes('driver'))) return true;
        if (s.key === 'status' && (lowerInput.includes('status') || lowerInput.includes('hali') || lowerInput.includes('agizo') || lowerInput.includes('order'))) return true;
        if (s.key === 'wallet' && (lowerInput.includes('wallet') || lowerInput.includes('salio') || lowerInput.includes('point') || lowerInput.includes('gawana') || lowerInput.includes('split'))) return true;
        if (s.key === 'language' && (lowerInput.includes('lugha') || lowerInput.includes('language') || lowerInput.includes('sw') || lowerInput.includes('en'))) return true;
        return false;
      });
    }

    if (selectedDef) {
      // Check if service is under Maintenance
      if (selectedDef.isMaintenance) {
        return session.language === 'en'
          ? ` SERVICE UNDER MAINTENANCE:\n\n${selectedDef.titleEn} is currently under maintenance.\nNotice: "${selectedDef.maintenanceMessage || 'Please try again later.'}"\n\n0. Main Menu`
          : ` HUDUMA KWENYE MATENGENEZO:\n\nHuduma ya ${selectedDef.titleSw} ipo kwenye matengenezo kwa sasa.\nUjumbe wa Admin: "${selectedDef.maintenanceMessage || 'Tafadhali jaribu tena baadaye.'}"\n\n0. Rudi Mwanzo`;
      }

      // 1. PapoRide
      if (selectedDef.key === 'paporide') {
        session.step = 'TAXI_SUBMENU';
        session.selectedService = 'taxi';
        await saveSession(session, dbAdmin);
        return session.language === 'en'
          ? " PapoRide (TAXI & FARE):\n\n1. Estimate Fare \n2. Saved Locations \n3. Split Fare 50/50 \n4. Custom Route \n\n0. Main Menu"
          : " PapoRide (TAXI & NAULI):\n\n1. Kadiria Nauli \n2. Maeneo Pendwa (Nyumbani/Ofisini) \n3. Gawana Nauli 50/50 \n4. Andika Njia Yako \n\n0. Rudi Mwanzo";
      }
      // 2. PapoSend
      else if (selectedDef.key === 'paposend') {
        session.step = 'PAPOSEND_MAIN_MENU';
        session.selectedService = 'parcel';
        await saveSession(session, dbAdmin);
        return session.language === 'en'
          ? " PapoSend (PARCEL & DELIVERY):\n\n1. Send Parcel / Package\n2. Track Your Package\n\n0. Main Menu"
          : " PapoSend (VIFURUSHI & DELIVERY):\n\n1. Tuma Mzigo / Kifurushi\n2. Fuatilia Mzigo Wako\n\n0. Rudi Mwanzo";
      }
      // 3. PapoFood
      else if (selectedDef.key === 'papofood') {
        session.step = 'FOOD_MAIN_MENU';
        session.selectedService = 'restaurant';
        session.foodCart = [];
        await saveSession(session, dbAdmin);
        return session.language === 'en'
          ? " PapoFood (FOOD & RESTAURANTS):\n\n1. Restaurants & Food\n2. Drinks & Fast Food\n\n0. Main Menu"
          : " PapoFood (CHAKULA & MIGAHAWA):\n\n1. Migahawa & Chakula\n2. Vinywaji & Fast Food\n\n0. Rudi Mwanzo";
      }
      // 4. PapoMart
      else if (selectedDef.key === 'papomart') {
        session.step = 'PAPOMART_MAIN_MENU';
        session.selectedService = 'mart';
        await saveSession(session, dbAdmin);
        return session.language === 'en'
          ? " PapoMart (GROCERIES & SHOPS):\n\n1. Grocery & Market (Sokoni)\n2. Pharmacy & Health (Dawa)\n3. Electronics & Shopping\n\n0. Main Menu"
          : " PapoMart (SOKONI, GROCERY & MADUKA):\n\n1. Grocery & Sokoni\n2. Duka la Dawa & Afya\n3. Maduka & Shopping\n\n0. Rudi Mwanzo";
      }
      // 5. PapoBus
      else if (selectedDef.key === 'papobus') {
        session.step = 'BUS_ROUTE';
        session.selectedService = 'bus_ticket';
        await saveSession(session, dbAdmin);
        return session.language === 'en'
          ? " PapoBus (BUS TICKETS):\n\nSend your travel route (Origin - Destination).\nExample: DAR - MWANZA or ARUSHA - KILIMANJARO:"
          : " PapoBus (TIKETI ZA MABASI):\n\nTuma njia unayokwenda (Mwanzo - Mwisho).\nMfano: DAR - MWANZA au ARUSHA - KILIMANJARO:";
      }
      // 6. PapoStyle
      else if (selectedDef.key === 'papostyle') {
        session.step = 'SALON_SUB';
        session.selectedService = 'salon';
        await saveSession(session, dbAdmin);
        return session.language === 'en'
          ? " PapoStyle (SALON & BEAUTY):\n\n1. Barber / Hair Cut\n2. Hair Styling / Braids\n3. Nails / Makeup / Spa\n\n0. Main Menu"
          : " PapoStyle (SALUNI & UREMBO):\n\n1. Kinyozi / Hair Cut\n2. Kusuka / Salon ya Kike\n3. Nails / Makeup / Spa\n\n0. Rudi Mwanzo";
      }
      // PapoFix (Home Services & Handyman)
      else if (selectedDef.key === 'papofix') {
        session.step = 'HANDYMAN_SUB';
        session.selectedService = 'handyman';
        await saveSession(session, dbAdmin);
        return session.language === 'en'
          ? " PapoFix (HOME SERVICES & HANDYMAN):\n\n1. Electrician (Fundi Umeme)\n2. Plumber (Fundi Bomba)\n3. Carpenter (Fundi Mbao)\n4. Painter (Fundi Rangi)\n5. AC & Refrigerator Fix\n6. Cleaning & Pest Control\n7. Electronics & TV Repair\n\n0. Main Menu"
          : " PapoFix (HOME SERVICES & MAFUNDI):\n\n1. Fundi Umeme (Electrician)\n2. Fundi Bomba (Plumber)\n3. Fundi Mbao / Samani (Carpenter)\n4. Fundi Rangi (Painter)\n5. AC & Friji (Aircon & Fridge)\n6. Usafi na Pest Control\n7. TV na Electronics Repair\n\n0. Rudi Mwanzo";
      }
      // 7. PapoStay / Hoteli
      else if (selectedDef.key === 'papostay') {
        session.step = 'HOTEL_MAIN_MENU';
        session.selectedService = 'hotel';
        await saveSession(session, dbAdmin);
        return session.language === 'en'
          ? " PapoStay (HOTELS & LODGING):\n\n1. Luxury Hotels (4-5 Star)\n2. Budget Guest Houses\n3. Beach Resorts & Lodges\n\n0. Main Menu"
          : " PapoStay (HOTELI & MALAZI):\n\n1. Hoteli za Nyota 3-5\n2. Guest Houses & Vyumba\n3. Resoti & Nyumba za Mapumziko\n\n0. Rudi Mwanzo";
      }
      // 8. PapoRent
      else if (selectedDef.key === 'paporent') {
        session.step = 'PAPORENT_MAIN_MENU';
        session.selectedService = 'rental';
        await saveSession(session, dbAdmin);
        return session.language === 'en'
          ? " PapoRent (CAR & EQUIPMENT RENTAL):\n\n1. Car Rental\n2. Bajaj Rental\n3. Motorcycle Rental\n\n0. Main Menu"
          : " PapoRent (KUKODI MAGARI & VIFAA):\n\n1. Kukodi Gari (Car Rental)\n2. Kukodi Bajaj\n3. Kukodi Bodaboda\n\n0. Rudi Mwanzo";
      }
      // 9. PapoDriver
      else if (selectedDef.key === 'papodriver') {
        session.selectedService = 'driver';
        let cleanPhone = session.phone.replace('ussd:', '').replace(/\D/g, '');
        let isRegisteredDriver = false;
        let driverName = "Juma Kapoya";
        let isOnline = true;

        if (dbAdmin) {
          try {
            const dSnap = await dbAdmin.collection('drivers').get();
            if (!dSnap.empty) {
              const match = dSnap.docs.find((doc: any) => {
                const data = doc.data();
                const p = (data.phone || "").replace(/\D/g, '');
                return p && (p.endsWith(cleanPhone.slice(-8)) || cleanPhone.endsWith(p.slice(-8)));
              });
              if (match) {
                const dData = match.data();
                driverName = dData.name || driverName;
                isOnline = dData.isOnline !== false;
                session.driverId = match.id;
                isRegisteredDriver = true;
              }
            }
          } catch (e) {
            console.warn("[USSD Driver] Error finding driver in Firestore:", e);
          }
        }

        if (isRegisteredDriver || session.isDriverVerified) {
          session.isDriverVerified = true;
          session.step = 'DRIVER_OFFLINE_MENU';
          await saveSession(session, dbAdmin);
          return ` PapoDriver (PORTAL YA DEREVA):\n[Dereva: ${driverName || session.driverName || 'Juma Kapoya'} | Hali: ${isOnline ? ' Online' : ' Offline'}]\n\n1. Badili Hali (Online/Offline)\n2. Maombi ya Safari (Pending Bookings)\n3. Safari Inayoendelea (Active Trip)\n4. Mapato & Salio la Kamisheni\n5. Weka Salio la Kamisheni (STK Push)\n\n0. Rudi Mwanzo`;
        } else {
          session.step = 'DRIVER_LOGIN_PROMPT';
          await saveSession(session, dbAdmin);
          return session.language === 'en'
            ? ` PAPODRIVER - RESTRICTED DRIVER PORTAL\n\nYour number (${cleanPhone}) is not verified as a registered Papo Hapo Driver.\n\n1. Enter Driver PIN (Default: 1234)\n2. Register as New Driver / Bodaboda\n\n0. Main Menu`
            : ` PAPODRIVER - PORTAL YA DEREVA\n\nNamba yako (${cleanPhone}) haijathibitishwa kama Dereva/Bodaboda wa Papo Hapo.\n\n1. Ingiza PIN ya Dereva (Default: 1234)\n2. Sajili kama Dereva / Bodaboda Mpya\n\n0. Rudi Mwanzo`;
        }
      }
      // 10. Status
      else if (selectedDef.key === 'status') {
        session.step = 'ACTIVE_ORDER_STATUS';
        await saveSession(session, dbAdmin);
        return await getActiveOrderStatusText(session, dbAdmin, cleanInput);
      }
      // 11. Wallet
      else if (selectedDef.key === 'wallet') {
        session.step = 'PAPOWALLET_MAIN';
        await saveSession(session, dbAdmin);
        return getPapoWalletText(session);
      }
      // 12. Language
      else if (selectedDef.key === 'language') {
        session.step = 'LANGUAGE_SWITCH_MENU';
        await saveSession(session, dbAdmin);
        return ` CHAGUA LUGHA / SELECT LANGUAGE:\n\n1. 🇹🇿 Kiswahili\n2. 🇬🇧 English\n\n0. Rudi Mwanzo / Back`;
      }
    } else {
      // Direct secondary keyword fallbacks if not matched above
      if (lowerInput.includes('sauti') || lowerInput.includes('voice') || lowerInput.includes('pigiwa') || lowerInput.includes('ivr')) {
        session.step = 'VOICE_CALLBACK_MENU';
        await saveSession(session, dbAdmin);
        return getVoiceCallbackText(session);
      }
      else if (lowerInput.includes('reorder') || lowerInput.includes('tena') || lowerInput.includes('rudia')) {
        session.step = 'QUICK_REORDER_MENU';
        await saveSession(session, dbAdmin);
        return getQuickReOrderText(session);
      }
      else if (lowerInput.includes('papobot') || lowerInput.includes('robot') || lowerInput.includes('roboti')) {
        session.step = 'PAPOBOT_PIN_UNLOCK';
        await saveSession(session, dbAdmin);
        return session.language === 'en'
          ? " PapoBot (AUTONOMOUS DELIVERY ROBOT):\n[Status:  PapoBot Alpha-1 Arrived at Destination]\n\nPlease enter the 4-digit PIN to unlock the cargo compartment lid (Default: 4829):\n\n0. Main Menu"
          : " PapoBot (ROBOTI YA KUWASILISHA MZIGO):\n[Hali:  PapoBot Alpha-1 Imewasili Eneo Lako]\n\nTafadhali ingiza PIN ya tarakimu 4 kufungua mfuniko wa Mzigo (Default: 4829):\n\n0. Rudi Mwanzo";
      }

      return session.language === 'en'
        ? ` Invalid choice! Please send numbers 1 to ${available.length}, or send "HI" to restart.`
        : ` Chaguo si sahihi! Tuma namba 1 mpaka ${available.length}, au tuma "HI" kuanza upya.`;
    }
  }

  // --- MODULE: PAPORIDE (TAXI & NAULI SUBMENU) ---
  if (session.step === 'TAXI_SUBMENU') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session, businessConfig);
    }
    const isEn = session.language === 'en';
    if (cleanInput === '1' || lowerInput.includes('kadirio') || lowerInput.includes('nauli') || lowerInput.includes('estimate')) {
      session.step = 'TAXI_FARE_ESTIMATE_INPUT';
      session.selectedService = 'taxi';
      await saveSession(session, dbAdmin);
      return isEn
        ? " FARE ESTIMATION:\n\nPlease enter your travel route (Origin - Destination).\nExample: POSTA - KINONDONI"
        : " KADIRIO LA NAULI:\n\nTafadhali tuma njia unayotaka kusafiri (Kutoka - Kwenda).\nMfano: POSTA - KINONDONI";
    } else if (cleanInput === '2' || lowerInput.includes('eneo') || lowerInput.includes('maeneo') || lowerInput.includes('saved')) {
      session.step = 'SAVED_LOCATIONS_MENU';
      await saveSession(session, dbAdmin);
      return getSavedLocationsText(session);
    } else if (cleanInput === '3' || lowerInput.includes('gawana') || lowerInput.includes('split')) {
      session.step = 'PAPOWALLET_SPLIT_PHONE';
      await saveSession(session, dbAdmin);
      return isEn
        ? " SPLIT FARE 50/50:\n\nPlease enter the phone number of the passenger you want to share fare with:\nExample: 0712345678"
        : " GAWANA NAULI 50/50:\n\nTafadhali ingiza namba ya simu ya abiria mwenzako wa kugawana naye nauli:\nMfano: 0712345678";
    } else if (cleanInput === '4' || lowerInput.includes('njia') || lowerInput.includes('route') || lowerInput.includes('custom')) {
      session.step = 'TAXI_ROUTE';
      session.selectedService = 'taxi';
      await saveSession(session, dbAdmin);
      return isEn
        ? " CUSTOM ROUTE:\n\nEnter pickup and drop off (e.g. Mwenge - Posta)"
        : " NJIA YAKO:\n\nAndika sehemu ya kuchukuliwa na unakokwenda.\nMfano: Mwenge - Posta";
    }
  }

  // --- MODULE: PAPOMART (SOKONI, GROCERY & MADUKA) ---
  if (session.step === 'PAPOMART_MAIN_MENU') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session, businessConfig);
    }
    const isEn = session.language === 'en';
    if (cleanInput === '1' || lowerInput.includes('grocery') || lowerInput.includes('soko') || lowerInput.includes('mboga')) {
      return isEn
        ? " SOKONI & GROCERY:\n\n1. Fresh Fruits & Vegetables Basket (TZS 15,000)\n2. Rice & Maize Flour Pack (25kg) (TZS 48,000)\n3. Cooking Oil & Spices Combo (TZS 22,000)\n\nReply with product number to order or 0 to Back."
        : " SOKONI & GROCERY:\n\n1. Tenga la Matunda & Mboga (TZS 15,000)\n2. Mfuko wa Mchele & Unga (25kg) (TZS 48,000)\n3. Mafuta ya Kupikia & Viungo (TZS 22,000)\n\nTuma namba ya bidhaa kuagiza au 0 kurudi Nyuma.";
    } else if (cleanInput === '2' || lowerInput.includes('dawa') || lowerInput.includes('pharmacy')) {
      return isEn
        ? " PHARMACY & HEALTH:\n\n1. First Aid Kit Box (TZS 25,000)\n2. Panadol Extra & Vitamins Pack (TZS 5,000)\n3. Hand Sanitizer & Antiseptic (TZS 8,000)\n\nReply with item number or 0 to Back."
        : " DUKA LA DAWA & AFYA:\n\n1. Sanduku la Huduma ya Kwanza (TZS 25,000)\n2. Panadol Extra & Vitamini Pack (TZS 5,000)\n3. Kitakasa Mikono & Dawa (TZS 8,000)\n\nTuma namba ya dawa au 0 kurudi Nyuma.";
    } else if (cleanInput === '3' || lowerInput.includes('shopping') || lowerInput.includes('duka')) {
      return isEn
        ? " ELECTRONICS & SHOPPING:\n\n1. Fast Charger 65W Type-C (TZS 20,000)\n2. Wireless Earbuds Bluetooth (TZS 35,000)\n3. Power Bank 20,000mAh (TZS 45,000)\n\nReply with item number or 0 to Back."
        : " MADUKA & ELECTRONICS:\n\n1. Fast Charger 65W Type-C (TZS 20,000)\n2. Wireless Earbuds Bluetooth (TZS 35,000)\n3. Power Bank 20,000mAh (TZS 45,000)\n\nTuma namba ya kifaa kuagiza au 0 kurudi Nyuma.";
    }
  }

  // --- MODULE: PAPOSTAY / HOTELI ---
  if (session.step === 'HOTEL_MAIN_MENU') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session, businessConfig);
    }
    const isEn = session.language === 'en';
    if (cleanInput === '1' || lowerInput.includes('luxury') || lowerInput.includes('nyota')) {
      return isEn
        ? " LUXURY HOTELS (4-5 STAR):\n\n1. Serena Hotel Dar - TZS 250,000/night\n2. Gran Melia Arusha - TZS 320,000/night\n\nReply with number to book or 0 to Back."
        : " HOTELI ZA LUXURY (4-5 STAR):\n\n1. Serena Hotel Dar - TZS 250,000/usiku\n2. Gran Melia Arusha - TZS 320,000/usiku\n\nTuma namba kuhifadhi au 0 kurudi Nyuma.";
    } else if (cleanInput === '2' || lowerInput.includes('guest') || lowerInput.includes('chumba')) {
      return isEn
        ? " BUDGET GUEST HOUSES:\n\n1. Mikocheni Park Lodge - TZS 35,000/night\n2. Sinza Executive Lodge - TZS 40,000/night\n\nReply with number to book or 0 to Back."
        : " GUEST HOUSES & VYUMBA:\n\n1. Mikocheni Park Lodge - TZS 35,000/usiku\n2. Sinza Executive Lodge - TZS 40,000/usiku\n\nTuma namba kuhifadhi au 0 kurudi Nyuma.";
    } else if (cleanInput === '3' || lowerInput.includes('resort') || lowerInput.includes('beach')) {
      return isEn
        ? " BEACH RESORTS & LODGES:\n\n1. White Sands Beach Resort - TZS 180,000/night\n2. Kendwa Rocks Resort Zanzibar - TZS 220,000/night\n\nReply with number to book or 0 to Back."
        : " RESOTI NA BEACH LODGES:\n\n1. White Sands Beach Resort - TZS 180,000/usiku\n2. Kendwa Rocks Resort Zanzibar - TZS 220,000/usiku\n\nTuma namba kuhifadhi au 0 kurudi Nyuma.";
    }
  }

  // --- MODULE: PAPORENT (CAR & EQUIPMENT RENTAL) ---
  if (session.step === 'PAPORENT_MAIN_MENU') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session, businessConfig);
    }
    const isEn = session.language === 'en';
    if (cleanInput === '1' || lowerInput.includes('gari') || lowerInput.includes('car')) {
      return isEn
        ? " CAR RENTAL (PAPORENT):\n\n1. Toyota Prado TX (TZS 120,000/day)\n2. Toyota RAV4 (TZS 65,000/day)\n3. Suzuki Swift (TZS 45,000/day)\n\nReply with vehicle number to request rental or 0 to Back."
        : " KUKODI MAGARI (PAPORENT):\n\n1. Toyota Prado TX (TZS 120,000/siku)\n2. Toyota RAV4 (TZS 65,000/siku)\n3. Suzuki Swift (TZS 45,000/siku)\n\nTuma namba ya gari kuomba kukodi au 0 kurudi Nyuma.";
    } else if (cleanInput === '2' || lowerInput.includes('bajaj') || lowerInput.includes('bajaji')) {
      return isEn
        ? " BAJAJ RENTAL:\n\n1. TVS King Deluxe (TZS 25,000/day)\n2. Bajaj RE Compact (TZS 22,000/day)\n\nReply with number to request rental or 0 to Back."
        : " KUKODI BAJAJ:\n\n1. TVS King Deluxe (TZS 25,000/siku)\n2. Bajaj RE Compact (TZS 22,000/siku)\n\nTuma namba kuomba kukodi au 0 kurudi Nyuma.";
    } else if (cleanInput === '3' || lowerInput.includes('boda') || lowerInput.includes('pikipiki')) {
      return isEn
        ? " MOTORCYCLE / BODABODA RENTAL:\n\n1. Boxer 150 HD (TZS 15,000/day)\n2. SanLG 125 (TZS 12,000/day)\n\nReply with number to request rental or 0 to Back."
        : " KUKODI BODABODA / PIKIPIKI:\n\n1. Boxer 150 HD (TZS 15,000/siku)\n2. SanLG 125 (TZS 12,000/siku)\n\nTuma namba kuomba kukodi au 0 kurudi Nyuma.";
    }
  }

  // --- MODULE: PAPOBOT USSD PIN UNLOCK ---
  if (session.step === 'PAPOBOT_PIN_UNLOCK') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    if (cleanInput === '4829' || cleanInput.length === 4) {
      session.step = 'START';
      await saveSession(session, dbAdmin);
      return session.language === 'en'
        ? " PAPOBOT UNLOCKED SUCCESSFULLY! \n\nThe cargo compartment door has opened. Please retrieve your items and push the lid down to lock.\n\nThank you for using Papo Hapo Autonomous Delivery!"
        : " PAPOBOT IMEFUNGUKA KIKAMILIFU! \n\nMfuniko wa mzigo umejifungua. Tafadhali chukua mzigo wako kisha sukuma mfuniko chini kujilock.\n\nAhsante kwa kutumia Papo Hapo Autonomous Delivery!";
    }

    return session.language === 'en'
      ? " Incorrect PIN! Please enter the 4-digit PIN (Default: 4829) or send 0 to Cancel:"
      : " PIN Si Sahihi! Ingiza PIN ya tarakimu 4 (Default: 4829) au tuma 0 Kughairi:";
  }
  if (session.step === 'QUICK_REORDER_MENU') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    const reorderOptions: Record<string, any> = {
      '1': { name: 'PapoRide Taxi (Mwenge  Posta)', amount: 4500, type: 'PapoRide', icon: '' },
      '2': { name: 'PapoFood - Papo Pizza (2x Burger)', amount: 12500, type: 'PapoFood', icon: '' },
      '3': { name: 'PapoSend Kifurushi (Kariakoo)', amount: 3500, type: 'PapoSend', icon: '' },
      '4': { name: 'PapoBus Tiketi (DAR  MWANZA)', amount: 45000, type: 'PapoBus', icon: '' },
    };

    const selected = reorderOptions[cleanInput];
    if (!selected) {
      return getQuickReOrderText(session);
    }

    session.reorderItem = selected;
    session.step = 'QUICK_REORDER_CONFIRM';
    await saveSession(session, dbAdmin);

    const bal = (session.walletBalance ?? 0).toLocaleString();
    const isEn = session.language === 'en';

    if (isEn) {
      return ` CONFIRM QUICK RE-ORDER\n\nService: ${selected.icon} ${selected.name}\nAmount: TZS ${selected.amount.toLocaleString()}\nPayment: PapoWallet (Bal: TZS ${bal})\n\n1. Confirm & Re-Order Now \n0. Cancel`;
    }
    return ` THIBITISHA AGIZA TENA\n\nHuduma: ${selected.icon} ${selected.name}\nGharama: TZS ${selected.amount.toLocaleString()}\nMalipo: PapoWallet (Salio: TZS ${bal})\n\n1. Thibitisha & Agiza Sasa \n0. Ghairi`;
  }

  if (session.step === 'QUICK_REORDER_CONFIRM') {
    if (cleanInput === '0') {
      session.step = 'QUICK_REORDER_MENU';
      await saveSession(session, dbAdmin);
      return getQuickReOrderText(session);
    }

    if (cleanInput === '1') {
      const item = session.reorderItem || { name: 'PapoFood - Papo Pizza', amount: 12500, icon: '', type: 'PapoFood' };
      const cost = item.amount || 5000;
      const isEn = session.language === 'en';

      if ((session.walletBalance || 0) < cost) {
        return isEn
          ? ` Insufficient PapoWallet balance (Bal: TZS ${(session.walletBalance || 0).toLocaleString()}, Required: TZS ${cost.toLocaleString()}). Please top up first.`
          : ` Salio la PapoWallet halitoshi (Salio: TZS ${(session.walletBalance || 0).toLocaleString()}, Inatakiwa: TZS ${cost.toLocaleString()}). Tafadhali weka salio kwanza.`;
      }

      session.walletBalance = (session.walletBalance || 0) - cost;
      const pts = Math.max(10, Math.floor(cost / 100));
      session.papoPoints = (session.papoPoints || 0) + pts;

      const code = `PH-RE${Math.floor(100000 + Math.random() * 900000)}`;

      if (dbAdmin) {
        try {
          await dbAdmin.collection('orders').add({
            bookingId: code,
            customerPhone: session.phone,
            serviceType: item.type,
            vendorName: item.name,
            totalAmount: cost,
            paymentMethod: 'PapoWallet',
            status: 'accepted',
            createdAt: new Date(),
            source: 'USSD Quick Re-Order'
          });
        } catch (e) {
          console.warn("[USSD Re-Order] Failed saving to Firestore:", e);
        }
      }

      session.step = 'START';
      await saveSession(session, dbAdmin);

      if (isEn) {
        return ` RE-ORDER SUCCESSFUL! \n\nOrder Code: ${code}\nService: ${item.icon} ${item.name}\nAmount Paid: TZS ${cost.toLocaleString()} (PapoWallet)\n Earned +${pts} PapoPoints!\n\nVendor & Driver notified. Preparation started instantly!`;
      }
      return ` AGIZO LAKO LIMETHIBITISHWA PAPO HAPO! \n\nMsimbo: ${code}\nHuduma: ${item.icon} ${item.name}\nKiasi Kilicholipwa: TZS ${cost.toLocaleString()} (PapoWallet)\n Umepata +${pts} PapoPoints!\n\nMuuzaji na Boda wamearifiwa na maandalizi yameanza mara moja!`;
    }

    return session.language === 'en' ? "Send 1 to confirm or 0 to cancel." : "Tuma 1 kuthibitisha au 0 kughairi.";
  }

  // --- MODULE 1: ACTIVE ORDER STATUS ---
  if (session.step === 'ACTIVE_ORDER_STATUS') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }
    if (cleanInput === '1') {
      return await getActiveOrderStatusText(session, dbAdmin);
    }
    return await getActiveOrderStatusText(session, dbAdmin, cleanInput);
  }

  // --- MODULE 2 & 3: PAPOWALLET & PAPOPOINTS & PROMO CODES ---
  if (session.step === 'PAPOWALLET_MAIN') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    if (cleanInput === '1') {
      session.step = 'PAPOWALLET_TOPUP_AMOUNT';
      await saveSession(session, dbAdmin);
      return session.language === 'en'
        ? " TOP-UP PAPOWALLET\n\nEnter amount to deposit (e.g. 5000, 10000, 20000, 50000 TZS):\n\n0. Back"
        : " WEKA SALIO PAPOWALLET\n\nIngiza kiasi unachotaka kuweka (mf. 5000, 10000, 20000, 50000 TZS):\n\n0. Nyuma";
    }

    if (cleanInput === '2') {
      session.step = 'PAPOWALLET_CONVERT_POINTS';
      await saveSession(session, dbAdmin);
      const points = session.papoPoints || 0;
      const cashVal = points * 10;
      if (points <= 0) {
        return session.language === 'en'
          ? " PAPOPOINTS REWARDS\n\nYou currently have 0 PapoPoints. Earn points automatically with every order placed on Papo Hapo!\n\n0. Back"
          : " POINTI ZA ZAWADI\n\nHuna PapoPoints za kutosha sasa (Points: 0). Pata pointi zaidi kila unapoagiza huduma za Papo Hapo!\n\n0. Nyuma";
      }
      return session.language === 'en'
        ? ` CONVERT PAPOPOINTS TO CASH\n\nYou have ${points} PTS worth TZS ${cashVal.toLocaleString()}.\n\nSend 1 to confirm conversion into PapoWallet Cash balance.\n0. Cancel`
        : ` BADILI POINTI KUWA CASH\n\nUna PapoPoints ${points} zenye thamani ya TZS ${cashVal.toLocaleString()}.\n\nTuma 1 kuthibitisha kubadili kuwa salio la PapoWallet.\n0. Ghairi`;
    }

    if (cleanInput === '3') {
      session.step = 'PAPOWALLET_ENTER_PROMO';
      await saveSession(session, dbAdmin);
      return session.language === 'en'
        ? " ENTER PROMO CODE\n\nEnter your promotional code (e.g. PAPO10, KARIBU, PAPO50):\n\n0. Back"
        : " INGIZA PROMO CODE / PUNGUZO\n\nIngiza msimbo wa punguzo (mfano: PAPO10, KARIBU, PAPO50):\n\n0. Nyuma";
    }

    if (cleanInput === '4') {
      session.step = 'PAPOWALLET_SPLIT_PHONE';
      await saveSession(session, dbAdmin);
      return session.language === 'en'
        ? " SPLIT FARE 50/50 (GAWANA NAULI)\n\nEnter friend's phone number to split ride or order fare with (e.g. 0712345678):\n\n0. Back"
        : " GAWANA NAULI 50/50 (Split Fare)\n\nIngiza namba ya simu ya mwenzako unayetaka kugawana naye nauli (mfano 0712345678):\n\n0. Nyuma";
    }

    if (cleanInput === '5') {
      session.step = 'PAPOWALLET_PAY_FRIEND_PHONE';
      await saveSession(session, dbAdmin);
      return session.language === 'en'
        ? " PAY FOR FRIEND / RELATIVE (LIPIA MWINGINE)\n\nEnter phone number of recipient you want to pay for (e.g. 0755123456):\n\n0. Back"
        : " LIPIA MWEZI / RAFIKI (Lipia Mwingine)\n\nIngiza namba ya simu ya mtu unayemlipia huduma (mfano 0755123456):\n\n0. Nyuma";
    }

    if (cleanInput === '6') {
      session.step = 'PAPOWALLET_HISTORY';
      await saveSession(session, dbAdmin);
      const bal = (session.walletBalance || 0).toLocaleString();
      return session.language === 'en'
        ? ` RECENT WALLET TRANSACTIONS\n\n1. Top-Up M-Pesa: +TZS 10,000 (Today)\n2. PapoFood Order: -TZS 8,500 (Yesterday)\n3. Split Fare Paid: -TZS 2,500 (Yesterday)\n4. Converted Points: +TZS 1,200\n\nCurrent Balance: TZS ${bal}\n\n0. Back`
        : ` MIAMALA YA HIVI KARIBUNI\n\n1. Top-Up M-Pesa: +TZS 10,000 (Leo)\n2. Agizo la PapoFood: -TZS 8,500 (Jana)\n3. Gawana Nauli: -TZS 2,500 (Jana)\n4. Badili Points: +TZS 1,200\n\nSalio la Sasa: TZS ${bal}\n\n0. Nyuma`;
    }

    return getPapoWalletText(session);
  }

  // --- SPLIT FARE HANDLERS ---
  if (session.step === 'PAPOWALLET_SPLIT_PHONE') {
    if (cleanInput === '0') {
      session.step = 'PAPOWALLET_MAIN';
      await saveSession(session, dbAdmin);
      return getPapoWalletText(session);
    }

    session.splitFarePhone = cleanInput;
    session.step = 'PAPOWALLET_SPLIT_AMOUNT';
    await saveSession(session, dbAdmin);
    return session.language === 'en'
      ? ` SPLIT FARE 50/50 WITH ${cleanInput}\n\nEnter total ride/order amount in TZS (e.g. 5000):\n\n0. Cancel`
      : ` GAWANA NAULI 50/50 NA ${cleanInput}\n\nIngiza jumla ya gharama za nauli/agizo kwa TZS (mfano 5000):\n\n0. Ghairi`;
  }

  if (session.step === 'PAPOWALLET_SPLIT_AMOUNT') {
    if (cleanInput === '0') {
      session.step = 'PAPOWALLET_MAIN';
      await saveSession(session, dbAdmin);
      return getPapoWalletText(session);
    }

    const totalAmt = parseInt(cleanInput.replace(/\D/g, ''), 10);
    if (isNaN(totalAmt) || totalAmt < 500) {
      return session.language === 'en' ? " Invalid amount. Enter total fare (e.g. 5000):" : " Kiasi si sahihi. Ingiza jumla ya nauli (mfano 5000):";
    }

    const userShare = Math.round(totalAmt / 2);
    const friendPhone = session.splitFarePhone || '0712345678';
    const isEn = session.language === 'en';

    if ((session.walletBalance || 0) < userShare) {
      return isEn
        ? ` Insufficient balance for your 50% share (TZS ${userShare.toLocaleString()}). Wallet Bal: TZS ${(session.walletBalance || 0).toLocaleString()}`
        : ` Salio lako halitoshi kwa sehemu yako 50% (TZS ${userShare.toLocaleString()}). Salio PapoWallet: TZS ${(session.walletBalance || 0).toLocaleString()}`;
    }

    session.walletBalance = (session.walletBalance || 0) - userShare;
    session.step = 'PAPOWALLET_MAIN';
    await saveSession(session, dbAdmin);

    if (isEn) {
      return ` SPLIT FARE DISPATCHED SUCCESSFULLY! \n\nTotal Fare: TZS ${totalAmt.toLocaleString()}\nYour 50% Share Paid: TZS ${userShare.toLocaleString()}\nPartner (${friendPhone}): Payment request sent via SMS/USSD!\nNew Wallet Balance: TZS ${session.walletBalance.toLocaleString()}\n\n0. Main Menu`;
    }
    return ` OMBI LA GAWANA NAULI LIMETUMWA! \n\nJumla ya Nauli: TZS ${totalAmt.toLocaleString()}\nSehemu yako 50% Imelipwa: TZS ${userShare.toLocaleString()}\nMwenzako (${friendPhone}): Ombi la TZS ${userShare.toLocaleString()} limetumwa kwa USSD/SMS!\nSalio Jipya PapoWallet: TZS ${session.walletBalance.toLocaleString()}\n\n0. Rudi Mwanzo`;
  }

  // --- PAY FOR FRIEND HANDLERS ---
  if (session.step === 'PAPOWALLET_PAY_FRIEND_PHONE') {
    if (cleanInput === '0') {
      session.step = 'PAPOWALLET_MAIN';
      await saveSession(session, dbAdmin);
      return getPapoWalletText(session);
    }

    session.splitFarePhone = cleanInput;
    session.step = 'PAPOWALLET_PAY_FRIEND_AMOUNT';
    await saveSession(session, dbAdmin);
    return session.language === 'en'
      ? ` PAY FOR FRIEND (${cleanInput})\n\nEnter amount you wish to pay for them in TZS (e.g. 4500):\n\n0. Cancel`
      : ` LIPIA RAFIKI / MWEZI (${cleanInput})\n\nIngiza kiasi unachotaka kumlipia kwa TZS (mfano 4500):\n\n0. Ghairi`;
  }

  if (session.step === 'PAPOWALLET_PAY_FRIEND_AMOUNT') {
    if (cleanInput === '0') {
      session.step = 'PAPOWALLET_MAIN';
      await saveSession(session, dbAdmin);
      return getPapoWalletText(session);
    }

    const amt = parseInt(cleanInput.replace(/\D/g, ''), 10);
    if (isNaN(amt) || amt < 500) {
      return session.language === 'en' ? " Invalid amount. Enter amount (e.g. 4500):" : " Kiasi si sahihi. Ingiza kiasi (mfano 4500):";
    }

    const recipient = session.splitFarePhone || '0755123456';
    const isEn = session.language === 'en';

    if ((session.walletBalance || 0) < amt) {
      return isEn
        ? ` Insufficient PapoWallet balance (Bal: TZS ${(session.walletBalance || 0).toLocaleString()}, Required: TZS ${amt.toLocaleString()})`
        : ` Salio halitoshi kwenye PapoWallet (Salio: TZS ${(session.walletBalance || 0).toLocaleString()}, Inatakiwa: TZS ${amt.toLocaleString()})`;
    }

    session.walletBalance = (session.walletBalance || 0) - amt;
    session.step = 'PAPOWALLET_MAIN';
    await saveSession(session, dbAdmin);

    if (isEn) {
      return ` PAYMENT TO FRIEND SUCCESSFUL! \n\nPaid TZS ${amt.toLocaleString()} for ${recipient} via PapoWallet.\nSMS notification sent to ${recipient}.\nYour New Balance: TZS ${session.walletBalance.toLocaleString()}\n\n0. Main Menu`;
    }
    return ` MALIPO KWA RAFIKI YAMEKAMILIKA! \n\nUmemlipia ${recipient} TZS ${amt.toLocaleString()} kutoka PapoWallet.\nUjumbe wa SMS umetumwa kwa ${recipient}.\nSalio Lako Jipya: TZS ${session.walletBalance.toLocaleString()}\n\n0. Rudi Mwanzo`;
  }

  // --- MODULE: SAVED LOCATIONS (MAENEO PENDWA) ---
  if (session.step === 'SAVED_LOCATIONS_MENU') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session, businessConfig);
    }

    if (cleanInput === '1' || cleanInput === '4' || lowerInput.includes('nyumbani') || lowerInput.includes('home')) {
      session.step = 'EDIT_HOME_LOCATION';
      await saveSession(session, dbAdmin);
      return session.language === 'en'
        ? " EDIT HOME ADDRESS\n\nEnter new home address (e.g. Kinondoni Studio, Dar es Salaam):\n\n0. Cancel"
        : " HARIRI ANWANI YA NYUMBANI\n\nIngiza anwani mpya ya nyumbani (mfano Kinondoni Studio, Dar es Salaam):\n\n0. Ghairi";
    }

    if (cleanInput === '2' || cleanInput === '5' || lowerInput.includes('ofisini') || lowerInput.includes('work')) {
      session.step = 'EDIT_WORK_LOCATION';
      await saveSession(session, dbAdmin);
      return session.language === 'en'
        ? " EDIT WORK ADDRESS\n\nEnter new work address (e.g. Victoria Tower, Bagamoyo Road):\n\n0. Cancel"
        : " HARIRI ANWANI YA OFISINI\n\nIngiza anwani mpya ya ofisini (mfano Victoria Tower, Bagamoyo Road):\n\n0. Ghairi";
    }

    if (cleanInput === '3' || cleanInput === '6' || lowerInput.includes('lingine') || lowerInput.includes('custom') || lowerInput.includes('weka')) {
      session.step = 'EDIT_CUSTOM_LOCATION';
      await saveSession(session, dbAdmin);
      return session.language === 'en'
        ? " ADD CUSTOM LOCATION\n\nEnter place name & address (e.g. Soko la Kariakoo):\n\n0. Cancel"
        : " WEKA ENEO LINGINE PENDWA\n\nIngiza jina na anwani ya eneo (mfano Soko la Kariakoo):\n\n0. Ghairi";
    }

    return getSavedLocationsText(session);
  }

  if (session.step === 'EDIT_HOME_LOCATION') {
    if (cleanInput === '0') {
      session.step = 'SAVED_LOCATIONS_MENU';
      await saveSession(session, dbAdmin);
      return getSavedLocationsText(session);
    }

    if (!session.savedLocations) session.savedLocations = {};
    session.savedLocations.home = cleanInput.trim();
    session.step = 'SAVED_LOCATIONS_MENU';
    await saveSession(session, dbAdmin);

    const isEn = session.language === 'en';
    const msg = isEn ? " Home address updated successfully!\n\n" : " Anwani ya Nyumbani imehifadhiwa vizuri!\n\n";
    return msg + getSavedLocationsText(session);
  }

  if (session.step === 'EDIT_WORK_LOCATION') {
    if (cleanInput === '0') {
      session.step = 'SAVED_LOCATIONS_MENU';
      await saveSession(session, dbAdmin);
      return getSavedLocationsText(session);
    }

    if (!session.savedLocations) session.savedLocations = {};
    session.savedLocations.work = cleanInput.trim();
    session.step = 'SAVED_LOCATIONS_MENU';
    await saveSession(session, dbAdmin);

    const isEn = session.language === 'en';
    const msg = isEn ? " Work address updated successfully!\n\n" : " Anwani ya Ofisini imehifadhiwa vizuri!\n\n";
    return msg + getSavedLocationsText(session);
  }

  if (session.step === 'EDIT_CUSTOM_LOCATION') {
    if (cleanInput === '0') {
      session.step = 'SAVED_LOCATIONS_MENU';
      await saveSession(session, dbAdmin);
      return getSavedLocationsText(session);
    }

    if (!session.savedLocations) session.savedLocations = {};
    session.savedLocations.custom = cleanInput.trim();
    session.step = 'SAVED_LOCATIONS_MENU';
    await saveSession(session, dbAdmin);

    const isEn = session.language === 'en';
    const msg = isEn ? " Custom favorite location saved!\n\n" : " Eneo lingine pendwa limehifadhiwa!\n\n";
    return msg + getSavedLocationsText(session);
  }

  // --- MODULE: USSD AUTOMATED VOICE CALLBACK (IVR CALL) ---
  if (session.step === 'VOICE_CALLBACK_MENU') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    if (cleanInput === '1') {
      return getVoiceCallbackText(session);
    }

    return getVoiceCallbackText(session);
  }

  if (session.step === 'PAPOWALLET_TOPUP_AMOUNT') {
    if (cleanInput === '0') {
      session.step = 'PAPOWALLET_MAIN';
      await saveSession(session, dbAdmin);
      return getPapoWalletText(session);
    }

    const amount = parseInt(cleanInput.replace(/\D/g, ''), 10);
    if (isNaN(amount) || amount < 1000) {
      return session.language === 'en'
        ? " Invalid amount! Please enter at least 1,000 TZS (e.g. 5000):"
        : " Kiasi si sahihi! Ingiza angalau TZS 1,000 (mf. 5000):";
    }

    session.deliveryFee = amount; // store temp topup amount
    session.step = 'PAPOWALLET_TOPUP_PROVIDER';
    await saveSession(session, dbAdmin);

    return session.language === 'en'
      ? ` Deposit TZS ${amount.toLocaleString()}\n\nSelect Mobile Payment Network:\n1. M-Pesa\n2. Tigo Pesa\n3. Airtel Money\n4. HaloPesa\n\n0. Cancel`
      : ` Weka Salio TZS ${amount.toLocaleString()}\n\nChagua Mtandao wa Malipo:\n1. M-Pesa\n2. Tigo Pesa\n3. Airtel Money\n4. HaloPesa\n\n0. Ghairi`;
  }

  if (session.step === 'PAPOWALLET_TOPUP_PROVIDER') {
    if (cleanInput === '0') {
      session.step = 'PAPOWALLET_MAIN';
      await saveSession(session, dbAdmin);
      return getPapoWalletText(session);
    }

    const netMap: Record<string, string> = { '1': 'M-Pesa', '2': 'Tigo Pesa', '3': 'Airtel Money', '4': 'HaloPesa' };
    const network = netMap[cleanInput] || 'M-Pesa';
    const topupAmt = session.deliveryFee || 10000;
    const userPhone = session.phone.replace('ussd:', '');

    session.topupNetwork = network;
    session.step = 'PAPOWALLET_STK_PIN_PROMPT';
    await saveSession(session, dbAdmin);

    const isEn = session.language === 'en';

    return isEn
      ? ` [STK PUSH - ${network.toUpperCase()}]\nPay TZS ${topupAmt.toLocaleString()} (${userPhone}).\n Enter ${network} 4-digit PIN:\n0. Cancel`
      : ` [STK PUSH - ${network.toUpperCase()}]\nMalipo TZS ${topupAmt.toLocaleString()} (${userPhone}).\n Ingiza PIN ya ${network}:\n0. Ghairi`;
  }

  if (session.step === 'PAPOWALLET_STK_PIN_PROMPT') {
    if (cleanInput === '0') {
      session.step = 'PAPOWALLET_MAIN';
      await saveSession(session, dbAdmin);
      return getPapoWalletText(session);
    }

    const network = session.topupNetwork || 'M-Pesa';
    const topupAmt = session.deliveryFee || 10000;
    
    session.walletBalance = (session.walletBalance || 0) + topupAmt;
    session.papoPoints = (session.papoPoints || 0) + 50; // Bonus 50 points on topup!
    
    session.step = 'START';
    await saveSession(session, dbAdmin);

    const newBal = session.walletBalance.toLocaleString();
    const isEn = session.language === 'en';

    return isEn
      ? ` STK PUSH DONE! \n${network} payment TZS ${topupAmt.toLocaleString()} confirmed.\nNew Balance: TZS ${newBal} (+50 PTS)\nSend 0 or HI to return to menu.`
      : ` STK PUSH IMEKAMILIKA! \nMalipo ya ${network} TZS ${topupAmt.toLocaleString()} yamethibitishwa.\nSalio Jipya: TZS ${newBal} (+50 PTS)\nTuma 0 au HI kurudi mwanzo.`;
  }

  if (session.step === 'PAPOWALLET_CONVERT_POINTS') {
    if (cleanInput === '0') {
      session.step = 'PAPOWALLET_MAIN';
      await saveSession(session, dbAdmin);
      return getPapoWalletText(session);
    }

    if (cleanInput === '1') {
      const pts = session.papoPoints || 0;
      const cash = pts * 10;
      session.walletBalance = (session.walletBalance || 0) + cash;
      session.papoPoints = 0;
      
      session.step = 'START';
      await saveSession(session, dbAdmin);

      return session.language === 'en'
        ? ` Success! Converted ${pts} PapoPoints into TZS ${cash.toLocaleString()} cash in your PapoWallet!\n\nNew Wallet Balance: TZS ${session.walletBalance.toLocaleString()}\n\nSend 0 to return to main menu.`
        : ` Hongera! Umefanikiwa kubadili PapoPoints ${pts} kuwa TZS ${cash.toLocaleString()} cash kwenye PapoWallet!\n\nSalio Lako Mpya: TZS ${session.walletBalance.toLocaleString()}\n\nTuma 0 kurudi mwanzo.`;
    }

    return session.language === 'en' ? "Send 1 to confirm or 0 to cancel." : "Tuma 1 kuthibitisha au 0 kughairi.";
  }

  if (session.step === 'PAPOWALLET_ENTER_PROMO') {
    if (cleanInput === '0') {
      session.step = 'PAPOWALLET_MAIN';
      await saveSession(session, dbAdmin);
      return getPapoWalletText(session);
    }

    const code = cleanInput.toUpperCase().replace(/\s+/g, '');
    let discText = "10% Discount";
    if (code === 'KARIBU') discText = "TZS 2,000 Discount";
    else if (code === 'PAPO50') discText = "50% Discount";

    session.appliedPromoCode = code;
    session.promoDiscount = code === 'KARIBU' ? 2000 : code === 'PAPO50' ? 0.5 : 0.1;

    session.step = 'START';
    await saveSession(session, dbAdmin);

    return session.language === 'en'
      ? ` Promo Code '${code}' (${discText}) applied successfully!\n\nYour discount will automatically apply to your next PapoRide, PapoFood, PapoSend, or PapoBus order.\n\nSend 0 to return to main menu.`
      : ` Promo Code '${code}' (${discText}) imewezeshwa kwa mafanikio!\n\nPunguzo litakatwa moja kwa moja kwenye agizo lako lijalo la PapoRide, PapoFood, PapoSend au PapoBus.\n\nTuma 0 kurudi mwanzo.`;
  }

  if (session.step === 'PAPOWALLET_HISTORY') {
    if (cleanInput === '0') {
      session.step = 'PAPOWALLET_MAIN';
      await saveSession(session, dbAdmin);
      return getPapoWalletText(session);
    }
    return getPapoWalletText(session);
  }

  // --- MODULE 4: LANGUAGE SWITCH MENU ---
  if (session.step === 'LANGUAGE_SWITCH_MENU') {
    if (cleanInput === '1') {
      session.language = 'sw';
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return `🇹🇿 Lugha imebadilishwa kuwa Kiswahili kikamilifu!\n\n` + getWelcomeMessage(session);
    }
    if (cleanInput === '2') {
      session.language = 'en';
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return `🇬🇧 Language successfully set to English!\n\n` + getWelcomeMessage(session);
    }
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }
    return " Please select 1 for Kiswahili or 2 for English (0 to go back):";
  }

  // 1. TAXI SUBMENU & QUICK BOOKING
  if (session.step === 'TAXI_SUBMENU' && session.selectedService === 'taxi') {
    if (cleanInput === '1') {
      session.step = 'TAXI_QUICK_DESTINATION';
      await saveSession(session, dbAdmin);
      return " AGIZA TAXI HARAKA:\n\nChagua eneo unalokwenda:\n1. Posta Mpya (City Center)\n2. Kariakoo Sokoni\n3. Mwenge Stand\n4. Ubungo Bus Terminal\n5. Julius Nyerere Airport (JNIA)\n6. Andika Njia Yako Moja kwa Moja";
    } else if (cleanInput === '2') {
      session.step = 'TAXI_FARE_ESTIMATE_INPUT';
      await saveSession(session, dbAdmin);
      return " KADIRIO LA NAULI (Fare Estimate):\n\nTafadhali tuma njia unayotaka kukadiria gharama zake (Kutoka - Kwenda).\nMfano:\nMwenge - Posta\nau Airport - Mikocheni";
    } else if (cleanInput === '3') {
      session.step = 'TAXI_ROUTE';
      await saveSession(session, dbAdmin);
      return " MFUMO WA TAXI:\n\nTafadhali tuma njia unayotaka kusafiri (Kutoka - Kwenda).\nMfano: POSTA - KINONDONI";
    } else if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    } else {
      return " Chaguo si sahihi. Tafadhali tuma:\n1. Agiza Taxi kwa Haraka\n2. Kadirio la Nauli\n3. Andika Njia Yako";
    }
  }

  if (session.step === 'TAXI_QUICK_DESTINATION' && session.selectedService === 'taxi') {
    const quickDestinations: Record<string, { name: string; lat: number; lng: number }> = {
      '1': { name: "Posta Mpya (City Center)", lat: -6.8164, lng: 39.2902 },
      '2': { name: "Kariakoo Sokoni", lat: -6.8188, lng: 39.2747 },
      '3': { name: "Mwenge Stand", lat: -6.7681, lng: 39.2274 },
      '4': { name: "Ubungo Bus Terminal", lat: -6.7883, lng: 39.2069 },
      '5': { name: "Julius Nyerere Airport (JNIA)", lat: -6.8781, lng: 39.2026 },
    };

    if (cleanInput === '6') {
      session.step = 'TAXI_ROUTE';
      await saveSession(session, dbAdmin);
      return " Tafadhali tuma njia yako (Mfano: Mwenge - Posta):";
    }

    const selectedDest = quickDestinations[cleanInput];
    if (selectedDest) {
      const pLoc = {
        placeId: "TZ-DSM-MWENGE-001",
        name: "Mwenge Stand",
        address: "Mwenge Stand, Kinondoni, Dar es Salaam",
        lat: -6.7681,
        lng: 39.2274
      };
      const dLoc = {
        placeId: `TZ-DSM-QUICK-${cleanInput}`,
        name: selectedDest.name,
        address: `${selectedDest.name}, Dar es Salaam`,
        lat: selectedDest.lat,
        lng: selectedDest.lng
      };

      session.resolvedPickup = pLoc as any;
      session.resolvedDest = dLoc as any;
      session.taxiRoute = `${pLoc.name} - ${dLoc.name}`;
      session.step = 'TAXI_VEHICLE_SELECT';
      await saveSession(session, dbAdmin);

      return ` *AINA YA USAFIRI*\n\nNjia: *${pLoc.name}* kuelekea *${dLoc.name}*\n\nTafadhali chagua usafiri:\n\n1. Boda Boda  (Haraka & Rahisi)\n2. Bajaji  (Nafuu & Salama)\n3. Gari la Teksi  (Starehe & Usalama)`;
    } else {
      return " Chaguo si sahihi. Tafadhali chagua namba 1 mpaka 6:";
    }
  }

  // 2. FARE ESTIMATE HANDLERS
  if (session.step === 'TAXI_FARE_ESTIMATE_INPUT' || session.step === 'TAXI_FARE_ESTIMATE') {
    if (cleanInput === '0') {
      session.step = 'TAXI_SUBMENU';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session, businessConfig);
    }
    session.selectedService = 'taxi';
    const parsed = splitTwoLocations(cleanInput);
    let pickupQuery = "Mwenge";
    let destQuery = cleanInput;

    if (parsed) {
      pickupQuery = parsed.rawPickup;
      destQuery = parsed.rawDestination;
    }

    const pickupRes = await resolvePlace(pickupQuery, dbAdmin);
    const destRes = await resolvePlace(destQuery, dbAdmin);

    const pLoc = pickupRes.matches && pickupRes.matches[0] ? {
      placeId: pickupRes.matches[0].placeId || "TZ-DSM-MWENGE",
      name: pickupRes.matches[0].name || pickupQuery,
      address: pickupRes.matches[0].displayName || `${pickupQuery}, Dar es Salaam`,
      lat: typeof pickupRes.matches[0].latitude === 'number' ? pickupRes.matches[0].latitude : -6.7681,
      lng: typeof pickupRes.matches[0].longitude === 'number' ? pickupRes.matches[0].longitude : 39.2274
    } : {
      placeId: "TZ-DSM-MWENGE",
      name: pickupQuery,
      address: `${pickupQuery}, Kinondoni, Dar es Salaam`,
      lat: -6.7681,
      lng: 39.2274
    };

    const dLoc = destRes.matches && destRes.matches[0] ? {
      placeId: destRes.matches[0].placeId || "TZ-DSM-POSTA",
      name: destRes.matches[0].name || destQuery,
      address: destRes.matches[0].displayName || `${destQuery}, Dar es Salaam`,
      lat: typeof destRes.matches[0].latitude === 'number' ? destRes.matches[0].latitude : -6.8164,
      lng: typeof destRes.matches[0].longitude === 'number' ? destRes.matches[0].longitude : 39.2902
    } : {
      placeId: "TZ-DSM-POSTA",
      name: destQuery,
      address: `${destQuery}, Dar es Salaam`,
      lat: -6.8164,
      lng: 39.2902
    };

    const routeInfo = await getRoadDistanceAndDuration(pLoc, dLoc);
    let distKm = routeInfo.distanceKm || 7.5;
    let durMin = routeInfo.durationMin || 18;

    // Standard Rates + TZS 500 USSD Surcharge
    const USSD_FEE = 500;

    // Boda Boda: Base 400, 400/km, 90/min -> Min TZS 2,000 (+500 USSD = 2,500)
    const rawBoda = 400 + (distKm * 400) + (durMin * 90);
    let bodaFare = Math.max(2500, Math.ceil((rawBoda + USSD_FEE) / 500) * 500);

    // Bajaji: Base 500, 700/km, 90/min -> Min TZS 4,000 (+500 USSD = 4,500)
    const rawBajaj = 500 + (distKm * 700) + (durMin * 90);
    let bajajFare = Math.max(4500, Math.ceil((rawBajaj + USSD_FEE) / 500) * 500);

    // Gari Basic: Base 1100, 1100/km, 120/min -> Min TZS 5,000 (+500 USSD = 5,500)
    const rawCar = 1100 + (distKm * 1100) + (durMin * 120);
    let carFare = Math.max(5500, Math.ceil((rawCar + USSD_FEE) / 500) * 500);

    session.resolvedPickup = pLoc as any;
    session.resolvedDest = dLoc as any;
    session.optionsList = [{ pLoc, dLoc, distKm, durMin, bodaFare, bajajFare, carFare }];
    session.step = 'TAXI_FARE_ESTIMATE_CONFIRM';
    await saveSession(session, dbAdmin);

    const isEn = session.language === 'en';
    if (isEn) {
      return ` FARE ESTIMATE\n\n From: ${pLoc.name}\n To: ${dLoc.name}\n Distance: ${distKm} km (~${durMin} mins)\n\n ESTIMATED FARES:\n1. Bodaboda : TZS ${bodaFare.toLocaleString()}\n2. Bajaji : TZS ${bajajFare.toLocaleString()}\n3. Taxi Car : TZS ${carFare.toLocaleString()}\n\nReply with option number (1-3) to book now, or 0 to Back.`;
    }

    let reply = ` KADIRIO LA NAULI\n`;
    reply += `Njia: *${pLoc.name}*  *${dLoc.name}* (${distKm}km, ~${durMin}dk)\n\n`;
    reply += `1. Boda : *TZS ${bodaFare.toLocaleString()}/=*\n`;
    reply += `2. Bajaji : *TZS ${bajajFare.toLocaleString()}/=*\n`;
    reply += `3. Teksi : *TZS ${carFare.toLocaleString()}/=*\n\n`;
    reply += `Tuma 1-3 kuagiza, au 0 kurudi.`;
    return reply;
  }

  if (session.step === 'TAXI_FARE_ESTIMATE_CONFIRM') {
    const calcData = session.optionsList?.[0];
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    let selectedType = '';
    let typeName = '';
    let fare = 0;

    if (cleanInput === '1') {
      selectedType = 'bike';
      typeName = 'Boda Boda ';
      fare = calcData?.bodaFare || 2000;
    } else if (cleanInput === '2') {
      selectedType = 'bajaj';
      typeName = 'Bajaji ';
      fare = calcData?.bajajFare || 3500;
    } else if (cleanInput === '3') {
      selectedType = 'mini';
      typeName = 'Gari la Teksi ';
      fare = calcData?.carFare || 7000;
    } else {
      return " Chaguo si sahihi. Tafadhali tuma 1 (Boda), 2 (Bajaji), 3 (Gari), au 0 (Rudi Mwanzo).";
    }

    session.optionsList = [{
      vehicleType: selectedType,
      typeName,
      distanceKm: calcData?.distKm || 5,
      durationMin: calcData?.durMin || 15,
      fare,
      pLoc: calcData?.pLoc,
      dLoc: calcData?.dLoc,
      pickupName: calcData?.pLoc?.name || "Mwenge",
      destName: calcData?.dLoc?.name || "Posta",
      nearbyCount: 3
    }];

    if (session.passengerName && session.passengerName.trim() && session.passengerPhone && session.passengerPhone.trim()) {
      session.step = 'TAXI_ASK_PREVIOUS_DETAILS';
      await saveSession(session, dbAdmin);
      return ` *TAARIFA ZA MSAFIRI*\n\nTumepata taarifa za msafiri ulizowahi kutumia awali:\n- Jina: *${session.passengerName}*\n- Namba: *${session.passengerPhone}*\n\n1. Ndio, Tumia hizi\n2. Hapana, Weka mpya`;
    } else {
      session.step = 'TAXI_PASSENGER_NAME';
      await saveSession(session, dbAdmin);
      return ` *TAARIFA ZA MSAFIRI (Hatua ya 1/2)*\n\nTafadhali andika jina lako au la msafiri (Mfano: Juma Kiboko):`;
    }
  }

  // 3. PAPOSEND FLOW (TUMA & FUATILIA MZIGO)
  if (session.step === 'PAPOSEND_MAIN_MENU') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    if (cleanInput === '1' || lowerInput.includes('tuma') || lowerInput.includes('send')) {
      session.step = 'PAPOSEND_PICKUP_DEST';
      await saveSession(session, dbAdmin);
      return " PapoSend - TUMA MZIGO\n\nIngiza eneo la kuchukulia na kufikisha mzigo.\nMfano:\nKariakoo - Sinza\nau Mwenge - Posta";
    }

    if (cleanInput === '2' || lowerInput.includes('fuatilia') || lowerInput.includes('track')) {
      session.step = 'PARCEL_TRACK_INPUT';
      await saveSession(session, dbAdmin);
      return " PapoSend - FUATILIA MZIGO\n\nIngiza Namba ya Mzigo (mf. PS-82910) au Simu ya Mtumaji/Mpokeaji:";
    }

    return " Chaguo si sahihi!\nTuma 1 Kutuma Mzigo, 2 Kufuatilia Mzigo, au 0 Rudi Mwanzo.";
  }

  if (session.step === 'PAPOSEND_PICKUP_DEST') {
    if (cleanInput === '0') {
      session.step = 'PAPOSEND_MAIN_MENU';
      await saveSession(session, dbAdmin);
      return " PapoSend (VIFURUSHI & DELIVERY):\n\n1. Tuma Mzigo / Kifurushi\n2. Fuatilia Mzigo Wako\n\n0. Rudi Mwanzo";
    }

    let parts = cleanInput.split(/ - | to | kwenda |-|—/i);
    let pickup = parts[0] ? parts[0].trim().toUpperCase() : "KARIAKOO";
    let dest = parts[1] ? parts[1].trim().toUpperCase() : "POSTA";

    session.parcelPickup = pickup;
    session.parcelDest = dest;
    session.step = 'PAPOSEND_DESC';
    await saveSession(session, dbAdmin);

    return ` Kuchukulia: ${pickup}\n Kufikisha: ${dest}\n\nAndika maelezo ya mzigo (mf. Mkataba na Simu, Viatu, Au Mzigo wa Kilo 3):`;
  }

  if (session.step === 'PAPOSEND_DESC') {
    if (cleanInput === '0') {
      session.step = 'PAPOSEND_PICKUP_DEST';
      await saveSession(session, dbAdmin);
      return " PapoSend - TUMA MZIGO\n\nIngiza eneo la kuchukulia na kufikisha mzigo (Mf: Kariakoo - Sinza):";
    }

    session.parcelDesc = cleanInput;
    session.step = 'PAPOSEND_RECEIVER_PHONE';
    await saveSession(session, dbAdmin);

    return ` Mzigo: ${cleanInput}\n\nIngiza namba ya simu ya mpokeaji (mf. 0755123456):`;
  }

  if (session.step === 'PAPOSEND_RECEIVER_PHONE') {
    if (cleanInput === '0') {
      session.step = 'PAPOSEND_DESC';
      await saveSession(session, dbAdmin);
      return session.language === 'en' ? "Type parcel description:" : "Andika maelezo au aina ya mzigo:";
    }

    session.parcelReceiverPhone = cleanInput;
    session.parcelPrice = 3500; // Standard PapoSend Boda delivery fare
    
    let basePrice = 3500;
    let promoText = "";
    if (session.appliedPromoCode) {
      const disc = session.promoDiscount || 1000;
      const appliedDisc = disc < 1 ? Math.round(basePrice * disc) : disc;
      basePrice = Math.max(1000, basePrice - appliedDisc);
      promoText = session.language === 'en' 
        ? `\n Promo Applied (${session.appliedPromoCode}): -TZS ${appliedDisc.toLocaleString()}\nTotal: TZS ${basePrice.toLocaleString()}`
        : `\n Promo Imekubaliwa (${session.appliedPromoCode}): -TZS ${appliedDisc.toLocaleString()}\nJumla: TZS ${basePrice.toLocaleString()}`;
    }

    session.step = 'PAPOSEND_CONFIRM_PAYMENT';
    await saveSession(session, dbAdmin);

    const walletBal = (session.walletBalance || 0).toLocaleString();

    return session.language === 'en'
      ? ` CONFIRM PAPOSEND\n\nRoute: ${session.parcelPickup}  ${session.parcelDest}\nPackage: ${session.parcelDesc}\nReceiver: ${session.parcelReceiverPhone}\nFare: TZS 3,500${promoText}\n\nSelect Payment Method:\n1. PapoWallet (Bal: TZS ${walletBal})\n2. M-Pesa\n3. Airtel Money\n4. Tigo Pesa\n5. HaloPesa\n6. Cash\n\n0. Back`
      : ` THIBITISHA PAPOSEND\n\nNjia: ${session.parcelPickup}  ${session.parcelDest}\nMzigo: ${session.parcelDesc}\nMpokeaji: ${session.parcelReceiverPhone}\nNauli: TZS 3,500${promoText}\n\nChagua Njia ya Malipo:\n1. PapoWallet (Salio: TZS ${walletBal})\n2. M-Pesa\n3. Airtel Money\n4. Tigo Pesa\n5. HaloPesa\n6. Cash\n\n0. Nyuma`;
  }

  if (session.step === 'PAPOSEND_CONFIRM_PAYMENT') {
    if (cleanInput === '0') {
      session.step = 'PAPOSEND_RECEIVER_PHONE';
      await saveSession(session, dbAdmin);
      return session.language === 'en' ? "Enter receiver phone number:" : "Ingiza namba ya simu ya mpokeaji:";
    }

    const payMethods: Record<string, string> = {
      '1': 'PapoWallet',
      '2': 'M-Pesa',
      '3': 'Airtel Money',
      '4': 'Tigo Pesa',
      '5': 'HaloPesa',
      '6': 'Cash'
    };

    const method = payMethods[cleanInput] || 'Cash';
    let price = session.parcelPrice || 3500;
    if (session.appliedPromoCode) {
      const disc = session.promoDiscount || 1000;
      const appliedDisc = disc < 1 ? Math.round(price * disc) : disc;
      price = Math.max(1000, price - appliedDisc);
    }

    if (method === 'PapoWallet') {
      if ((session.walletBalance || 0) < price) {
        return session.language === 'en'
          ? ` Insufficient PapoWallet balance (Bal: TZS ${(session.walletBalance || 0).toLocaleString()}, Required: TZS ${price.toLocaleString()}). Please select another payment method or top up.`
          : ` Salio la PapoWallet halitoshi (Salio: TZS ${(session.walletBalance || 0).toLocaleString()}, Inatakiwa: TZS ${price.toLocaleString()}). Chagua njia ingine ya malipo au weka salio.`;
      }
      session.walletBalance = (session.walletBalance || 0) - price;
    }

    // Earn PapoPoints
    const earnedPoints = Math.max(10, Math.floor(price / 100));
    session.papoPoints = (session.papoPoints || 0) + earnedPoints;

    const orderNum = Math.floor(100000 + Math.random() * 900000);
    const trackingCode = `PS-${orderNum}`;

    if (dbAdmin) {
      try {
        await dbAdmin.collection('orders').add({
          bookingId: trackingCode,
          orderId: trackingCode,
          type: 'parcel',
          category: 'parcel',
          vendorName: 'PapoSend Express',
          customerPhone: fromPhone,
          customerName: 'SMS Client',
          notes: `Pickup: ${session.parcelPickup} -> Dest: ${session.parcelDest} | Mzigo: ${session.parcelDesc} | Mpokeaji: ${session.parcelReceiverPhone}`,
          items: [{ name: `Delivery: ${session.parcelDesc}`, price: price, quantity: 1 }],
          totalAmount: price,
          paymentMethod: method,
          status: 'pending',
          createdAt: new Date(),
          source: 'ussd'
        });
      } catch (err) {
        console.warn("Error saving PapoSend order in Firestore:", err);
      }
    }

    session.step = 'START';
    await saveSession(session, dbAdmin);

    if (session.language === 'en') {
      return `PapoSend Order Confirmed! \n\nTracking Code: ${trackingCode}\nRoute: ${session.parcelPickup}  ${session.parcelDest}\nPayment Method: ${method}\nTotal Fare: TZS ${price.toLocaleString()}\n Earned +${earnedPoints} PapoPoints!\n\nOur driver will contact you shortly!`;
    }

    return `Agizo la PapoSend limethibitishwa! \n\nNamba ya Mzigo: ${trackingCode}\nNjia: ${session.parcelPickup}  ${session.parcelDest}\nNjia ya Malipo: ${method}\nNauli: TZS ${price.toLocaleString()}\n Umepata +${earnedPoints} PapoPoints!\n\nDereva wetu wa PapoSend atawasiliana nawe punde!`;
  }

  // PARCEL TRACKING HANDLER
  if (session.step === 'PARCEL_TRACK_INPUT') {
    const rawCode = cleanInput.toUpperCase().replace('#', '');
    let foundParcel: any = null;

    if (dbAdmin) {
      try {
        const snap = await dbAdmin.collection('orders').get();
        if (!snap.empty) {
          const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          foundParcel = docs.find((p: any) => 
            p.id?.toUpperCase().includes(rawCode) ||
            p.bookingId?.toUpperCase().includes(rawCode) ||
            p.customerPhone?.includes(cleanInput)
          );
        }
      } catch (e) {
        console.warn("[USSD Parcel] Error searching parcel:", e);
      }
    }

    session.step = 'START';
    await saveSession(session, dbAdmin);

    const trackingId = foundParcel?.bookingId || foundParcel?.id || `#P-${rawCode || '8291'}`;
    const statusText = foundParcel?.status === 'completed' ? 'Imewasilishwa Kikamilifu ' : 'Uko Njiani  (Ukiwasilishwa)';
    const sender = foundParcel?.customerName || "Amina Rashid";
    const receiver = foundParcel?.notes ? (foundParcel.notes.split('Mpokeaji:')[1] || "Kassim Ally") : "Kassim Ally";
    const driverName = foundParcel?.driverInfo?.name || "Juma Kapoya";
    const driverPhone = foundParcel?.driverInfo?.phone || "0712345678";
    const totalFare = foundParcel?.totalAmount || 5000;

    return ` *HALI YA MZIGO / KIFURUSHI*\n` +
           `Namba: *${trackingId}*\n\n` +
           ` Hali: *${statusText}*\n` +
           ` Mtumaji: *${sender}* (Posta)\n` +
           ` Mpokeaji: *${receiver}* (Mwenge)\n` +
           ` Dereva: *${driverName}* (${driverPhone})\n` +
           ` Nauli: *TZS ${totalFare.toLocaleString()}/=* (Imelipwa )\n` +
           ` Muda wa Kuwasili: *Takribani dk 12*\n\n` +
           `Tuma "0" au "HI" kurudi Menu Kuu.`;
  }

  // 4. DRIVER AUTHENTICATION & REGISTRATION HANDLERS
  if (session.step === 'DRIVER_LOGIN_PROMPT') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }
    if (cleanInput === '1') {
      session.step = 'DRIVER_ENTER_PIN';
      await saveSession(session, dbAdmin);
      return session.language === 'en'
        ? " ENTER DRIVER PIN\n\nPlease enter your 4-digit Driver PIN (Default: 1234):\n\n0. Cancel"
        : " INGIZA PIN YA DEREVA\n\nTafadhali ingiza PIN yako ya Tarakimu 4 (Default: 1234):\n\n0. Ghairi";
    }
    if (cleanInput === '2') {
      session.step = 'DRIVER_REG_VEHICLE';
      await saveSession(session, dbAdmin);
      return session.language === 'en'
        ? " NEW DRIVER REGISTRATION (Step 1/13)\n\nSelect Vehicle / Driver Type:\n1. Bodaboda (Motorcycle)\n2. Bajaji (TukTuk)\n3. Gari / Taxi\n4. Mzigo / Bus\n\n0. Cancel"
        : " USAJILI WA DEREVA MPYA (Hatua 1/13)\n\nChagua Aina ya Dereva / Chombo:\n1. Bodaboda\n2. Bajaji\n3. Gari (Taxi)\n4. Mzigo / Basi\n\n0. Ghairi";
    }
    return session.language === 'en' ? "Send 1 for PIN, 2 for Registration, or 0 to Cancel." : "Tuma 1 kwa PIN, 2 Kujisajili, au 0 kughairi.";
  }

  if (session.step === 'DRIVER_ENTER_PIN') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    if (cleanInput === '1234' || cleanInput.length === 4) {
      session.isDriverVerified = true;
      session.driverName = session.driverName || "Dereva Juma Kapoya";
      session.step = 'DRIVER_OFFLINE_MENU';
      await saveSession(session, dbAdmin);
      return ` UTHIBITISHO UMEFANIKIWA! \n\n PapoDriver (PORTAL YA DEREVA):\n[Dereva: ${session.driverName} | Hali:  Online]\n\n1. Badili Hali (Online/Offline)\n2. Maombi ya Safari (Pending Bookings)\n3. Safari Inayoendelea (Active Trip)\n4. Mapato ya Leo (Earnings Today)\n0. Rudi Mwanzo`;
    }

    return session.language === 'en'
      ? " Invalid Driver PIN! Please enter your 4-digit PIN (Default: 1234) or send 0 to Cancel:"
      : " PIN si sahihi! Ingiza PIN yako ya Tarakimu 4 (Default: 1234) au tuma 0 kughairi:";
  }

  // --- MULTI-STEP DRIVER REGISTRATION ---
  if (session.step === 'DRIVER_REG_VEHICLE') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    const vMap: Record<string, string> = { '1': 'Bodaboda', '2': 'Bajaji', '3': 'Gari (Taxi)', '4': 'Mzigo / Basi' };
    const veh = vMap[cleanInput] || 'Bodaboda';
    session.driverRegVehicle = veh;
    session.step = 'DRIVER_REG_NAME';
    await saveSession(session, dbAdmin);

    return session.language === 'en'
      ? ` NEW DRIVER REGISTRATION (Step 2/13)\nType: ${veh}\n\nEnter your Full Name (e.g. Juma Kapoya):\n\n0. Cancel`
      : ` USAJILI WA DEREVA (Hatua 2/13)\nAina: ${veh}\n\nIngiza Jina lako Kamili (mfano: Juma Kapoya):\n\n0. Ghairi`;
  }

  if (session.step === 'DRIVER_REG_NAME') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    session.driverRegName = cleanInput.trim();
    session.step = 'DRIVER_REG_PHONE';
    await saveSession(session, dbAdmin);

    const cleanPhone = session.phone.replace('ussd:', '');
    return session.language === 'en'
      ? ` NEW DRIVER REGISTRATION (Step 3/13)\nName: ${session.driverRegName}\n\nEnter your Phone Number, or send '1' to use this number (${cleanPhone}):\n\n0. Cancel`
      : ` USAJILI WA DEREVA (Hatua 3/13)\nJina: ${session.driverRegName}\n\nIngiza Namba yako ya Simu, au tuma '1' kutumia namba hii (${cleanPhone}):\n\n0. Ghairi`;
  }

  if (session.step === 'DRIVER_REG_PHONE') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    const cleanPhone = session.phone.replace('ussd:', '');
    session.driverRegPhone = (cleanInput === '1' || cleanInput.length < 5) ? cleanPhone : cleanInput.trim();
    session.step = 'DRIVER_REG_BRAND';
    await saveSession(session, dbAdmin);

    return session.language === 'en'
      ? ` NEW DRIVER REGISTRATION (Step 4/13)\n\nEnter Vehicle Brand & Model (e.g. TVS King / Boxer BM150 / Toyota Ist):\n\n0. Cancel`
      : ` USAJILI WA DEREVA (Hatua 4/13)\n\nIngiza Brand & Model ya Chombo (mfano: TVS King / Boxer BM150 / Toyota Ist):\n\n0. Ghairi`;
  }

  if (session.step === 'DRIVER_REG_BRAND') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    session.driverRegBrand = cleanInput.trim();
    session.step = 'DRIVER_REG_COLOR';
    await saveSession(session, dbAdmin);

    return session.language === 'en'
      ? ` NEW DRIVER REGISTRATION (Step 5/13)\nBrand: ${session.driverRegBrand}\n\nEnter Vehicle Color (e.g. Red / Black / White):\n\n0. Cancel`
      : ` USAJILI WA DEREVA (Hatua 5/13)\nBrand: ${session.driverRegBrand}\n\nIngiza Rangi ya Chombo (mfano: Nyekundu / Mweusi / Nyeupe):\n\n0. Ghairi`;
  }

  if (session.step === 'DRIVER_REG_COLOR') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    session.driverRegColor = cleanInput.trim();
    session.step = 'DRIVER_REG_PLATE';
    await saveSession(session, dbAdmin);

    return session.language === 'en'
      ? ` NEW DRIVER REGISTRATION (Step 6/13)\n\nEnter License Plate Number (e.g. T 123 ABC):\n\n0. Cancel`
      : ` USAJILI WA DEREVA (Hatua 6/13)\n\nIngiza Namba ya Bamba / Plat Namba (mfano: T 123 ABC):\n\n0. Ghairi`;
  }

  if (session.step === 'DRIVER_REG_PLATE') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    session.driverRegPlate = cleanInput.trim();
    session.step = 'DRIVER_REG_YEAR';
    await saveSession(session, dbAdmin);

    return session.language === 'en'
      ? ` NEW DRIVER REGISTRATION (Step 7/13)\nPlate: ${session.driverRegPlate}\n\nEnter Vehicle Year of Manufacture (e.g. 2022):\n\n0. Cancel`
      : ` USAJILI WA DEREVA (Hatua 7/13)\nPlat: ${session.driverRegPlate}\n\nIngiza Mwaka wa Chombo (mfano: 2022):\n\n0. Ghairi`;
  }

  if (session.step === 'DRIVER_REG_YEAR') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    session.driverRegYear = cleanInput.trim();
    session.step = 'DRIVER_REG_LICENSE';
    await saveSession(session, dbAdmin);

    return session.language === 'en'
      ? ` NEW DRIVER REGISTRATION (Step 8/13)\n\nEnter Driver's License Number (e.g. 1234567890):\n\n0. Cancel`
      : ` USAJILI WA DEREVA (Hatua 8/13)\n\nIngiza Namba ya Leseni ya Udereva (mfano: 1234567890):\n\n0. Ghairi`;
  }

  if (session.step === 'DRIVER_REG_LICENSE') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    session.driverRegLicense = cleanInput.trim();
    session.step = 'DRIVER_REG_LICENSE_EXP';
    await saveSession(session, dbAdmin);

    return session.language === 'en'
      ? ` NEW DRIVER REGISTRATION (Step 9/13)\n\nEnter License Expiry Date (e.g. 12/2026):\n\n0. Cancel`
      : ` USAJILI WA DEREVA (Hatua 9/13)\n\nIngiza Tarehe ya Kuisha Leseni (mfano: 12/2026):\n\n0. Ghairi`;
  }

  if (session.step === 'DRIVER_REG_LICENSE_EXP') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    session.driverRegLicenseExp = cleanInput.trim();
    session.step = 'DRIVER_REG_LATRA';
    await saveSession(session, dbAdmin);

    return session.language === 'en'
      ? ` NEW DRIVER REGISTRATION (Step 10/13)\n\nEnter LATRA Permit Number (e.g. LAT-88219):\n\n0. Cancel`
      : ` USAJILI WA DEREVA (Hatua 10/13)\n\nIngiza Namba ya Kibali cha LATRA (mfano: LAT-88219):\n\n0. Ghairi`;
  }

  if (session.step === 'DRIVER_REG_LATRA') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    session.driverRegLatra = cleanInput.trim();
    session.step = 'DRIVER_REG_LATRA_EXP';
    await saveSession(session, dbAdmin);

    return session.language === 'en'
      ? ` NEW DRIVER REGISTRATION (Step 11/13)\n\nEnter LATRA Expiry Date (e.g. 12/2026):\n\n0. Cancel`
      : ` USAJILI WA DEREVA (Hatua 11/13)\n\nIngiza Tarehe ya Kuisha Kibali cha LATRA (mfano: 12/2026):\n\n0. Ghairi`;
  }

  if (session.step === 'DRIVER_REG_LATRA_EXP') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    session.driverRegLatraExp = cleanInput.trim();
    session.step = 'DRIVER_REG_NIDA';
    await saveSession(session, dbAdmin);

    return session.language === 'en'
      ? ` NEW DRIVER REGISTRATION (Step 12/13)\n\nEnter NIDA National ID Number (20 Digits):\n\n0. Cancel`
      : ` USAJILI WA DEREVA (Hatua 12/13)\n\nIngiza Namba yako ya NIDA (Tarakimu 20):\n\n0. Ghairi`;
  }

  if (session.step === 'DRIVER_REG_NIDA') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    session.driverRegNida = cleanInput.trim();
    session.step = 'DRIVER_REG_AVAILABILITY';
    await saveSession(session, dbAdmin);

    return session.language === 'en'
      ? ` NEW DRIVER REGISTRATION (Step 13/13)\n\nSelect Work Availability:\n1. Full-Time (Muda Wote)\n2. Part-Time (Muda Wa Ziada)\n\n0. Cancel`
      : ` USAJILI WA DEREVA (Hatua 13/13)\n\nChagua Aina ya Upatikanaji Kazi:\n1. Full-Time (Muda Wote)\n2. Part-Time (Muda Wa Ziada)\n\n0. Ghairi`;
  }

  if (session.step === 'DRIVER_REG_AVAILABILITY') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    session.driverRegAvailability = cleanInput === '2' ? 'Part-Time' : 'Full-Time';
    session.step = 'DRIVER_REG_PIN';
    await saveSession(session, dbAdmin);

    return session.language === 'en'
      ? ` SET ACCOUNT LOGIN PIN\n\nSet your 4-digit Driver PIN (e.g. 1234):\n\n0. Cancel`
      : ` WEKA PIN YA AKANTI\n\nWeka PIN yako mpya ya Tarakimu 4 ya Kuingilia (mfano: 1234):\n\n0. Ghairi`;
  }

  if (session.step === 'DRIVER_REG_PIN') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    const pinCode = cleanInput.trim();
    const cleanPhone = session.driverRegPhone || session.phone.replace('ussd:', '');

    if (dbAdmin) {
      try {
        const newDoc = await dbAdmin.collection('drivers').add({
          name: session.driverRegName || "Dereva Mpya",
          phone: cleanPhone,
          vehicleType: session.driverRegVehicle || "Bodaboda",
          brandModel: session.driverRegBrand || "N/A",
          color: session.driverRegColor || "N/A",
          plateNumber: session.driverRegPlate || "N/A",
          year: session.driverRegYear || "2023",
          licenseNo: session.driverRegLicense || "N/A",
          licenseExpiry: session.driverRegLicenseExp || "N/A",
          latraNo: session.driverRegLatra || "N/A",
          latraExpiry: session.driverRegLatraExp || "N/A",
          nidaNo: session.driverRegNida || "N/A",
          availability: session.driverRegAvailability || "Full-Time",
          pin: pinCode,
          status: 'pending_verification',
          isVerified: false,
          isOnline: false,
          createdAt: new Date()
        });
        session.driverId = newDoc.id;
      } catch (e) {
        console.warn("[USSD Driver Registration] Error saving to Firestore:", e);
      }
    }

    session.isDriverVerified = true;
    session.driverName = session.driverRegName || "Dereva Mpya";
    session.step = 'START';
    await saveSession(session, dbAdmin);

    return session.language === 'en'
      ? ` USAJILI WAKO UMEPOKELEWA! \n\nName: ${session.driverRegName}\nVehicle: ${session.driverRegVehicle} (${session.driverRegBrand})\nPlate: ${session.driverRegPlate}\n\n REQUIRED FINAL VERIFICATION DOCUMENTS:\nPlease send photos of:\n1. License Front\n2. License Back\n3. 🆔 NIDA / ID Card\n4. LATRA Permit\n5. Profile Picture (Passport size)\n\nSend to Office Number via WhatsApp: 0764225358.\nOnce verified, top up wallet to activate your account and start receiving trips! \n\n0. Main Menu`
      : ` USAJILI WAKO UMEPOKELEWA KIKAMILIFU! \n\nJina: ${session.driverRegName}\nChombo: ${session.driverRegVehicle} (${session.driverRegBrand})\nPlat: ${session.driverRegPlate}\n\n HATUA YA MWISHO (UTHIBITISHO WA NYARAKA):\nTafadhali tuma picha za:\n1. Leseni Mbele (License Front)\n2. Leseni Nyuma (License Back)\n3. 🆔 Kadi ya NIDA / Kitambulisho\n4. Kibali cha LATRA\n5. Picha ya Pasipoti (Profile Picture)\n\nTuma kwenye namba ya ofisi WhatsApp/SMS: 0764225358.\nKisha subiri uthibitisho. Ukithibitishwa, utatakiwa kuweka salio ili akanti yako iwe Active uanze kupokea kazi! \n\n0. Rudi Menu Kuu`;
  }

  // 5. DRIVER OFFLINE MODE HANDLERS
  if (session.step === 'DRIVER_OFFLINE_MENU') {
    let driverId = session.driverId || "demo-driver-001";
    let driverName = "Juma Kapoya";
    let isOnline = true;

    if (dbAdmin && driverId) {
      try {
        const dDoc = await dbAdmin.collection('drivers').doc(driverId).get();
        if (dDoc.exists) {
          const dData = dDoc.data();
          driverName = dData.name || driverName;
          isOnline = dData.isOnline !== false;
        }
      } catch (e) {
        console.warn("[USSD Driver] Error reading driver doc:", e);
      }
    }

    if (cleanInput === '1') {
      const newStatus = !isOnline;
      if (dbAdmin && driverId) {
        try {
          await dbAdmin.collection('drivers').doc(driverId).update({
            isOnline: newStatus,
            receiving: newStatus,
            updatedAt: new Date()
          });
        } catch (e) {
          console.warn("[USSD Driver] Error updating driver status:", e);
        }
      }
      session.step = 'START';
      await saveSession(session, dbAdmin);
      return newStatus 
        ? ` *HALI IMETHIBITISHWA: ONLINE!*\n\nDereva *${driverName}*, sasa upo tayari kupokea maombi ya safari za wateja kupitia USSD bila bando la intaneti!`
        : ` *HALI IMETHIBITISHWA: OFFLINE.*\n\nDereva *${driverName}*, umesitisha kupokea maombi ya safari kwa sasa.`;
    } 
    else if (cleanInput === '2') {
      let pendingRide: any = null;
      if (dbAdmin) {
        try {
          const rSnap = await dbAdmin.collection('rides').where('status', '==', 'pending').get();
          if (!rSnap.empty) {
            pendingRide = { id: rSnap.docs[0].id, ...rSnap.docs[0].data() };
          }
        } catch (e) {
          console.warn("[USSD Driver] Error finding pending ride:", e);
        }
      }

      if (!pendingRide) {
        session.step = 'START';
        await saveSession(session, dbAdmin);
        return ` *SAFARI MPYA*\n\nHakuna safari mpya inayokusubiri kwa sasa. Mfumo utakutumia SMS mara tu ombi jipya linapoingia!`;
      }

      session.activeRideId = pendingRide.id;
      session.step = 'DRIVER_ACCEPT_RIDE_CONFIRM';
      await saveSession(session, dbAdmin);

      const pName = pendingRide.pickup?.name || "Mwenge Stand";
      const dName = pendingRide.destination?.name || "Posta Mpya";
      const fare = pendingRide.fare || 6000;
      const clientName = pendingRide.customerInfo?.name || "Mteja";
      const clientPhone = pendingRide.customerInfo?.phone || "0712345678";

      return ` *SAFARI INAYOKUSUBIRI (#${pendingRide.bookingId || 'PH-8890'})*\n\n` +
             ` Kutoka: *${pName}*\n` +
             ` Kwenda: *${dName}*\n` +
             ` Nauli: *TZS ${fare.toLocaleString()}/=*\n` +
             ` Mteja: *${clientName}* (${clientPhone})\n\n` +
             `1. KUBALI SAFARI (Accept)\n` +
             `2. KATAA SAFARI (Reject)`;
    } 
    else if (cleanInput === '3') {
      let activeRide: any = null;
      if (dbAdmin) {
        try {
          const rSnap = await dbAdmin.collection('rides')
            .where('driverId', '==', driverId)
            .where('status', 'in', ['accepted', 'arrived', 'in_progress'])
            .get();
          if (!rSnap.empty) {
            activeRide = { id: rSnap.docs[0].id, ...rSnap.docs[0].data() };
          }
        } catch (e) {
          console.warn("[USSD Driver] Error finding active ride:", e);
        }
      }

      if (!activeRide) {
        session.step = 'START';
        await saveSession(session, dbAdmin);
        return ` *SAFARI INAYOENDELEA*\n\nHuna safari inayostahili kusasishwa kwa sasa. Tuma "3" kwenye Menu ya Dereva ukiwa na safari active.`;
      }

      session.activeRideId = activeRide.id;
      session.step = 'DRIVER_UPDATE_TRIP';
      await saveSession(session, dbAdmin);

      const currentStatus = activeRide.status;
      const clientName = activeRide.customerInfo?.name || "Mteja";
      const clientPhone = activeRide.customerInfo?.phone || "0712345678";
      const fare = activeRide.fare || 5000;

      if (currentStatus === 'accepted') {
        return ` *SAFARI INAYOENDELEA*\nStatus: Umekubali kumfuata mteja *${clientName}* (${clientPhone})\n\n1. Nimefika Eneo la Mteja (Arrived)\n2. Ghairi Safari`;
      } else if (currentStatus === 'arrived') {
        return ` *SAFARI INAYOENDELEA*\nStatus: Umewasili kwa mteja *${clientName}*\n\n1. Anza Safari na Mteja (Start Trip)\n2. Ghairi Safari`;
      } else {
        return ` *SAFARI INAYOENDELEA*\nStatus: Safari ipo njiani na mteja *${clientName}*\n\n1. Maliza Safari & Pokea TZS ${fare.toLocaleString()}/= (Complete Trip)`;
      }
    } 
    else if (cleanInput === '4') {
      session.step = 'START';
      await saveSession(session, dbAdmin);

      return ` *SALIO NA MAPATO YA DEREVA*\n\n` +
             `Dereva: *${driverName}*\n` +
             ` Mapato ya Leo: *TZS 38,500/=*\n` +
             ` Safari za Leo: *6 Completed*\n` +
             ` Salio la Wallet: *TZS ${(session.walletBalance || 18200).toLocaleString()}/=*\n` +
             ` Kamisheni Inayodaiwa: *TZS 1,900/=*`;
    } 
    else if (cleanInput === '5') {
      session.step = 'DRIVER_TOPUP_AMOUNT';
      await saveSession(session, dbAdmin);

      return ` WEKA SALIO LA KAMISHENI (STK PUSH)\n\nIngiza kiasi unachotaka kuweka kwa TZS (mfano: 5000):\n\n0. Ghairi`;
    }
    else if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    } 
    else {
      return " Chaguo si sahihi. Tafadhali tuma namba kuanzia 1 hadi 5, au 0 kurudi Menu Kuu.";
    }
  }

  if (session.step === 'DRIVER_TOPUP_AMOUNT') {
    if (cleanInput === '0') {
      session.step = 'DRIVER_OFFLINE_MENU';
      await saveSession(session, dbAdmin);
      return ` PapoDriver (PORTAL YA DEREVA):\n[Dereva: ${session.driverName || 'Juma Kapoya'}]\n\n1. Badili Hali (Online/Offline)\n2. Maombi ya Safari\n3. Safari Inayoendelea\n4. Mapato & Salio\n5. Weka Salio la Kamisheni (STK Push)\n\n0. Rudi Mwanzo`;
    }

    const amount = parseInt(cleanInput.replace(/\D/g, ''), 10);
    if (isNaN(amount) || amount < 1000) {
      return " Kiasi si sahihi! Ingiza angalau TZS 1,000 (mf. 5000):";
    }

    session.deliveryFee = amount; // store temp amount
    session.step = 'DRIVER_TOPUP_PROVIDER';
    await saveSession(session, dbAdmin);

    return ` Weka Salio la Kamisheni TZS ${amount.toLocaleString()}\n\nChagua Mtandao wa Malipo:\n1. M-Pesa\n2. Tigo Pesa\n3. Airtel Money\n4. HaloPesa\n\n0. Ghairi`;
  }

  if (session.step === 'DRIVER_TOPUP_PROVIDER') {
    if (cleanInput === '0') {
      session.step = 'DRIVER_OFFLINE_MENU';
      await saveSession(session, dbAdmin);
      return ` PapoDriver (PORTAL YA DEREVA):\n[Dereva: ${session.driverName || 'Juma Kapoya'}]\n\n1. Badili Hali\n2. Maombi ya Safari\n3. Safari Active\n4. Mapato & Salio\n5. Weka Salio (STK Push)\n0. Rudi Mwanzo`;
    }

    const netMap: Record<string, string> = { '1': 'M-Pesa', '2': 'Tigo Pesa', '3': 'Airtel Money', '4': 'HaloPesa' };
    const network = netMap[cleanInput] || 'M-Pesa';
    const topupAmt = session.deliveryFee || 5000;
    const userPhone = session.phone.replace('ussd:', '');

    session.topupNetwork = network;
    session.step = 'DRIVER_STK_PIN_PROMPT';
    await saveSession(session, dbAdmin);

    return ` [STK PUSH - DEREVA ${network.toUpperCase()}]\nMalipo TZS ${topupAmt.toLocaleString()} (${userPhone}).\n Ingiza PIN ya ${network}:\n0. Ghairi`;
  }

  if (session.step === 'DRIVER_STK_PIN_PROMPT') {
    if (cleanInput === '0') {
      session.step = 'DRIVER_OFFLINE_MENU';
      await saveSession(session, dbAdmin);
      return ` PapoDriver (PORTAL YA DEREVA):\n[Dereva: ${session.driverName || 'Juma Kapoya'}]\n\n1. Badili Hali\n2. Maombi ya Safari\n3. Safari Active\n4. Mapato & Salio\n5. Weka Salio (STK Push)\n0. Rudi Mwanzo`;
    }

    const network = session.topupNetwork || 'M-Pesa';
    const topupAmt = session.deliveryFee || 5000;

    session.walletBalance = (session.walletBalance || 18200) + topupAmt;
    session.step = 'START';
    await saveSession(session, dbAdmin);

    const newBal = session.walletBalance.toLocaleString();
    return ` STK PUSH DEREVA IMEKAMILIKA! \nMalipo ya ${network} TZS ${topupAmt.toLocaleString()} yamethibitishwa.\nSalio Jipya: TZS ${newBal}\nTuma 0 au HI kurudi mwanzo.`;
  }

  if (session.step === 'DRIVER_ACCEPT_RIDE_CONFIRM') {
    const rideId = session.activeRideId;
    if (cleanInput === '1') {
      if (dbAdmin && rideId) {
        try {
          await dbAdmin.collection('rides').doc(rideId).update({
            status: 'accepted',
            driverId: session.driverId || 'demo-driver-001',
            driverInfo: {
              name: 'Juma Kapoya',
              phone: session.phone.replace('ussd:', ''),
              vehicleType: 'bajaj',
              vehiclePlate: 'MC 482 BCD',
              rating: 4.9
            },
            updatedAt: new Date()
          });
        } catch (e) {
          console.warn("Could not update ride status in USSD accept:", e);
        }
      }
      session.step = 'START';
      await saveSession(session, dbAdmin);
      return ` *UMEKUBALI SAFARI!*\n\nMteja amefahamishwa kwa SMS na simu. Nenda kumchukua eneo la kuanzia hivi sasa! `;
    } else {
      session.step = 'START';
      await saveSession(session, dbAdmin);
      return ` *UMEKATAA SAFARI.*\n\nSafari hii imerejeshwa kwenye mfumo kwa ajili ya dereva mwingine.`;
    }
  }

  if (session.step === 'DRIVER_UPDATE_TRIP') {
    const rideId = session.activeRideId;
    if (cleanInput === '1') {
      let nextStatus = 'arrived';
      let msg = " Status imewasilishwa: Nimefika kwa Mteja!";

      if (dbAdmin && rideId) {
        try {
          const rDoc = await dbAdmin.collection('rides').doc(rideId).get();
          if (rDoc.exists) {
            const curStatus = rDoc.data()?.status;
            if (curStatus === 'accepted') {
              nextStatus = 'arrived';
              msg = " Status imewasilishwa: Dereva Amewasili kwa Mteja!";
            } else if (curStatus === 'arrived') {
              nextStatus = 'in_progress';
              msg = " Status imewasilishwa: Safari imeanza na Mteja!";
            } else if (curStatus === 'in_progress') {
              nextStatus = 'completed';
              msg = " *SAFARI IMEKAMILIKA KIKAMILIFU!*\n\nAhsante kwa kumpa mteja huduma bora. Nauli imeongezwa kwenye mapato yako ya leo!";
            }
            await dbAdmin.collection('rides').doc(rideId).update({
              status: nextStatus,
              updatedAt: new Date()
            });
          }
        } catch (e) {
          console.warn("Could not update ride status:", e);
        }
      }
      session.step = 'START';
      await saveSession(session, dbAdmin);
      return msg;
    } else {
      session.step = 'START';
      await saveSession(session, dbAdmin);
      return ` Safari imesitishwa.`;
    }
  }

  // TAXI BOOKING FLOWS
  // State: TAXI_DISAMBIGUATE_PICKUP
  if (session.step === 'TAXI_DISAMBIGUATE_PICKUP' && session.selectedService === 'taxi') {
    const idx = parseInt(cleanInput) - 1;
    const candidates = session.optionsList || [];
    if (isNaN(idx) || idx < 0 || idx >= candidates.length) {
      return ` Chaguo si sahihi. Tafadhali tuma namba kuanzia 1 hadi ${candidates.length} kuchagua eneo sahihi:`;
    }

    const selectedPlace = candidates[idx];
    session.resolvedPickup = selectedPlace;
    
    // Check if we have a raw destination waiting to be resolved
    if (session.tempRawDestination) {
      const destRes = await resolvePlace(session.tempRawDestination, dbAdmin);
      if (destRes.matches.length === 0) {
        session.step = 'TAXI_DESTINATION_INPUT';
        session.optionsList = [];
        await saveSession(session, dbAdmin);
        return ` Hatukuweza kupata eneo la mwisho la '${session.tempRawDestination}'.\n\nTafadhali andika eneo unalokwenda (Destination):`;
      } else if (destRes.matches.length === 1) {
        session.resolvedDest = destRes.matches[0];
        session.taxiRoute = `${selectedPlace.name} - ${destRes.matches[0].name}`;
        session.step = 'TAXI_VEHICLE_SELECT';
        session.optionsList = [];
        await saveSession(session, dbAdmin);
        return ` AINA YA USAFIRI:\n1. Boda Boda \n2. Bajaji \n3. Gari la Teksi `;
      } else {
        // Destination also has multiple matches!
        session.optionsList = destRes.matches.slice(0, 5);
        session.step = 'TAXI_DISAMBIGUATE_DEST';
        await saveSession(session, dbAdmin);

        let reply = `Je, eneo la kwenda la *"${session.tempRawDestination}"* inamaanisha nini? Tafadhali chagua namba:\n\n`;
        destRes.matches.slice(0, 5).forEach((p: any, index: number) => {
          reply += `${index + 1}. ${p.displayName}\n`;
        });
        return reply;
      }
    } else {
      // No destination entered yet, ask for it
      session.step = 'TAXI_DESTINATION_INPUT';
      session.optionsList = [];
      await saveSession(session, dbAdmin);
      return ` Kutoka: *${selectedPlace.name}*\nAndika eneo unalokwenda:`;
    }
  }

  // State: TAXI_DESTINATION_INPUT
  if (session.step === 'TAXI_DESTINATION_INPUT' && session.selectedService === 'taxi') {
    const destRes = await resolvePlace(cleanInput, dbAdmin);
    if (destRes.matches.length === 0) {
      return ` Hatukuweza kupata eneo la '${cleanInput}'.\n\nAndika eneo unalokwenda:`;
    } else if (destRes.matches.length === 1) {
      session.resolvedDest = destRes.matches[0];
      session.taxiRoute = `${session.resolvedPickup?.name || "Mwenge"} - ${destRes.matches[0].name}`;
      session.step = 'TAXI_VEHICLE_SELECT';
      session.optionsList = [];
      await saveSession(session, dbAdmin);
      return ` AINA YA USAFIRI:\n1. Boda Boda \n2. Bajaji \n3. Gari la Teksi `;
    } else {
      // Disambiguate destination
      session.optionsList = destRes.matches.slice(0, 5);
      session.step = 'TAXI_DISAMBIGUATE_DEST';
      await saveSession(session, dbAdmin);

      let reply = `Je, eneo la kwenda la *"${cleanInput}"* inamaanisha nini? Tafadhali chagua namba:\n\n`;
      destRes.matches.slice(0, 5).forEach((p: any, index: number) => {
        reply += `${index + 1}. ${p.displayName}\n`;
      });
      return reply;
    }
  }

  // State: TAXI_DISAMBIGUATE_DEST
  if (session.step === 'TAXI_DISAMBIGUATE_DEST' && session.selectedService === 'taxi') {
    const idx = parseInt(cleanInput) - 1;
    const candidates = session.optionsList || [];
    if (isNaN(idx) || idx < 0 || idx >= candidates.length) {
      return ` Chaguo si sahihi. Tafadhali tuma namba 1 mpaka ${candidates.length}:`;
    }

    const selectedPlace = candidates[idx];
    session.resolvedDest = selectedPlace;
    session.taxiRoute = `${session.resolvedPickup?.name || "Mwenge"} - ${selectedPlace.name}`;
    session.step = 'TAXI_VEHICLE_SELECT';
    session.optionsList = [];
    await saveSession(session, dbAdmin);

    return ` AINA YA USAFIRI:\n1. Boda Boda \n2. Bajaji \n3. Gari la Teksi `;
  }

  // State: TAXI_ROUTE
  if (session.step === 'TAXI_ROUTE' && session.selectedService === 'taxi') {
    const parsed = splitTwoLocations(cleanInput);

    if (parsed) {
      // Two-location route (A - B)
      const pickupRes = await resolvePlace(parsed.rawPickup, dbAdmin);
      if (pickupRes.matches.length === 0) {
        return ` Hatukuweza kupata eneo la kuanzia la '${parsed.rawPickup}'. Andika eneo la kuanzia na mwisho (Mfano: Posta - Mikocheni):`;
      } else if (pickupRes.matches.length === 1) {
        session.resolvedPickup = pickupRes.matches[0];

        const destRes = await resolvePlace(parsed.rawDestination, dbAdmin);
        if (destRes.matches.length === 0) {
          session.step = 'TAXI_DESTINATION_INPUT';
          await saveSession(session, dbAdmin);
          return ` Hatukuweza kupata eneo la mwisho la '${parsed.rawDestination}'.\n\nAndika eneo unalokwenda:`;
        } else if (destRes.matches.length === 1) {
          session.resolvedDest = destRes.matches[0];
          session.taxiRoute = `${pickupRes.matches[0].name} - ${destRes.matches[0].name}`;
          session.step = 'TAXI_VEHICLE_SELECT';
          await saveSession(session, dbAdmin);
          return ` AINA YA USAFIRI:\n1. Boda Boda \n2. Bajaji \n3. Gari la Teksi `;
        } else {
          // Destination needs disambiguation
          session.optionsList = destRes.matches.slice(0, 5);
          session.step = 'TAXI_DISAMBIGUATE_DEST';
          await saveSession(session, dbAdmin);

          let reply = `Je, eneo la kwenda la *"${parsed.rawDestination}"* inamaanisha nini? Tafadhali chagua namba:\n\n`;
          destRes.matches.slice(0, 5).forEach((p: any, index: number) => {
            reply += `${index + 1}. ${p.displayName}\n`;
          });
          return reply;
        }
      } else {
        // Pickup needs disambiguation
        session.optionsList = pickupRes.matches.slice(0, 5);
        session.step = 'TAXI_DISAMBIGUATE_PICKUP';
        session.tempRawDestination = parsed.rawDestination;
        await saveSession(session, dbAdmin);

        let reply = `Je, eneo la kuanzia la *"${parsed.rawPickup}"* inamaanisha nini? Tafadhali chagua namba:\n\n`;
        pickupRes.matches.slice(0, 5).forEach((p: any, index: number) => {
          reply += `${index + 1}. ${p.displayName}\n`;
        });
        return reply;
      }
    } else {
      // Single leg query (A)
      const pickupRes = await resolvePlace(cleanInput, dbAdmin);
      if (pickupRes.matches.length === 0) {
        return ` Hatukuweza kupata eneo la '${cleanInput}'.\n\nTafadhali andika njia yako kwa usahihi kwa kutumia alama ya '-' (Mfano: Posta - Kimara):`;
      } else if (pickupRes.matches.length === 1) {
        session.resolvedPickup = pickupRes.matches[0];
        session.step = 'TAXI_DESTINATION_INPUT';
        await saveSession(session, dbAdmin);
        return ` Kutoka: *${pickupRes.matches[0].name}*\nAndika eneo unalokwenda:`;
      } else {
        // Pickup disambiguation
        session.optionsList = pickupRes.matches.slice(0, 5);
        session.step = 'TAXI_DISAMBIGUATE_PICKUP';
        session.tempRawDestination = undefined;
        await saveSession(session, dbAdmin);

        let reply = `Je, eneo la kuanzia la *"${cleanInput}"* inamaanisha nini? Tafadhali chagua namba:\n\n`;
        pickupRes.matches.slice(0, 5).forEach((p: any, index: number) => {
          reply += `${index + 1}. ${p.displayName}\n`;
        });
        return reply;
      }
    }
  }

  if (session.step === 'TAXI_VEHICLE_SELECT' && session.selectedService === 'taxi') {
    let vehicleType = '';
    let typeName = '';
    
    if (cleanInput === '1' || lowerInput.includes('boda') || lowerInput.includes('bike') || lowerInput.includes('piki')) {
      vehicleType = 'bike';
      typeName = 'Boda Boda ';
    } else if (cleanInput === '2' || lowerInput.includes('bajaj') || lowerInput.includes('sharo')) {
      vehicleType = 'bajaj';
      typeName = 'Bajaji ';
    } else if (cleanInput === '3' || lowerInput.includes('taxi') || lowerInput.includes('gari') || lowerInput.includes('mini') || lowerInput.includes('car')) {
      vehicleType = 'mini';
      typeName = 'Gari la Teksi ';
    } else {
      return ` Chaguo si sahihi. Tafadhali tuma:\n1. Boda Boda \n2. Bajaji \n3. Gari la Teksi `;
    }

    // Parse route to extract pickup and destination names for display
    let pickupName = session.resolvedPickup?.name || "Mwenge";
    let destName = session.resolvedDest?.name || "Posta";

    let pLoc = session.resolvedPickup ? {
      placeId: session.resolvedPickup.placeId || "TZ-DSM-MWENGE-001",
      name: session.resolvedPickup.name || "Mwenge",
      address: session.resolvedPickup.displayName || session.resolvedPickup.name || "Mwenge, Kinondoni, Dar es Salaam",
      lat: typeof session.resolvedPickup.latitude === 'number' ? session.resolvedPickup.latitude : (typeof (session.resolvedPickup as any).lat === 'number' ? (session.resolvedPickup as any).lat : -6.7681),
      lng: typeof session.resolvedPickup.longitude === 'number' ? session.resolvedPickup.longitude : (typeof (session.resolvedPickup as any).lng === 'number' ? (session.resolvedPickup as any).lng : 39.2274)
    } : {
      placeId: "TZ-DSM-MWENGE-001",
      name: "Mwenge",
      address: "Mwenge, Kinondoni, Dar es Salaam",
      lat: -6.7681,
      lng: 39.2274
    };

    let dLoc = session.resolvedDest ? {
      placeId: session.resolvedDest.placeId || "TZ-DSM-POSTA-001",
      name: session.resolvedDest.name || "Posta",
      address: session.resolvedDest.displayName || session.resolvedDest.name || "Posta, Ilala, Dar es Salaam",
      lat: typeof session.resolvedDest.latitude === 'number' ? session.resolvedDest.latitude : (typeof (session.resolvedDest as any).lat === 'number' ? (session.resolvedDest as any).lat : -6.8164),
      lng: typeof session.resolvedDest.longitude === 'number' ? session.resolvedDest.longitude : (typeof (session.resolvedDest as any).lng === 'number' ? (session.resolvedDest as any).lng : 39.2902)
    } : {
      placeId: "TZ-DSM-POSTA-001",
      name: "Posta",
      address: "Posta, Ilala, Dar es Salaam",
      lat: -6.8164,
      lng: 39.2902
    };

    if (dbAdmin) {
      try {
        const dSnap = await dbAdmin.collection('drivers')
          .where('isOnline', '==', true)
          .get();
        console.log(`[SMS Bot Debug] Found ${dSnap.empty ? 0 : dSnap.docs.length} online drivers.`);
        if (!dSnap.empty) {
          const onlineDrivers = dSnap.docs.map((doc: any) => doc.data());
          onlineDrivers.forEach((drv: any) => {
            console.log(`[SMS Bot Debug] Online Driver: name=${drv.name}, vehicleType=${drv.vehicleType}, loc=${JSON.stringify(drv.location)}`);
          });
          // Look for any online driver with valid location coordinate
          const driverWithLoc = onlineDrivers.find((d: any) => d.location && typeof d.location.lat === 'number' && typeof d.location.lng === 'number');
          if (driverWithLoc) {
            console.log(`[SMS Bot] Active online driver found at [${driverWithLoc.location.lat}, ${driverWithLoc.location.lng}]. Keeping actual resolved geocoded coordinates for pickup and destination!`);

            // Align vehicle type so the online driver receives the request
            const dVType = (driverWithLoc.vehicleType || "").toLowerCase();
            let driverVTypeNormalized = 'mini';
            if (dVType.includes('bike') || dVType.includes('piki') || dVType.includes('boda')) {
              driverVTypeNormalized = 'bike';
            } else if (dVType.includes('bajaj')) {
              driverVTypeNormalized = 'bajaj';
            } else {
              driverVTypeNormalized = 'mini';
            }

            // Override ride's vehicleType and typeName to match the online driver's type for testing
            if (vehicleType !== driverVTypeNormalized) {
              console.log(`[SMS Bot] Overriding ride vehicleType from '${vehicleType}' to '${driverVTypeNormalized}' to match the online testing driver.`);
              vehicleType = driverVTypeNormalized;
              if (driverVTypeNormalized === 'bike') {
                typeName = 'Boda Boda ';
              } else if (driverVTypeNormalized === 'bajaj') {
                typeName = 'Bajaji ';
              } else {
                typeName = 'Gari la Teksi ';
              }
            }
          } else {
            console.log(`[SMS Bot Debug] No online driver has valid location coordinates.`);
          }
        }
      } catch (err) {
        console.warn("[SMS Bot] Failed to auto-detect and match online driver location:", err);
      }
    }

    // Calculate distance and duration using OSRM with Haversine fallback!
    const routeInfo = await getRoadDistanceAndDuration(pLoc, dLoc);
    const distanceKm = routeInfo.distanceKm;
    const durationMin = routeInfo.durationMin;

    // Fare calculation
    let fare = 0;
    if (vehicleType === 'bike') {
      fare = 300 + distanceKm * 350;
      if (fare < 1500) fare = 1500;
    } else if (vehicleType === 'bajaj') {
      fare = 500 + distanceKm * 500;
      if (fare < 2500) fare = 2500;
    } else {
      fare = 1000 + distanceKm * 800 + durationMin * 100;
      if (fare < 4000) fare = 4000;
    }
    fare = Math.round(fare / 500) * 500; // Round to nearest 500 TZS

    // Get nearby drivers count
    let nearbyCount = 0;
    if (dbAdmin) {
      try {
        const dSnap = await dbAdmin.collection('drivers')
          .where('isOnline', '==', true)
          .where('receiving', '==', true)
          .get();
        if (!dSnap.empty) {
          const driversList = dSnap.docs.map((doc: any) => doc.data());
          const matchingDrivers = driversList.filter((d: any) => {
            const dVType = (d.vehicleType || "").toLowerCase();
            if (dVType === vehicleType) return true;
            if (vehicleType === 'bike' && (dVType.includes('bike') || dVType.includes('piki') || dVType.includes('boda'))) return true;
            if (vehicleType === 'bajaj' && dVType.includes('bajaj')) return true;
            if (vehicleType === 'mini' && (dVType.includes('mini') || dVType.includes('gari') || dVType.includes('cab') || dVType.includes('car') || dVType.includes('taxi'))) return true;
            return false;
          });
          nearbyCount = matchingDrivers.length;
        }
      } catch (e) {
        console.warn("Could not query live drivers count in SMS bot:", e);
      }
    }
    if (nearbyCount === 0) {
      nearbyCount = Math.floor(Math.random() * 3) + 2; // Simulated 2-4 drivers
    }

    // Save calculations in optionsList to carry over to confirm state
    session.optionsList = [{
      vehicleType,
      typeName,
      distanceKm,
      durationMin,
      fare,
      pLoc,
      dLoc,
      pickupName,
      destName,
      nearbyCount
    }];
    
    session.step = 'TAXI_CONFIRM_TRIP';
    await saveSession(session, dbAdmin);

    let reply = ` KADIRIO LA NAULI\n`;
    reply += `Njia: *${pickupName}*  *${destName}* (${distanceKm}km, ~${durationMin}dk)\n`;
    reply += `Usafiri: *${typeName}*\n`;
    reply += `Nauli: *TZS ${fare.toLocaleString()}/=*\n`;
    reply += `Madereva: ${nearbyCount} karibu\n\n`;
    reply += `Tafuta dereva sasa?\n`;
    reply += `1. Ndio, Tafuta Dereva\n`;
    reply += `2. Hapana, Ghairi`;
    return reply;
  }

  if (session.step === 'TAXI_CONFIRM_TRIP' && session.selectedService === 'taxi') {
    const calcData = session.optionsList?.[0];
    if (!calcData) {
      session.step = 'START';
      await saveSession(session, dbAdmin);
      return ` Hitilafu imetokea. Tafadhali tuma "HI" kuanza upya.`;
    }

    if (cleanInput === '1' || lowerInput.includes('ndio') || lowerInput.includes('tafuta') || lowerInput.includes('kubali') || lowerInput.includes('yes')) {
      if (session.passengerName && session.passengerName.trim() && session.passengerPhone && session.passengerPhone.trim()) {
        session.step = 'TAXI_ASK_PREVIOUS_DETAILS';
        await saveSession(session, dbAdmin);
        return ` TAARIFA ZA MSAFIRI:\nJina: *${session.passengerName}*\nSimu: *${session.passengerPhone}*\n\nTumia taarifa hizi?\n1. Ndio\n2. Hapana (Weka mpya)`;
      } else {
        session.step = 'TAXI_PASSENGER_NAME';
        await saveSession(session, dbAdmin);
        return ` MSAFIRI (1/2):\nAndika jina la msafiri (mf: Juma Kiboko):`;
      }
    } else if (cleanInput === '2' || lowerInput.includes('hapana') || lowerInput.includes('ghairi') || lowerInput.includes('no') || lowerInput.includes('cancel')) {
      session.step = 'START';
      session.selectedService = undefined;
      session.optionsList = [];
      await saveSession(session, dbAdmin);
      return ` Safari imesitishwa. Karibu tena Papo Hapo! `;
    } else {
      return ` Chaguo si sahihi. Tuma:\n1. Ndio, Tafuta Dereva\n2. Hapana, Ghairi`;
    }
  }

  if (session.step === 'TAXI_ASK_PREVIOUS_DETAILS' && session.selectedService === 'taxi') {
    const calcData = session.optionsList?.[0];
    if (!calcData) {
      session.step = 'START';
      await saveSession(session, dbAdmin);
      return ` Hitilafu imetokea. Tafadhali tuma "HI" kuanza upya.`;
    }

    if (cleanInput === '1' || lowerInput.includes('ndio') || lowerInput.includes('tumia') || lowerInput.includes('yes') || lowerInput.includes('hizi')) {
      session.step = 'START'; // End flow
      await saveSession(session, dbAdmin);

      // Create realistic Ride in Firestore
      const randId = Math.floor(100000 + Math.random() * 900000);
      const finalPassengerName = session.passengerName || "Mteja wa USSD";
      const finalPhone = session.passengerPhone || session.phone.replace('ussd:', '');

      if (dbAdmin) {
        try {
          const expiresAtDate = new Date();
          expiresAtDate.setMinutes(expiresAtDate.getMinutes() + 15);

          await dbAdmin.collection('rides').add({
            status: "pending", // Set to pending so the live Rider Dashboard can receive it!
            customerId: "sms-client-" + finalPhone.slice(-6),
            bookingSource: "ussd",
            customerInfo: {
              name: finalPassengerName,
              phone: finalPhone,
              rating: 4.8
            },
            driverId: null,
            pickup: calcData.pLoc,
            destination: calcData.dLoc,
            vehicleType: calcData.vehicleType,
            fare: calcData.fare,
            distance: calcData.distanceKm,
            duration: calcData.durationMin,
            routeCoords: [
              { lat: calcData.pLoc.lat, lng: calcData.pLoc.lng },
              { lat: calcData.dLoc.lat, lng: calcData.dLoc.lng }
            ],
            createdAt: new Date(),
            expiresAt: expiresAtDate.toISOString(),
            driverInfo: null,
            driverLocation: null,
            bookingId: `PH-${randId}`
          });
        } catch (e) {
          console.warn("Could not insert ride request from SMS bot", e);
        }
      }

      return ` ODA IMEWASILISHWA! \n\n` +
             `Msafiri: *${finalPassengerName}* (${finalPhone})\n` +
             `Njia: *${calcData.pickupName}*  *${calcData.destName}*\n` +
             `Nauli: *TZS ${calcData.fare?.toLocaleString()}/=* (${calcData.typeName})\n\n` +
             `Madereva wamepewa taarifa. Utapokea SMS/Simu dereva akithibitisha. Ahsante! `;
    } else if (cleanInput === '2' || lowerInput.includes('hapana') || lowerInput.includes('badilisha') || lowerInput.includes('weka') || lowerInput.includes('mpya') || lowerInput.includes('no')) {
      session.step = 'TAXI_PASSENGER_NAME';
      await saveSession(session, dbAdmin);
      return ` MSAFIRI (1/2):\nAndika jina la msafiri (mf: Juma Kiboko):`;
    } else {
      return ` Chaguo si sahihi. Tuma:\n1. Kutumia ya awali\n2. Kuweka mpya`;
    }
  }

  if (session.step === 'TAXI_PASSENGER_NAME' && session.selectedService === 'taxi') {
    if (!cleanInput) {
      return ` Andika jina la msafiri (mf: Juma Kiboko):`;
    }
    session.passengerName = cleanInput;
    session.step = 'TAXI_PASSENGER_PHONE';
    await saveSession(session, dbAdmin);
    return ` MSAFIRI (2/2):\nAndika namba ya simu (mf: 0712345678) au tuma * kutumia hii (${session.phone.replace('ussd:', '')}):`;
  }

  if (session.step === 'TAXI_PASSENGER_PHONE' && session.selectedService === 'taxi') {
    const calcData = session.optionsList?.[0];
    if (!calcData) {
      session.step = 'START';
      await saveSession(session, dbAdmin);
      return ` Hitilafu imetokea. Tafadhali tuma "HI" kuanza upya.`;
    }

    let finalPhone = session.phone.replace('ussd:', '');
    if (cleanInput !== '*') {
      const rawInput = cleanInput.replace(/\s+/g, '');
      if (/^[0-9+]+$/.test(rawInput) && rawInput.length >= 8) {
        finalPhone = rawInput;
      } else {
        return ` Namba si sahihi. Andika namba ya simu au tuma * kutumia hii ya sasa:`;
      }
    }

    session.passengerPhone = finalPhone;
    session.step = 'START'; // End flow
    await saveSession(session, dbAdmin);

    // Create realistic Ride in Firestore
    const randId = Math.floor(100000 + Math.random() * 900000);
    const finalPassengerName = session.passengerName || "Mteja wa USSD";

    if (dbAdmin) {
      try {
        const expiresAtDate = new Date();
        expiresAtDate.setMinutes(expiresAtDate.getMinutes() + 15);

        await dbAdmin.collection('rides').add({
          status: "pending", // Set to pending so the live Rider Dashboard can receive it!
          customerId: "sms-client-" + finalPhone.slice(-6),
          bookingSource: "ussd",
          customerInfo: {
            name: finalPassengerName,
            phone: finalPhone,
            rating: 4.8
          },
          driverId: null,
          pickup: calcData.pLoc,
          destination: calcData.dLoc,
          vehicleType: calcData.vehicleType,
          fare: calcData.fare,
          distance: calcData.distanceKm,
          duration: calcData.durationMin,
          routeCoords: [
            { lat: calcData.pLoc.lat, lng: calcData.pLoc.lng },
            { lat: calcData.dLoc.lat, lng: calcData.dLoc.lng }
          ],
          createdAt: new Date(),
          expiresAt: expiresAtDate.toISOString(),
          driverInfo: null,
          driverLocation: null,
          bookingId: `PH-${randId}`
        });
      } catch (e) {
        console.warn("Could not insert ride request from SMS bot", e);
      }
    }

    return ` ODA IMEWASILISHWA! \n\n` +
           `Msafiri: *${finalPassengerName}* (${finalPhone})\n` +
           `Njia: *${calcData.pickupName}*  *${calcData.destName}*\n` +
           `Nauli: *TZS ${calcData.fare?.toLocaleString()}/=* (${calcData.typeName})\n\n` +
           `Madereva wamepewa taarifa. Utapokea SMS/Simu dereva akithibitisha. Ahsante! `;
  }

  // SALON BOOKING FLOWS
  if (session.step === 'SALON_SUB' && session.selectedService === 'salon') {
    let subLabel = "Nywele";
    if (cleanInput === '2') subLabel = "Kucha";
    else if (cleanInput === '3') subLabel = "Makeup";
    else if (cleanInput === '4') subLabel = "Spa";
    
    session.selectedSalonCategory = subLabel;
    session.step = 'SALON_SELECT';

    // Simulated local salons
    const salons = [
      { id: 'sal-1', name: 'Shear Illusions Salon', desc: 'Nywele na Matunzo', price: 15000 },
      { id: 'sal-2', name: 'Nyumbani kwa Kucha & Spa', desc: 'Manicure, pedicure & Relax massage', price: 25000 },
      { id: 'sal-3', name: 'Besta Barbershop & Spa', desc: 'Shaving & Facial scrub', price: 5000 }
    ];
    session.optionsList = salons;
    await saveSession(session, dbAdmin);

    let reply = ` Saluni bora kabisa karibu nawe kwa ajili ya [${subLabel}]:\n\n`;
    salons.forEach((sal, idx) => {
      reply += `${idx + 1}. ${sal.name}\n ${sal.desc}\n Huduma kuanzia: TSH ${sal.price.toLocaleString()}\n\n`;
    });
    reply += "Tuma namba ya Saluni unayotaka kujitengeneza miadi (booking) sasa hivi:";
    return reply;
  }

  if (session.step === 'SALON_SELECT' && session.selectedService === 'salon') {
    const idx = parseInt(cleanInput) - 1;
    const selected = session.optionsList?.[idx];
    if (!selected) {
      return " Namba uliyotuma si sahihi. Tafadhali tuma 1, 2 au 3 kulingana na saluni unayotaka.";
    }

    session.selectedSalonId = selected.id;
    session.selectedSalonName = selected.name;
    session.step = 'START'; // complete
    await saveSession(session, dbAdmin);

    // Create realistic order
    await triggerMockOrder(dbAdmin, selected.id, 'salon', [{ name: `Service Custom: ${session.selectedSalonCategory}`, price: selected.price, quantity: 1 }], selected.price, fromPhone, "Weka Miadi SMS", `SMS request for ${session.selectedSalonCategory}`);

    return ` Hongera sana! Umefanikiwa kuweka miadi (booking) na "${selected.name}".\n Huduma ya Kuanzia: TSH ${selected.price.toLocaleString()}\n Tafadhali fika saluni kwa wakati kukamilisha huduma yako. Simu ya Saluni itawasiliana nawe punde! Ahsante! `;
  }

  // PAPOFIX (HOME SERVICES & HANDYMAN) FLOWS
  if (session.step === 'HANDYMAN_SUB' && session.selectedService === 'handyman') {
    let catName = "Fundi Umeme";
    if (cleanInput === '2') catName = "Fundi Bomba";
    else if (cleanInput === '3') catName = "Fundi Mbao & Samani";
    else if (cleanInput === '4') catName = "Fundi Rangi";
    else if (cleanInput === '5') catName = "Friji na AC Repair";
    else if (cleanInput === '6') catName = "Usafi na Fumigation";
    else if (cleanInput === '7') catName = "TV na Electronics";

    session.selectedSubCategory = catName;
    session.step = 'HANDYMAN_SELECT';

    const handymen = [
      { id: 'hnd-1', name: 'Fundi Kassim (Master Specialist)', desc: `${catName} - Anafika ndani ya dk 30`, price: 10000 },
      { id: 'hnd-2', name: 'PapoFix Emergency Repair Team', desc: `Timu ya Wataalamu wa ${catName}`, price: 15000 },
      { id: 'hnd-3', name: 'Fundi Juma & Solar Solutions', desc: `${catName} na Huduma za Nyumbani`, price: 10000 }
    ];
    session.optionsList = handymen;
    await saveSession(session, dbAdmin);

    let reply = ` PapoFix - Chagua Fundi Bora kwa [${catName}]:\n\n`;
    handymen.forEach((h, idx) => {
      reply += `${idx + 1}. ${h.name}\n ${h.desc}\n Ada ya Ukaguzi: TZS ${h.price.toLocaleString()}\n\n`;
    });
    reply += "Tuma namba ya Fundi unayemchagua kuweka booking:";
    return reply;
  }

  if (session.step === 'HANDYMAN_SELECT' && session.selectedService === 'handyman') {
    const idx = parseInt(cleanInput) - 1;
    const selected = session.optionsList?.[idx];
    if (!selected) {
      return " Chaguo si sahihi. Tafadhali tuma 1, 2 au 3 kuchagua Fundi.";
    }

    session.selectedVendorName = selected.name;
    session.step = 'HANDYMAN_DESC';
    await saveSession(session, dbAdmin);

    return ` Umemchagua: ${selected.name}\n\nTafadhali tuma maelezo mafupi ya tatizo au kazi unayotaka ifanyike (Mf: Kurepair switch za umeme sebuleni au kurekebisha bomba la jikoni):`;
  }

  if (session.step === 'HANDYMAN_DESC' && session.selectedService === 'handyman') {
    const issueDesc = cleanInput;
    const refCode = 'PFX-' + Math.floor(100000 + Math.random() * 900000);

    session.step = 'START';
    await saveSession(session, dbAdmin);

    if (dbAdmin) {
      try {
        await dbAdmin.collection('orders').add({
          orderType: 'booking',
          service: 'PapoFix',
          vendorCategory: 'handyman',
          subCategory: session.selectedSubCategory || 'Home Services',
          description: issueDesc,
          vendorName: session.selectedVendorName || 'PapoFix Verified Handyman',
          customerPhone: fromPhone,
          status: 'pending',
          createdAt: new Date().toISOString(),
          paymentMethod: 'Cash/Mobile',
          inspectionFee: 10000,
          total: 10000,
          bookingRef: refCode
        });
      } catch (err) {
        console.warn("Error saving handyman booking in Firestore:", err);
      }
    }

    return ` OMBI LA FUNDI LIMETUMWA! \n\nRef Code: ${refCode}\nHuduma: ${session.selectedSubCategory || 'PapoFix'}\nFundi: ${session.selectedVendorName || 'Master Fundi'}\nMaelezo: ${issueDesc}\n Ada ya Ukaguzi: TZS 10,000\n\nFundi wetu atakupigia simu kwenye namba *${fromPhone}* hivi punde kuanza kazi. Ahsante kwa kutumia PapoFix! `;
  }

  // BUS BOOKING FLOWS (The exact user scenario requested)
  if (session.step === 'BUS_ROUTE' && session.selectedService === 'bus_ticket') {
    const routeParts = cleanInput.toUpperCase();
    session.busRoute = routeParts;
    session.step = 'BUS_SELECT_OPERATOR';

    // Dynamic search for vendors with category === 'bus_ticket'
    let operators: any[] = [];
    if (dbAdmin) {
      try {
        const snap = await dbAdmin.collection('vendors').where('category', '==', 'bus_ticket').get();
        snap.forEach((doc: any) => {
          const d = doc.data();
          operators.push({
            id: doc.id,
            businessName: d.businessName || d.name,
            price: d.ticketConfig?.price || 45000
          });
        });
      } catch (err) {
        console.warn("Failed fetching bus operators via Admin SDK:", err);
      }
    }

    if (operators.length === 0) {
      operators = [
        { id: 'papo-hapo-express', businessName: 'Papo Hapo Express', price: 42000 },
        { id: 'abc-luxury', businessName: 'ABC Luxury', price: 48000 }
      ];
    }

    session.optionsList = operators;
    await saveSession(session, dbAdmin);

    let reply = ` Safari za route ya ${routeParts}:\nChagua basi kwa kutuma namba yake:\n\n`;
    operators.forEach((op, idx) => {
      reply += `${idx + 1}. ${op.businessName}\n Nauli: TSH ${op.price.toLocaleString()}\n\n`;
    });
    reply += "Weka namba ya mtoa usafiri sasa hivi kukata kiti chako:";
    return reply;
  }

  if (session.step === 'BUS_SELECT_OPERATOR' && session.selectedService === 'bus_ticket') {
    const idx = parseInt(cleanInput) - 1;
    const selected = session.optionsList?.[idx];
    if (!selected) {
      return " Namba ya basi uliyotuma si sahihi. Chagua namba sahihi ya opereta kwenye orodha yetu.";
    }

    session.selectedOperatorId = selected.id;
    session.selectedOperatorName = selected.businessName;
    session.selectedProductPrice = selected.price;
    session.step = 'BUS_SEAT';
    await saveSession(session, dbAdmin);

    return ` Umechagua Basi la: ${selected.businessName}.\n\nTafadhali chagua namba ya kiti upendacho kukaa.\nMfano wa viti vilivyowazi sasa:\nA12, B3, C7, D10.\n\nTuma herufi ya kiti chako sasa:`;
  }

  if (session.step === 'BUS_SEAT' && session.selectedService === 'bus_ticket') {
    const seatInput = cleanInput.toUpperCase();
    session.selectedSeat = seatInput;
    session.step = 'BUS_PHONE';
    await saveSession(session, dbAdmin);

    return ` Umechagua *KITI ${seatInput}* kwenye basi la ${session.selectedOperatorName}.\n\nTafadhali tuma namba ya simu ya lipa hapa (pesa ya simu) ya kufanya malipo (Mfano: 0712345678 au 0687123456):`;
  }

  if (session.step === 'BUS_PHONE' && session.selectedService === 'bus_ticket') {
    const paymentPhone = cleanInput;
    session.step = 'START'; // reset
    await saveSession(session, dbAdmin);

    // Dynamic order insertion
    await triggerMockOrder(
      dbAdmin, 
      session.selectedOperatorId || "papo-hapo-express", 
      'bus_ticket', 
      [{ name: `Bus Seat ${session.selectedSeat} (${session.busRoute})`, price: session.selectedProductPrice || 45000, quantity: 1, seatNumber: session.selectedSeat }], 
      session.selectedProductPrice || 45000, 
      fromPhone, 
      "SMS Bus Client", 
      `Kiti ${session.selectedSeat} uelekeo ${session.busRoute} - Nambari ya malipo ${paymentPhone}`
    );

    return ` ASDANTE SANA! Umefanikiwa kuhifadhi kiti chako:\n\n` +
           `- Route: ${session.busRoute}\n` +
           `- Basi: ${session.selectedOperatorName}\n` +
           `- Kiti: ${session.selectedSeat}\n` +
           `- Malipo Mapokezi: TSH ${(session.selectedProductPrice || 45000).toLocaleString()}\n` +
           `- Simu ya malipo: ${paymentPhone}\n\n` +
           `Tumetuma ombi la kulipia kupitia mtandao wa simu (PUSH) kwenda ${paymentPhone}. Tafadhali weka PIN yako kukamilisha ununuzi. Tiketi yako kamili itatuma kwa SMS punde! Safari njema! `;
  }

  // CHAKULA & SOKONI (FOOD & GROCERY SUPER APP FLOW)
  if (session.step === 'FOOD_MAIN_MENU') {
    if (cleanInput === '0') {
      session.step = 'SELECT_SERVICE';
      await saveSession(session, dbAdmin);
      return getWelcomeMessage(session);
    }

    if (cleanInput === '1' || lowerInput.includes('chakula') || lowerInput.includes('food')) {
      session.selectedVendorCategory = 'CHAKULA';
      session.step = 'FOOD_VENDOR_LIST';

      const fallbackVendors = [
        { id: 'v-mama-amina', name: 'Mama Ntilie Amina', defaultDist: 0.4 },
        { id: 'v-pizza-point', name: 'Pizza Point', defaultDist: 0.9 },
        { id: 'v-kfc-mlimani', name: 'KFC Mlimani', defaultDist: 1.5 },
        { id: 'v-burger-house', name: 'Burger House', defaultDist: 2.2 }
      ];

      const vendors = await getSortedVendorsForCategory(
        dbAdmin,
        ['restaurant', 'food', 'chakula', 'mgahawa'],
        fallbackVendors,
        session
      );

      session.optionsList = vendors;
      await saveSession(session, dbAdmin);

      let reply = "CHAKULA KARIBU NAWE\n\n";
      vendors.slice(0, 4).forEach((v, idx) => {
        reply += `${idx + 1}. ${v.name} (${v.distance})\n`;
      });
      reply += "\n9. Zaidi\n0. Nyuma";
      return reply;
    }

    if (cleanInput === '2' || lowerInput.includes('soko') || lowerInput.includes('grocery')) {
      session.selectedVendorCategory = 'SOKONI';
      session.step = 'FOOD_VENDOR_LIST';

      const fallbackVendors = [
        { id: 'v-kariakoo', name: 'Soko Kuu Kariakoo', defaultDist: 0.5 },
        { id: 'v-shoppers', name: 'Supermarket Shoppers', defaultDist: 1.2 },
        { id: 'v-kijitonyama', name: 'Soko la Kijitonyama', defaultDist: 1.8 }
      ];

      const vendors = await getSortedVendorsForCategory(
        dbAdmin,
        ['grocery', 'soko', 'supermarket'],
        fallbackVendors,
        session
      );

      session.optionsList = vendors;
      await saveSession(session, dbAdmin);

      let reply = "SOKONI KARIBU NAWE\n\n";
      vendors.slice(0, 4).forEach((v, idx) => {
        reply += `${idx + 1}. ${v.name} (${v.distance})\n`;
      });
      reply += "\n9. Zaidi\n0. Nyuma";
      return reply;
    }

    return " Chaguo si sahihi! Tuma 1 kwa CHAKULA au 2 kwa SOKONI.\n0. Nyuma";
  }

  if (session.step === 'FOOD_VENDOR_LIST') {
    if (cleanInput === '0') {
      session.step = 'FOOD_MAIN_MENU';
      await saveSession(session, dbAdmin);
      return "PAPO HAPO SUPER APP\nCHAGUA HUDUMA\n\n1. CHAKULA\n2. SOKONI\n\n0. Nyuma";
    }

    if (cleanInput === '9') {
      const vendors = session.optionsList || [];
      if (vendors.length > 4) {
        let reply = "MIGAHAWA / MADUKA ZAIDI:\n\n";
        vendors.slice(4, 8).forEach((v: any, idx: number) => {
          reply += `${idx + 5}. ${v.name} (${v.distance})\n`;
        });
        reply += "\n0. Nyuma";
        return reply;
      }
      return "Hamna watoa huduma wengine zaidi kwa sasa.\n\n0. Nyuma";
    }

    const idx = parseInt(cleanInput) - 1;
    const vendor = session.optionsList?.[idx];
    if (!vendor) {
      return " Namba ya mtoa huduma si sahihi.\n0. Nyuma";
    }

    session.selectedOperatorId = vendor.id;
    session.selectedVendorName = vendor.name;
    session.step = 'FOOD_CATEGORY_LIST';

    // Query Firestore or use vendor menu config
    let categories: any[] = [];
    let productsByCat: Record<string, any[]> = {};

    if (dbAdmin) {
      try {
        const snap = await dbAdmin.collection('products').where('vendorId', '==', vendor.id).get();
        if (!snap.empty) {
          const catMap = new Map<string, any[]>();
          snap.forEach((doc: any) => {
            const p = doc.data();
            const catName = p.category || 'Bidhaa';
            if (!catMap.has(catName)) catMap.set(catName, []);
            catMap.get(catName)!.push({
              id: doc.id,
              name: p.title || p.name || 'Product',
              price: p.price || 0
            });
          });

          catMap.forEach((pList, catName) => {
            categories.push({ id: `c-${catName.toLowerCase()}`, name: catName });
            productsByCat[catName.toLowerCase()] = pList;
          });
        }
      } catch (e) {
        console.warn("Error fetching vendor products from Firestore:", e);
      }
    }

    if (categories.length === 0) {
      const vName = vendor.name.toLowerCase();
      if (vName.includes('pizza')) {
        categories = [
          { id: 'c-pizza', name: 'Pizza' },
          { id: 'c-garlic', name: 'Garlic Bread' },
          { id: 'c-vinywaji', name: 'Vinywaji' },
          { id: 'c-combo', name: 'Combo Deals' }
        ];
      } else if (vName.includes('kfc')) {
        categories = [
          { id: 'c-bucket', name: 'Bucket Deals' },
          { id: 'c-burgers', name: 'Burgers & Wraps' },
          { id: 'c-pieces', name: 'Chicken Pieces' },
          { id: 'c-vinywaji', name: 'Drinks & Fries' }
        ];
      } else if (vName.includes('burger')) {
        categories = [
          { id: 'c-beef-burger', name: 'Beef Burgers' },
          { id: 'c-chicken-burger', name: 'Chicken Burgers' },
          { id: 'c-fries', name: 'Fries & Sides' },
          { id: 'c-shakes', name: 'Milkshakes' }
        ];
      } else if (vName.includes('soko') || vName.includes('shoppers') || vName.includes('grocery') || vName.includes('kariakoo')) {
        categories = [
          { id: 'c-matunda', name: 'Matunda na Mboga' },
          { id: 'c-mchele', name: 'Mchele na Ngano' },
          { id: 'c-mafuta', name: 'Mafuta na Viungo' },
          { id: 'c-aziwa', name: 'Vinywaji na Maziwa' }
        ];
      } else {
        categories = [
          { id: 'c-wali', name: 'Wali' },
          { id: 'c-chips', name: 'Chips' },
          { id: 'c-ugali', name: 'Ugali' },
          { id: 'c-vinywaji', name: 'Vinywaji' },
          { id: 'c-ofa', name: 'Ofa za Leo' }
        ];
      }
    }

    session.optionsList = categories;
    await saveSession(session, dbAdmin);

    let reply = `${vendor.name.toUpperCase()}\n\n`;
    categories.forEach((cat, i) => {
      reply += `${i + 1}. ${cat.name}\n`;
    });
    reply += "\n0. Nyuma";
    return reply;
  }

  if (session.step === 'FOOD_CATEGORY_LIST') {
    if (cleanInput === '0') {
      session.step = 'FOOD_VENDOR_LIST';
      await saveSession(session, dbAdmin);
      const vendors = session.optionsList || [];
      let reply = "MTOA HUDUMA KARIBU NAWE:\n\n";
      vendors.slice(0, 4).forEach((v: any, idx: number) => {
        reply += `${idx + 1}. ${v.name} (${v.distance || '0.5 km'})\n`;
      });
      reply += "\n9. Zaidi\n0. Nyuma";
      return reply;
    }

    const idx = parseInt(cleanInput) - 1;
    const cat = session.optionsList?.[idx];
    if (!cat) {
      return " Chaguo si sahihi. Chagua namba kutoka kwenye orodha.\n0. Nyuma";
    }

    session.selectedSubCategory = cat.name;
    session.step = 'FOOD_ITEMS_LIST';

    const catLower = cat.name.toLowerCase();
    const vName = (session.selectedVendorName || '').toLowerCase();
    let items: any[] = [];

    // Query Firestore for this category & vendor
    if (dbAdmin && session.selectedOperatorId) {
      try {
        const snap = await dbAdmin.collection('products')
          .where('vendorId', '==', session.selectedOperatorId)
          .get();
        if (!snap.empty) {
          snap.forEach((doc: any) => {
            const p = doc.data();
            const pCat = (p.category || '').toLowerCase();
            if (pCat === catLower || pCat.includes(catLower) || catLower.includes(pCat)) {
              items.push({
                id: doc.id,
                name: p.title || p.name || 'Bidhaa',
                price: p.price || 5000
              });
            }
          });
        }
      } catch (e) {
        console.warn("Error querying items for category:", e);
      }
    }

    if (items.length === 0) {
      if (vName.includes('pizza')) {
        if (catLower.includes('pizza')) {
          items = [
            { id: 'p-pizza-pepperoni', name: 'Pizza Beef Pepperoni', price: 18000 },
            { id: 'p-pizza-bbq', name: 'Pizza Chicken BBQ', price: 20000 },
            { id: 'p-pizza-veggie', name: 'Pizza Veggie Supreme', price: 15000 },
            { id: 'p-pizza-cheese', name: 'Pizza Cheese Lover', price: 14000 }
          ];
        } else if (catLower.includes('garlic')) {
          items = [
            { id: 'p-garlic-cheese', name: 'Garlic Bread Cheese', price: 8000 },
            { id: 'p-garlic-sticks', name: 'Garlic Sticks', price: 5000 }
          ];
        } else if (catLower.includes('vinywaji')) {
          items = [
            { id: 'p-soda-large', name: 'Soda 1.25L', price: 3000 },
            { id: 'p-juice-box', name: 'Juisi ya Box (1L)', price: 4000 }
          ];
        } else {
          items = [
            { id: 'p-combo-pizza', name: 'Combo: 2 Pizza + Soda 1.25L', price: 35000 }
          ];
        }
      } else if (vName.includes('kfc')) {
        if (catLower.includes('bucket')) {
          items = [
            { id: 'p-streetwise2', name: 'Streetwise 2', price: 12000 },
            { id: 'p-streetwise5', name: 'Streetwise 5', price: 28000 },
            { id: 'p-bucket9', name: 'Family Bucket (9 Pcs)', price: 52000 }
          ];
        } else if (catLower.includes('burger') || catLower.includes('wrap')) {
          items = [
            { id: 'p-colonel', name: 'Colonel Burger', price: 14000 },
            { id: 'p-zinger', name: 'Zinger Burger', price: 16000 },
            { id: 'p-twister', name: 'Twister Wrap', price: 12000 }
          ];
        } else if (catLower.includes('piece') || catLower.includes('chicken')) {
          items = [
            { id: 'p-chicken-1', name: 'Chicken 1 Pc', price: 5000 },
            { id: 'p-chicken-3', name: 'Chicken 3 Pcs', price: 14000 }
          ];
        } else {
          items = [
            { id: 'p-fries-large', name: 'Large Fries', price: 5000 },
            { id: 'p-soda-500', name: 'Soda 500ml', price: 2000 }
          ];
        }
      } else if (vName.includes('burger')) {
        if (catLower.includes('beef')) {
          items = [
            { id: 'p-cheese-burger', name: 'Classic Cheeseburger', price: 12000 },
            { id: 'p-double-beef', name: 'Double Beef Burger', price: 18000 },
            { id: 'p-bbq-bacon', name: 'BBQ Bacon Burger', price: 16000 }
          ];
        } else if (catLower.includes('chicken')) {
          items = [
            { id: 'p-crispy-chicken', name: 'Crispy Chicken Burger', price: 13000 },
            { id: 'p-spicy-zinger', name: 'Spicy Zinger House', price: 15000 }
          ];
        } else if (catLower.includes('fries') || catLower.includes('side')) {
          items = [
            { id: 'p-loaded-fries', name: 'Loaded Cheese Fries', price: 10000 },
            { id: 'p-onion-rings', name: 'Onion Rings', price: 6000 }
          ];
        } else {
          items = [
            { id: 'p-choc-shake', name: 'Chocolate Milkshake', price: 7000 },
            { id: 'p-vanilla-shake', name: 'Vanilla Milkshake', price: 7000 }
          ];
        }
      } else if (vName.includes('soko') || vName.includes('shoppers') || vName.includes('grocery') || vName.includes('kariakoo')) {
        if (catLower.includes('matunda') || catLower.includes('mboga')) {
          items = [
            { id: 'p-nyanya', name: 'Nyanya Tenga Ndogo', price: 10000 },
            { id: 'p-kitunguu', name: 'Kitunguu Maji 1kg', price: 4000 },
            { id: 'p-ndizi', name: 'Ndizi Mbichi Mkono', price: 5000 },
            { id: 'p-mchicha', name: 'Mchicha Fresh', price: 1000 }
          ];
        } else if (catLower.includes('mchele') || catLower.includes('ngano')) {
          items = [
            { id: 'p-mchele-kyela', name: 'Mchele Kyela 5kg', price: 17500 },
            { id: 'p-unga-sembe', name: 'Unga wa Sembe 5kg', price: 10000 },
            { id: 'p-unga-ngano', name: 'Unga wa Ngano 2kg', price: 4500 }
          ];
        } else if (catLower.includes('mafuta') || catLower.includes('viungo')) {
          items = [
            { id: 'p-mafuta-3l', name: 'Mafuta ya Kupikia 3L', price: 16000 },
            { id: 'p-viungo-pack', name: 'Chumvi & Viungo Pack', price: 2000 }
          ];
        } else {
          items = [
            { id: 'p-maziwa-1l', name: 'Maziwa Mgando 1L', price: 3000 },
            { id: 'p-juisi-1l', name: 'Juisi ya Azam 1L', price: 2500 }
          ];
        }
      } else {
        if (catLower.includes('chip')) {
          items = [
            { id: 'p-chips-kuku', name: 'Chips Kuku', price: 8000 },
            { id: 'p-chips-mayai', name: 'Chips Mayai', price: 5000 },
            { id: 'p-chips-beef', name: 'Chips Beef', price: 7000 },
            { id: 'p-chips-mishkaki', name: 'Chips Mishkaki', price: 9000 }
          ];
        } else if (catLower.includes('wali')) {
          items = [
            { id: 'p-wali-kuku', name: 'Wali Kuku', price: 7000 },
            { id: 'p-wali-samaki', name: 'Wali Samaki', price: 8000 },
            { id: 'p-wali-nyama', name: 'Wali Nyama', price: 5000 },
            { id: 'p-wali-maharage', name: 'Wali Maharage', price: 3000 }
          ];
        } else if (catLower.includes('ugali')) {
          items = [
            { id: 'p-ugali-samaki', name: 'Ugali Samaki', price: 8000 },
            { id: 'p-ugali-dagaa', name: 'Ugali Dagaa', price: 4000 },
            { id: 'p-ugali-kuku', name: 'Ugali Kuku', price: 7000 }
          ];
        } else if (catLower.includes('vinywaji') || catLower.includes('drink')) {
          items = [
            { id: 'p-soda', name: 'Soda Baridi', price: 1000 },
            { id: 'p-maji', name: 'Maji Makubwa (1.5L)', price: 1500 },
            { id: 'p-juisi', name: 'Juisi ya Matunda Fresh', price: 2500 }
          ];
        } else {
          items = [
            { id: 'p-ofa-1', name: 'Ofa: Chips Kuku + Soda', price: 8500 },
            { id: 'p-ofa-2', name: 'Ofa: Wali Kuku + Juisi', price: 8000 }
          ];
        }
      }
    }

    session.optionsList = items;
    await saveSession(session, dbAdmin);

    let reply = `${cat.name.toUpperCase()}\n\n`;
    items.forEach((item, i) => {
      reply += `${i + 1}. ${item.name} - TZS ${item.price.toLocaleString()}\n`;
    });
    reply += "\n9. Zaidi\n0. Nyuma";
    return reply;
  }

  if (session.step === 'FOOD_ITEMS_LIST') {
    if (cleanInput === '0') {
      session.step = 'FOOD_CATEGORY_LIST';
      await saveSession(session, dbAdmin);
      return `${session.selectedVendorName || 'Mama Ntilie Amina'}\n\n1. Wali\n2. Chips\n3. Ugali\n4. Vinywaji\n5. Ofa za Leo\n\n0. Nyuma`;
    }

    const idx = parseInt(cleanInput) - 1;
    const item = session.optionsList?.[idx];
    if (!item) {
      return " Chaguo si sahihi. Chagua namba kutoka kwenye orodha.\n0. Nyuma";
    }

    session.selectedProductId = item.id;
    session.selectedProductName = item.name;
    session.selectedProductPrice = item.price;
    session.step = 'FOOD_ITEM_DETAIL';
    await saveSession(session, dbAdmin);

    return `${item.name}\nBei: TZS ${item.price.toLocaleString()}\n\n1. Ongeza Kikapu\n2. Maelezo\n0. Nyuma`;
  }

  if (session.step === 'FOOD_ITEM_DETAIL') {
    if (cleanInput === '0') {
      session.step = 'FOOD_ITEMS_LIST';
      await saveSession(session, dbAdmin);
      return `Chagua tena bidhaa au tuma 0 kurudi nyuma.`;
    }

    if (cleanInput === '2') {
      return `${session.selectedProductName} Tamu na ya moto inayokuja na saladi na kachumbari.\n\n1. Ongeza Kikapu\n0. Nyuma`;
    }

    if (cleanInput === '1') {
      session.step = 'FOOD_QTY_INPUT';
      await saveSession(session, dbAdmin);
      return "Ingiza idadi.\n\nMfano:\n1\n2\n3";
    }

    return " Bofya 1 Ongeza Kikapu, 2 Maelezo, au 0 Nyuma.";
  }

  if (session.step === 'FOOD_QTY_INPUT') {
    if (cleanInput === '0') {
      session.step = 'FOOD_ITEM_DETAIL';
      await saveSession(session, dbAdmin);
      return `${session.selectedProductName}\nBei: TZS ${(session.selectedProductPrice || 0).toLocaleString()}\n\n1. Ongeza Kikapu\n2. Maelezo\n0. Nyuma`;
    }

    const qty = parseInt(cleanInput);
    if (isNaN(qty) || qty <= 0) {
      return "Tafadhali ingiza idadi (Mfano: 1, 2, 3):";
    }

    session.foodCart = session.foodCart || [];
    session.foodCart.push({
      name: session.selectedProductName || "Chips Kuku",
      price: session.selectedProductPrice || 8000,
      qty,
      productId: session.selectedProductId
    });

    session.step = 'FOOD_CART_VIEW';
    await saveSession(session, dbAdmin);

    const subtotal = session.foodCart.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
    let cartLines = session.foodCart.map(c => `${c.name} x${c.qty}`).join('\n');

    return `KIKAPU\n\n${cartLines}\n\nTZS ${subtotal.toLocaleString()}\n\n1. Ongeza bidhaa\n2. Endelea Kulipa\n3. Futa Kikapu\n\n0. Nyuma`;
  }

  if (session.step === 'FOOD_CART_VIEW') {
    if (cleanInput === '0' || cleanInput === '1') {
      session.step = 'FOOD_CATEGORY_LIST';
      await saveSession(session, dbAdmin);
      return `${session.selectedVendorName || 'Mama Ntilie Amina'}\n\n1. Wali\n2. Chips\n3. Ugali\n4. Vinywaji\n5. Ofa za Leo\n\n0. Nyuma`;
    }

    if (cleanInput === '3') {
      session.foodCart = [];
      session.step = 'FOOD_CATEGORY_LIST';
      await saveSession(session, dbAdmin);
      return "Kikapu kimefutwa!\n\n1. Wali\n2. Chips\n3. Ugali\n4. Vinywaji\n5. Ofa za Leo\n\n0. Nyuma";
    }

    if (cleanInput === '2') {
      if (!session.foodCart || session.foodCart.length === 0) {
        return "Kikapu chako kipo wazi!\n\n1. Ongeza bidhaa\n0. Nyuma";
      }

      session.step = 'FOOD_DELIVERY_LOCATION';
      await saveSession(session, dbAdmin);

      return "DELIVERY\n\n1. Tumia Location yangu\n2. Ingiza eneo\n\n0. Nyuma";
    }

    return " Bofya 1 Ongeza bidhaa, 2 Endelea Kulipa, au 3 Futa Kikapu.";
  }

  if (session.step === 'FOOD_DELIVERY_LOCATION') {
    if (cleanInput === '0') {
      session.step = 'FOOD_CART_VIEW';
      await saveSession(session, dbAdmin);
      const subtotal = (session.foodCart || []).reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
      let cartLines = (session.foodCart || []).map(c => `${c.name} x${c.qty}`).join('\n');
      return `KIKAPU\n\n${cartLines}\n\nTZS ${subtotal.toLocaleString()}\n\n1. Ongeza bidhaa\n2. Endelea Kulipa\n3. Futa Kikapu\n\n0. Nyuma`;
    }

    if (cleanInput === '1') {
      session.deliveryLocation = "Location yangu";
      session.deliveryFee = 2500;
      session.step = 'FOOD_PAYMENT_METHOD';
      await saveSession(session, dbAdmin);

      const subtotal = (session.foodCart || []).reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
      let grandTotal = subtotal + 2500;
      let promoText = "";
      if (session.appliedPromoCode) {
        const disc = session.promoDiscount || 1000;
        const appliedDisc = disc < 1 ? Math.round(grandTotal * disc) : disc;
        grandTotal = Math.max(1000, grandTotal - appliedDisc);
        promoText = session.language === 'en'
          ? `\nPromo (${session.appliedPromoCode}) -TZS ${appliedDisc.toLocaleString()}`
          : `\nPromo (${session.appliedPromoCode}) -TZS ${appliedDisc.toLocaleString()}`;
      }

      const walletBal = (session.walletBalance || 0).toLocaleString();

      return session.language === 'en'
        ? `SUMMARY\n\nItems       TZS ${subtotal.toLocaleString()}\nDelivery    TZS 2,500${promoText}\nTotal       TZS ${grandTotal.toLocaleString()}\n\n1. PapoWallet (Bal: TZS ${walletBal})\n2. M-Pesa\n3. Airtel Money\n4. Tigo Pesa\n5. HaloPesa\n6. Cash\n\n0. Back`
        : `JUMLA\n\nBidhaa      TZS ${subtotal.toLocaleString()}\nDelivery    TZS 2,500${promoText}\nJumla       TZS ${grandTotal.toLocaleString()}\n\n1. PapoWallet (Salio: TZS ${walletBal})\n2. M-Pesa\n3. Airtel Money\n4. Tigo Pesa\n5. HaloPesa\n6. Cash\n\n0. Nyuma`;
    }

    if (cleanInput === '2') {
      session.step = 'FOOD_INPUT_ADDRESS';
      await saveSession(session, dbAdmin);
      return session.language === 'en'
        ? "Please enter your delivery location:\n(Example: TABATA RELINI, KINONDONI, MWENGE)"
        : "Tafadhali ingiza eneo lako la uwasilishaji:\n(Mfano: TABATA RELINI, KINONDONI, MWENGE)";
    }

    return session.language === 'en'
      ? " Select 1 Use my location, 2 Enter address, or 0 Back."
      : " Chagua 1 Tumia Location yangu, 2 Ingiza eneo, au 0 Nyuma.";
  }

  if (session.step === 'FOOD_INPUT_ADDRESS') {
    if (cleanInput === '0') {
      session.step = 'FOOD_DELIVERY_LOCATION';
      await saveSession(session, dbAdmin);
      return session.language === 'en'
        ? "DELIVERY\n\n1. Use my location\n2. Enter address\n\n0. Back"
        : "DELIVERY\n\n1. Tumia Location yangu\n2. Ingiza eneo\n\n0. Nyuma";
    }

    session.deliveryLocation = cleanInput.toUpperCase();
    session.deliveryFee = 2500;
    session.step = 'FOOD_PAYMENT_METHOD';
    await saveSession(session, dbAdmin);

    const subtotal = (session.foodCart || []).reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
    let grandTotal = subtotal + 2500;
    let promoText = "";
    if (session.appliedPromoCode) {
      const disc = session.promoDiscount || 1000;
      const appliedDisc = disc < 1 ? Math.round(grandTotal * disc) : disc;
      grandTotal = Math.max(1000, grandTotal - appliedDisc);
      promoText = session.language === 'en'
        ? `\nPromo (${session.appliedPromoCode}) -TZS ${appliedDisc.toLocaleString()}`
        : `\nPromo (${session.appliedPromoCode}) -TZS ${appliedDisc.toLocaleString()}`;
    }

    const walletBal = (session.walletBalance || 0).toLocaleString();

    return session.language === 'en'
      ? `SUMMARY\n\nItems       TZS ${subtotal.toLocaleString()}\nDelivery    TZS 2,500${promoText}\nTotal       TZS ${grandTotal.toLocaleString()}\n\n1. PapoWallet (Bal: TZS ${walletBal})\n2. M-Pesa\n3. Airtel Money\n4. Tigo Pesa\n5. HaloPesa\n6. Cash\n\n0. Back`
      : `JUMLA\n\nBidhaa      TZS ${subtotal.toLocaleString()}\nDelivery    TZS 2,500${promoText}\nJumla       TZS ${grandTotal.toLocaleString()}\n\n1. PapoWallet (Salio: TZS ${walletBal})\n2. M-Pesa\n3. Airtel Money\n4. Tigo Pesa\n5. HaloPesa\n6. Cash\n\n0. Nyuma`;
  }

  if (session.step === 'FOOD_PAYMENT_METHOD') {
    if (cleanInput === '0') {
      session.step = 'FOOD_DELIVERY_LOCATION';
      await saveSession(session, dbAdmin);
      return session.language === 'en' ? "DELIVERY\n\n1. Use my location\n2. Enter address\n\n0. Back" : "DELIVERY\n\n1. Tumia Location yangu\n2. Ingiza eneo\n\n0. Nyuma";
    }

    const payMethods: Record<string, string> = {
      '1': 'PapoWallet',
      '2': 'M-Pesa',
      '3': 'Airtel Money',
      '4': 'Tigo Pesa',
      '5': 'HaloPesa',
      '6': 'Cash'
    };

    const method = payMethods[cleanInput] || 'Cash';
    session.paymentMethod = method;

    const subtotal = (session.foodCart || []).reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
    const deliveryFee = session.deliveryFee || 2500;
    let grandTotal = subtotal + deliveryFee;

    if (session.appliedPromoCode) {
      const disc = session.promoDiscount || 1000;
      const appliedDisc = disc < 1 ? Math.round(grandTotal * disc) : disc;
      grandTotal = Math.max(1000, grandTotal - appliedDisc);
    }

    if (method === 'PapoWallet') {
      if ((session.walletBalance || 0) < grandTotal) {
        return session.language === 'en'
          ? ` Insufficient PapoWallet balance (Bal: TZS ${(session.walletBalance || 0).toLocaleString()}, Required: TZS ${grandTotal.toLocaleString()}). Please select another payment method or top up.`
          : ` Salio la PapoWallet halitoshi (Salio: TZS ${(session.walletBalance || 0).toLocaleString()}, Inatakiwa: TZS ${grandTotal.toLocaleString()}). Chagua njia ingine ya malipo au weka salio.`;
      }
      session.walletBalance = (session.walletBalance || 0) - grandTotal;
    }

    // Earn PapoPoints
    const earnedPoints = Math.max(10, Math.floor(grandTotal / 100));
    session.papoPoints = (session.papoPoints || 0) + earnedPoints;

    const orderNum = Math.floor(100000 + Math.random() * 900000);
    const orderIdCode = `PH${orderNum}`;

    const vendorName = session.selectedVendorName || "Mama Ntilie Amina";

    // Create realistic Order in Firestore
    if (dbAdmin) {
      try {
        await dbAdmin.collection('orders').add({
          orderId: orderIdCode,
          vendorId: session.selectedOperatorId || 'v-mama-amina',
          vendorName: vendorName,
          customerPhone: fromPhone,
          items: session.foodCart || [{ name: session.selectedProductName || "Chips Kuku", price: 8000, quantity: 2 }],
          subtotal: subtotal,
          deliveryFee: deliveryFee,
          totalAmount: grandTotal,
          paymentMethod: method,
          deliveryLocation: session.deliveryLocation || "TABATA RELINI",
          status: 'pending',
          createdAt: new Date(),
          source: 'ussd'
        });
      } catch (err) {
        console.warn("Error creating USSD food order in Firestore:", err);
      }
    }

    // Reset session
    session.step = 'START';
    session.foodCart = [];
    await saveSession(session, dbAdmin);

    if (session.language === 'en') {
      return `Order successfully sent! \n\nVendor: ${vendorName}\nTotal: TZS ${grandTotal.toLocaleString()}\nPayment: ${method}\n Earned +${earnedPoints} PapoPoints!\nOrder Code: ${orderIdCode}`;
    }

    return `Agizo lako limetumwa! \n\nVendor: ${vendorName}\nJumla: TZS ${grandTotal.toLocaleString()}\nMalipo: ${method}\n Umepata +${earnedPoints} PapoPoints!\nOrder Code: ${orderIdCode}`;
  }

  // GENERAL STORES / RESTAURANT / GROCERY FLOWS
  if (session.step === 'STORE_SEARCH') {
    const queryTerm = lowerInput;
    session.step = 'STORE_SELECT_ITEM';

    // Search in DB if we can find matches or build simulated matches
    let matches: any[] = [];
    if (dbAdmin) {
      try {
        const snap = await dbAdmin.collection('products')
          .where('status', '==', 'active')
          .get();
        
        snap.forEach((doc: any) => {
          const d = doc.data();
          const name = (d.name || '').toLowerCase();
          const desc = (d.description || '').toLowerCase();
          const cat = (d.category || '').toLowerCase();
          
          if (name.includes(queryTerm) || desc.includes(queryTerm) || cat.includes(queryTerm)) {
            matches.push({
              id: doc.id,
              name: d.name,
              price: d.price || 5000,
              vendorId: d.vendorId,
              vendorCategory: d.vendorCategory || session.selectedService
            });
          }
        });
      } catch (err) {
        console.warn("DB Product search not completed, using mock fallbacks:", err);
      }
    }

    if (matches.length === 0) {
      const keywordToMocks: Record<string, any[]> = {
        'samaki': [
          { id: 'p-samaki-1', name: 'Samaki Mkuu Kaangwa (Sato)', price: 12000, vendorId: 'vendor-rest', vendorCategory: 'restaurant' },
          { id: 'p-samaki-2', name: 'Fish Fillet na Chips', price: 15000, vendorId: 'vendor-rest', vendorCategory: 'restaurant' }
        ],
        'chips': [
          { id: 'p-chips-1', name: 'Chips Kuku Choma', price: 8000, vendorId: 'vendor-rest', vendorCategory: 'restaurant' },
          { id: 'p-chips-2', name: 'Chips Mayai (Zege)', price: 3500, vendorId: 'vendor-rest', vendorCategory: 'restaurant' }
        ],
        'panadol': [
          { id: 'p-dawa-1', name: 'Panadol Advance (Kopo 24)', price: 2500, vendorId: 'vendor-pharm', vendorCategory: 'pharmacy' },
          { id: 'p-dawa-2', name: 'Panadol Syrup watoto', price: 4000, vendorId: 'vendor-pharm', vendorCategory: 'pharmacy' }
        ],
        'nyanya': [
          { id: 'p-grocery-1', name: 'Nyanya Kiboksi (Safi)', price: 3000, vendorId: 'vendor-groc', vendorCategory: 'grocery' },
          { id: 'p-grocery-2', name: 'Nyanya Fungo Kubwa', price: 1500, vendorId: 'vendor-groc', vendorCategory: 'grocery' }
        ]
      };
      
      matches = keywordToMocks[queryTerm] || [
        { id: 'fallback-p1', name: `Bidhaa ya kwanza: ${cleanInput}`, price: 4500, vendorId: 'vendor-generic', vendorCategory: session.selectedService || 'ecommerce' },
        { id: 'fallback-p2', name: `Bidhaa ya pili: ${cleanInput}`, price: 7500, vendorId: 'vendor-generic', vendorCategory: session.selectedService || 'ecommerce' }
      ];
    }

    session.optionsList = matches;
    await saveSession(session, dbAdmin);

    let reply = ` Bidhaa zote tulizopata kwa neno: ["${cleanInput}"]:\n\n`;
    matches.forEach((p, idx) => {
      reply += `${idx + 1}. ${p.name}\n Bei: TSH ${p.price.toLocaleString()}\n\n`;
    });
    reply += "Tuma namba ya bidhaa unayotaka kuagiza sasa hivi:";
    return reply;
  }

  if (session.step === 'STORE_SELECT_ITEM') {
    const idx = parseInt(cleanInput) - 1;
    const selected = session.optionsList?.[idx];
    if (!selected) {
      return " Namba ya bidhaa si sahihi. Chagua namba sahihi kuanzia kwenye list.";
    }

    session.selectedProductId = selected.id;
    session.selectedProductName = selected.name;
    session.selectedProductPrice = selected.price;
    session.selectedOperatorId = selected.vendorId; // save target vendor
    session.step = 'STORE_PHONE';
    await saveSession(session, dbAdmin);

    return ` Umechagua kuagiza:\n[${selected.name} - TSH ${selected.price.toLocaleString()}]\n\nTafadhali tuma namba ya simu ya kufanyia malipo na uwasilishaji sasa (Mfano: 07XXXXXXXX):`;
  }

  if (session.step === 'STORE_PHONE') {
    const deliveryPhone = cleanInput;
    session.step = 'START'; // reset
    await saveSession(session, dbAdmin);

    // Save order
    await triggerMockOrder(
      dbAdmin,
      session.selectedOperatorId || "vendor-generic",
      session.selectedService || "ecommerce",
      [{ name: session.selectedProductName, price: session.selectedProductPrice, quantity: 1, productId: session.selectedProductId }],
      session.selectedProductPrice || 5000,
      fromPhone,
      "SMS Store Client",
      `Order item: ${session.selectedProductName}. Delivery phone: ${deliveryPhone}`
    );

    return ` ODA YAKO IMESAJILIWA!\n\n` +
           `- Huduma: ${session.selectedProductName}\n` +
           `- Jumla ya Kulipa: TSH ${(session.selectedProductPrice || 0).toLocaleString()}\n` +
           `- Namba ya mteja: ${deliveryPhone}\n\n` +
           `Tumetuma ujumbe wa muamala (Push prompt) kwenye simu yako ya malipo tayari. Baada ya kukamilisha weka siri, duka litaandaa na kuwasilisha mzigo wako haraka iwezekanavyo! Ahsante sana! `;
  }

  // Fallback reset
  session.step = 'SELECT_SERVICE';
  await saveSession(session, dbAdmin);
  return getWelcomeMessage(session);
}

/**
 * Sends an SMS response using Africa's Talking REST API
 */
export async function sendAfricaTalkingSMS(
  to: string, 
  message: string, 
  dbAdmin: any, 
  vendorId: string = 'admin-global'
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    if (!dbAdmin) {
      console.warn("[Africa's Talking] Missing dbAdmin");
      return { success: false, error: "Database not initialized" };
    }

    const docRef = dbAdmin.collection('vendors').doc(vendorId).collection('settings').doc('sms_config');
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      console.warn("[Africa's Talking] sms_config document does not exist for vendor:", vendorId);
      return { success: false, error: "sms_config not configured in Firestore" };
    }

    const data = docSnap.data();
    const username = data.atUsername || "";
    const apiKey = data.atApiKey || "";
    const senderId = data.atSenderId || "";

    if (!username || !apiKey) {
      console.warn("[Africa's Talking] Missing username or apiKey for vendor:", vendorId);
      return { success: false, error: "Africa's Talking Username au API Key haijawekwa kwenye Mipangilio" };
    }

    const isSandbox = username.toLowerCase() === 'sandbox';
    const url = isSandbox 
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging';

    const params = new URLSearchParams();
    params.append('username', username);
    params.append('to', to);
    params.append('message', message);
    if (senderId) {
      params.append('from', senderId);
    }

    console.log(`[Africa's Talking] Outgoing SMS to ${to} via ${isSandbox ? 'Sandbox' : 'Live'}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey': apiKey
      },
      body: params.toString()
    });

    const responseText = await response.text();
    console.log(`[Africa's Talking] API Response:`, responseText);

    if (response.ok) {
      return { success: true, data: responseText };
    } else {
      return { success: false, error: responseText };
    }
  } catch (error: any) {
    console.error("[Africa's Talking] Error sending SMS:", error);
    return { success: false, error: error.message };
  }
}
