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

// Simple in-memory global config for Twilio Responder (can be updated by vendors)
export interface TwilioConfig {
  isEnabled: boolean;
  welcomeMessage: string;
  phoneNumber: string; 
  vendorRules: Record<string, { welcome: string; services: string[] }>;
}

export const defaultTwilioConfig: TwilioConfig = {
  isEnabled: true,
  welcomeMessage: "Karibu Mfumo wa Huduma Papo Hapo! 🌟\n\nChagua huduma kwa kutuma namba:\n1. 🚕 TAXI (Agiza / Nauli / Safari)\n2. 📦 KUFUATILIA MZIGO (Parcel Tracking)\n3. 🛵 MODI YA DEREVA (Driver Offline USSD)\n4. 🚌 MABASI (Bus Booking)\n5. 💇‍♀️ SALUNI & UREMBO\n6. 🥗 CHAKULA & SOKONI",
  phoneNumber: "+14155238886", // Default twilio sandbox or custom
  vendorRules: {
    "all-stores": {
      welcome: "Karibu kwenye duka zetu zote!",
      services: ["Dawa", "Chakula", "Mboga", "Matunda"]
    }
  }
};

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
        return docSnap.data() as SMSSession;
      }
    } catch (err) {
      console.warn("[SMS Bot] Failed to load session from Firestore, using memory:", err);
    }
  }

  // Fallback to in-memory
  const existing = inMemorySessions.get(phone);
  if (existing) {
    return existing;
  }

  const fresh: SMSSession = {
    phone,
    step: 'START',
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

/**
 * Master dispatcher handling the conversation text and state transitions
 */
export async function handleSMSInput(
  fromPhone: string, 
  textBody: string, 
  dbAdmin: any,
  vendorId: string = 'admin-global'
): Promise<string> {
  const cleanInput = textBody.trim();
  const lowerInput = cleanInput.toLowerCase();
  
  // Get existing flow session
  const session = await getSession(fromPhone, dbAdmin);

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

  // Restart trigger
  const isGreeting = ['hi', 'mambo', 'vip', 'vipi', 'habari', 'hello', 'habari gani', 'anza', 'start', 'menu', 'ya', 'oje', 'hodi'].includes(lowerInput);
  if (isGreeting || session.step === 'START') {
    session.step = 'SELECT_SERVICE';
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
    session.optionsList = [];
    
    await saveSession(session, dbAdmin);
    return welcomeMessage;
  }

  // Step 1: Selecting Category Service
  if (session.step === 'SELECT_SERVICE') {
    if (cleanInput === '1' || lowerInput.includes('taxi') || lowerInput.includes('teksi')) {
      session.step = 'TAXI_SUBMENU';
      session.selectedService = 'taxi';
      await saveSession(session, dbAdmin);
      return "🚕 HUDUMA ZA TAXI (Taxi & Rides):\n\n1. ⚡ Kuagiza Taxi kwa Haraka (Quick Booking)\n2. 🧮 Kadirio la Nauli (Fare Estimate)\n3. 📍 Andika Njia Yako (Mfano: Mwenge - Posta)\n0. Rudi Menu Kuu";
    } 
    else if (cleanInput === '2' || lowerInput.includes('mzigo') || lowerInput.includes('kifurushi') || lowerInput.includes('parcel') || lowerInput.includes('track')) {
      session.step = 'PARCEL_TRACK_INPUT';
      session.selectedService = 'parcel';
      await saveSession(session, dbAdmin);
      return "📦 KUFUATILIA MZIGO / KIFURUSHI:\n\nTafadhali ingiza Namba ya Mzigo (Tracking Code mf. P-8291, PH-123456) au Namba ya Simu ya Mtumaji/Mpokeaji:";
    } 
    else if (cleanInput === '3' || lowerInput.includes('dereva') || lowerInput.includes('driver')) {
      session.step = 'DRIVER_OFFLINE_MENU';
      session.selectedService = 'driver';
      await saveSession(session, dbAdmin);
      
      let driverName = "Juma Kapoya";
      let isOnline = true;
      if (dbAdmin) {
        try {
          const cleanPhone = session.phone.replace('ussd:', '').replace(/\D/g, '');
          const dSnap = await dbAdmin.collection('drivers').get();
          if (!dSnap.empty) {
            const match = dSnap.docs.find((doc: any) => {
              const data = doc.data();
              const p = (data.phone || "").replace(/\D/g, '');
              return p.endsWith(cleanPhone.slice(-8)) || cleanPhone.endsWith(p.slice(-8));
            });
            if (match) {
              const dData = match.data();
              driverName = dData.name || driverName;
              isOnline = dData.isOnline !== false;
              session.driverId = match.id;
            }
          }
        } catch (e) {
          console.warn("[USSD Driver] Error finding driver in Firestore:", e);
        }
      }

      return `🛵 DEREVA USSD MENU (Offline Mode):\n[Dereva: ${driverName} | ${isOnline ? 'Online 🟢' : 'Offline 🔴'}]\n\n1. 🟢/🔴 Badili Hali (Online/Offline)\n2. 🚖 Safari Inayokusubiri (Accept/Reject)\n3. 📍 Safari Inayoendelea (Start/Finish)\n4. 💰 Salio la Wallet & Mapato ya Leo\n0. Rudi Menu Kuu`;
    } 
    else if (cleanInput === '4' || lowerInput.includes('basi') || lowerInput.includes('mabasi')) {
      session.step = 'BUS_ROUTE';
      session.selectedService = 'bus_ticket';
      await saveSession(session, dbAdmin);
      return "🚌 MFUMO WA MABASI (Bus Booking):\n\nTafadhali tuma route unayotaka kusafiri (Mwanzo - Mwisho).\nMfano:\nDAR - MWANZA\nau ARUSHA - KILIMANJARO";
    } 
    else if (cleanInput === '5' || lowerInput.includes('saluni') || lowerInput.includes('salon')) {
      session.step = 'SALON_SUB';
      session.selectedService = 'salon';
      await saveSession(session, dbAdmin);
      return "💇‍♀️ MFUMO WA SALUNI (Salons Near You):\n\nChagua aina ya huduma ya urembo unayotafuta kwa kutuma namba:\n1. Saluni ya Nywele (Nywele / Hair cuts)\n2. Matunzo ya Kucha (Manicure / Nails)\n3. Urembo & Make-up\n4. Spa & Body Massage";
    } 
    else if (cleanInput === '6' || lowerInput.includes('chakula') || lowerInput.includes('soko') || lowerInput.includes('dawa')) {
      session.step = 'STORE_SEARCH';
      session.selectedService = 'restaurant';
      await saveSession(session, dbAdmin);
      return "🍱 CHAKULA & SOKONI (Food & Groceries):\n\nTuma jina la chakula au bidhaa unayotafuta sasa hivi.\nMfano:\nChips Kuku, Wali Nyama, Samaki au Panadol:";
    }
    else {
      return "⚠️ Chaguo si sahihi! Tafadhali tuma namba kuanzia 1 mpaka 6, au tuma \"HI\" kuanza upya.";
    }
  }

  // 1. TAXI SUBMENU & QUICK BOOKING
  if (session.step === 'TAXI_SUBMENU' && session.selectedService === 'taxi') {
    if (cleanInput === '1') {
      session.step = 'TAXI_QUICK_DESTINATION';
      await saveSession(session, dbAdmin);
      return "⚡ AGIZA TAXI HARAKA:\n\nChagua eneo unalokwenda:\n1. Posta Mpya (City Center)\n2. Kariakoo Sokoni\n3. Mwenge Stand\n4. Ubungo Bus Terminal\n5. Julius Nyerere Airport (JNIA)\n6. Andika Njia Yako Moja kwa Moja";
    } else if (cleanInput === '2') {
      session.step = 'TAXI_FARE_ESTIMATE_INPUT';
      await saveSession(session, dbAdmin);
      return "🧮 KADIRIO LA NAULI (Fare Estimate):\n\nTafadhali tuma njia unayotaka kukadiria gharama zake (Kutoka - Kwenda).\nMfano:\nMwenge - Posta\nau Airport - Mikocheni";
    } else if (cleanInput === '3') {
      session.step = 'TAXI_ROUTE';
      await saveSession(session, dbAdmin);
      return "🚕 MFUMO WA TAXI:\n\nTafadhali tuma njia unayotaka kusafiri (Kutoka - Kwenda).\nMfano: POSTA - KINONDONI";
    } else if (cleanInput === '0') {
      session.step = 'START';
      await saveSession(session, dbAdmin);
      return welcomeMessage;
    } else {
      return "⚠️ Chaguo si sahihi. Tafadhali tuma:\n1. Agiza Taxi kwa Haraka\n2. Kadirio la Nauli\n3. Andika Njia Yako";
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
      return "🚕 Tafadhali tuma njia yako (Mfano: Mwenge - Posta):";
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

      return `🚕 *AINA YA USAFIRI*\n\nNjia: *${pLoc.name}* kuelekea *${dLoc.name}*\n\nTafadhali chagua usafiri:\n\n1. Boda Boda 🏍️ (Haraka & Rahisi)\n2. Bajaji 🛺 (Nafuu & Salama)\n3. Gari la Teksi 🚕 (Starehe & Usalama)`;
    } else {
      return "⚠️ Chaguo si sahihi. Tafadhali chagua namba 1 mpaka 6:";
    }
  }

  // 2. FARE ESTIMATE HANDLERS
  if (session.step === 'TAXI_FARE_ESTIMATE_INPUT' && session.selectedService === 'taxi') {
    const parsed = splitTwoLocations(cleanInput);
    let pickupQuery = "Mwenge";
    let destQuery = cleanInput;

    if (parsed) {
      pickupQuery = parsed.rawPickup;
      destQuery = parsed.rawDestination;
    }

    const pickupRes = await resolvePlace(pickupQuery, dbAdmin);
    const destRes = await resolvePlace(destQuery, dbAdmin);

    const pLoc = pickupRes.matches[0] ? {
      placeId: pickupRes.matches[0].placeId || "TZ-DSM-MWENGE",
      name: pickupRes.matches[0].name || "Mwenge",
      address: pickupRes.matches[0].displayName || "Mwenge, Dar es Salaam",
      lat: typeof pickupRes.matches[0].latitude === 'number' ? pickupRes.matches[0].latitude : -6.7681,
      lng: typeof pickupRes.matches[0].longitude === 'number' ? pickupRes.matches[0].longitude : 39.2274
    } : {
      placeId: "TZ-DSM-MWENGE",
      name: "Mwenge",
      address: "Mwenge, Kinondoni, Dar es Salaam",
      lat: -6.7681,
      lng: 39.2274
    };

    const dLoc = destRes.matches[0] ? {
      placeId: destRes.matches[0].placeId || "TZ-DSM-POSTA",
      name: destRes.matches[0].name || "Posta",
      address: destRes.matches[0].displayName || "Posta, Dar es Salaam",
      lat: typeof destRes.matches[0].latitude === 'number' ? destRes.matches[0].latitude : -6.8164,
      lng: typeof destRes.matches[0].longitude === 'number' ? destRes.matches[0].longitude : 39.2902
    } : {
      placeId: "TZ-DSM-POSTA",
      name: "Posta",
      address: "Posta, Ilala, Dar es Salaam",
      lat: -6.8164,
      lng: 39.2902
    };

    const routeInfo = await getRoadDistanceAndDuration(pLoc, dLoc);
    const distKm = routeInfo.distanceKm;
    const durMin = routeInfo.durationMin;

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

    let reply = `🧮 *KADIRIO LA NAULI (FARE ESTIMATE)*\n\n`;
    reply += `📍 Kutoka: *${pLoc.name}*\n`;
    reply += `🏁 Kwenda: *${dLoc.name}*\n`;
    reply += `📏 Umbali: *${distKm} km* (~${durMin} dk)\n\n`;
    reply += `💰 *GHARAMA ZA SAFARI:*\n`;
    reply += `1. Boda Boda 🏍️: *TZS ${bodaFare.toLocaleString()}/=*\n`;
    reply += `2. Bajaji 🛺: *TZS ${bajajFare.toLocaleString()}/=*\n`;
    reply += `3. Gari la Teksi 🚕: *TZS ${carFare.toLocaleString()}/=*\n\n`;
    reply += `Tuma namba (1-3) kuagiza usafiri sasa hivi, au 0 kurudi Mwanzo.`;
    return reply;
  }

  if (session.step === 'TAXI_FARE_ESTIMATE_CONFIRM' && session.selectedService === 'taxi') {
    const calcData = session.optionsList?.[0];
    if (cleanInput === '0') {
      session.step = 'START';
      await saveSession(session, dbAdmin);
      return welcomeMessage;
    }

    let selectedType = '';
    let typeName = '';
    let fare = 0;

    if (cleanInput === '1') {
      selectedType = 'bike';
      typeName = 'Boda Boda 🏍️';
      fare = calcData?.bodaFare || 2000;
    } else if (cleanInput === '2') {
      selectedType = 'bajaj';
      typeName = 'Bajaji 🛺';
      fare = calcData?.bajajFare || 3500;
    } else if (cleanInput === '3') {
      selectedType = 'mini';
      typeName = 'Gari la Teksi 🚕';
      fare = calcData?.carFare || 7000;
    } else {
      return "⚠️ Chaguo si sahihi. Tafadhali tuma 1 (Boda), 2 (Bajaji), 3 (Gari), au 0 (Rudi Mwanzo).";
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

    if (session.passengerName && session.passengerPhone) {
      session.step = 'TAXI_ASK_PREVIOUS_DETAILS';
      await saveSession(session, dbAdmin);
      return `👤 *TAARIFA ZA MSAFIRI*\n\nTumepata taarifa za msafiri ulizowahi kutumia awali:\n- Jina: *${session.passengerName}*\n- Namba: *${session.passengerPhone}*\n\n1. Ndio, Tumia hizi\n2. Hapana, Weka mpya`;
    } else {
      session.step = 'TAXI_PASSENGER_NAME';
      await saveSession(session, dbAdmin);
      return `👤 *TAARIFA ZA MSAFIRI (Hatua ya 1/2)*\n\nTafadhali andika jina lako au la msafiri (Mfano: Juma Kiboko):`;
    }
  }

  // 3. PARCEL TRACKING HANDLER
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
    const statusText = foundParcel?.status === 'completed' ? 'Imewasilishwa Kikamilifu ✅' : 'Uko Njiani 🚚 (Ukiwasilishwa)';
    const sender = foundParcel?.customerName || "Amina Rashid";
    const receiver = foundParcel?.notes ? (foundParcel.notes.split('Mpokeaji:')[1] || "Kassim Ally") : "Kassim Ally";
    const driverName = foundParcel?.driverInfo?.name || "Juma Kapoya";
    const driverPhone = foundParcel?.driverInfo?.phone || "0712345678";
    const totalFare = foundParcel?.totalAmount || 5000;

    return `📦 *HALI YA MZIGO / KIFURUSHI*\n` +
           `Namba: *${trackingId}*\n\n` +
           `📌 Hali: *${statusText}*\n` +
           `👤 Mtumaji: *${sender}* (Posta)\n` +
           `👤 Mpokeaji: *${receiver}* (Mwenge)\n` +
           `🛵 Dereva: *${driverName}* (${driverPhone})\n` +
           `💵 Nauli: *TZS ${totalFare.toLocaleString()}/=* (Imelipwa ✅)\n` +
           `⏱️ Muda wa Kuwasili: *Takribani dk 12*\n\n` +
           `Tuma "0" au "HI" kurudi Menu Kuu.`;
  }

  // 4. DRIVER OFFLINE MODE HANDLERS
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
        ? `🟢 *HALI IMETHIBITISHWA: ONLINE!*\n\nDereva *${driverName}*, sasa upo tayari kupokea maombi ya safari za wateja kupitia USSD bila bando la intaneti!`
        : `🔴 *HALI IMETHIBITISHWA: OFFLINE.*\n\nDereva *${driverName}*, umesitisha kupokea maombi ya safari kwa sasa.`;
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
        return `🚖 *SAFARI MPYA*\n\nHakuna safari mpya inayokusubiri kwa sasa. Mfumo utakutumia SMS mara tu ombi jipya linapoingia!`;
      }

      session.activeRideId = pendingRide.id;
      session.step = 'DRIVER_ACCEPT_RIDE_CONFIRM';
      await saveSession(session, dbAdmin);

      const pName = pendingRide.pickup?.name || "Mwenge Stand";
      const dName = pendingRide.destination?.name || "Posta Mpya";
      const fare = pendingRide.fare || 6000;
      const clientName = pendingRide.customerInfo?.name || "Mteja";
      const clientPhone = pendingRide.customerInfo?.phone || "0712345678";

      return `🚖 *SAFARI INAYOKUSUBIRI (#${pendingRide.bookingId || 'PH-8890'})*\n\n` +
             `📍 Kutoka: *${pName}*\n` +
             `🏁 Kwenda: *${dName}*\n` +
             `💵 Nauli: *TZS ${fare.toLocaleString()}/=*\n` +
             `👤 Mteja: *${clientName}* (${clientPhone})\n\n` +
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
        return `📍 *SAFARI INAYOENDELEA*\n\nHuna safari inayostahili kusasishwa kwa sasa. Tuma "3" kwenye Menu ya Dereva ukiwa na safari active.`;
      }

      session.activeRideId = activeRide.id;
      session.step = 'DRIVER_UPDATE_TRIP';
      await saveSession(session, dbAdmin);

      const currentStatus = activeRide.status;
      const clientName = activeRide.customerInfo?.name || "Mteja";
      const clientPhone = activeRide.customerInfo?.phone || "0712345678";
      const fare = activeRide.fare || 5000;

      if (currentStatus === 'accepted') {
        return `📍 *SAFARI INAYOENDELEA*\nStatus: Umekubali kumfuata mteja *${clientName}* (${clientPhone})\n\n1. Nimefika Eneo la Mteja (Arrived)\n2. Ghairi Safari`;
      } else if (currentStatus === 'arrived') {
        return `📍 *SAFARI INAYOENDELEA*\nStatus: Umewasili kwa mteja *${clientName}*\n\n1. Anza Safari na Mteja (Start Trip)\n2. Ghairi Safari`;
      } else {
        return `📍 *SAFARI INAYOENDELEA*\nStatus: Safari ipo njiani na mteja *${clientName}*\n\n1. Maliza Safari & Pokea TZS ${fare.toLocaleString()}/= (Complete Trip)`;
      }
    } 
    else if (cleanInput === '4') {
      session.step = 'START';
      await saveSession(session, dbAdmin);

      return `💰 *SALIO NA MAPATO YA DEREVA*\n\n` +
             `Dereva: *${driverName}*\n` +
             `💵 Mapato ya Leo: *TZS 38,500/=*\n` +
             `🚖 Safari za Leo: *6 Completed*\n` +
             `💳 Salio la Wallet: *TZS 18,200/=*\n` +
             `📉 Kamisheni Inayodaiwa: *TZS 1,900/=*`;
    } 
    else if (cleanInput === '0') {
      session.step = 'START';
      await saveSession(session, dbAdmin);
      return welcomeMessage;
    } 
    else {
      return "⚠️ Chaguo si sahihi. Tafadhali tuma namba kuanzia 1 hadi 4, au 0 kurudi Menu Kuu.";
    }
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
      return `🎉 *UMEKUBALI SAFARI!*\n\nMteja amefahamishwa kwa SMS na simu. Nenda kumchukua eneo la kuanzia hivi sasa! 🚀`;
    } else {
      session.step = 'START';
      await saveSession(session, dbAdmin);
      return `❌ *UMEKATAA SAFARI.*\n\nSafari hii imerejeshwa kwenye mfumo kwa ajili ya dereva mwingine.`;
    }
  }

  if (session.step === 'DRIVER_UPDATE_TRIP') {
    const rideId = session.activeRideId;
    if (cleanInput === '1') {
      let nextStatus = 'arrived';
      let msg = "📍 Status imewasilishwa: Nimefika kwa Mteja!";

      if (dbAdmin && rideId) {
        try {
          const rDoc = await dbAdmin.collection('rides').doc(rideId).get();
          if (rDoc.exists) {
            const curStatus = rDoc.data()?.status;
            if (curStatus === 'accepted') {
              nextStatus = 'arrived';
              msg = "📍 Status imewasilishwa: Dereva Amewasili kwa Mteja!";
            } else if (curStatus === 'arrived') {
              nextStatus = 'in_progress';
              msg = "🚘 Status imewasilishwa: Safari imeanza na Mteja!";
            } else if (curStatus === 'in_progress') {
              nextStatus = 'completed';
              msg = "🎉 *SAFARI IMEKAMILIKA KIKAMILIFU!*\n\nAhsante kwa kumpa mteja huduma bora. Nauli imeongezwa kwenye mapato yako ya leo!";
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
      return `❌ Safari imesitishwa.`;
    }
  }

  // TAXI BOOKING FLOWS
  // State: TAXI_DISAMBIGUATE_PICKUP
  if (session.step === 'TAXI_DISAMBIGUATE_PICKUP' && session.selectedService === 'taxi') {
    const idx = parseInt(cleanInput) - 1;
    const candidates = session.optionsList || [];
    if (isNaN(idx) || idx < 0 || idx >= candidates.length) {
      return `⚠️ Chaguo si sahihi. Tafadhali tuma namba kuanzia 1 hadi ${candidates.length} kuchagua eneo sahihi:`;
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
        return `⚠️ Hatukuweza kupata eneo la mwisho la '${session.tempRawDestination}'.\n\nTafadhali andika eneo unalokwenda (Destination):`;
      } else if (destRes.matches.length === 1) {
        session.resolvedDest = destRes.matches[0];
        session.taxiRoute = `${selectedPlace.name} - ${destRes.matches[0].name}`;
        session.step = 'TAXI_VEHICLE_SELECT';
        session.optionsList = [];
        await saveSession(session, dbAdmin);
        return `🚕 *AINA YA USAFIRI*\n\nTafadhali chagua aina ya usafiri unaopendelea kwa kutuma namba yake:\n\n1. Boda Boda 🏍️ (Haraka na rahisi)\n2. Bajaji 🛺 (Nafuu na salama)\n3. Gari la Teksi 🚕 (Starehe na usalama mkubwa)`;
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
      return `📍 Eneo la kuanzia limethibitishwa: *${selectedPlace.name}*\n\nTafadhali andika eneo unalokwenda (Destination):`;
    }
  }

  // State: TAXI_DESTINATION_INPUT
  if (session.step === 'TAXI_DESTINATION_INPUT' && session.selectedService === 'taxi') {
    const destRes = await resolvePlace(cleanInput, dbAdmin);
    if (destRes.matches.length === 0) {
      return `⚠️ Hatukuweza kupata eneo la mwisho la '${cleanInput}'.\n\nTafadhali andika eneo lingine unalokwenda (Destination):`;
    } else if (destRes.matches.length === 1) {
      session.resolvedDest = destRes.matches[0];
      session.taxiRoute = `${session.resolvedPickup?.name || "Mwenge"} - ${destRes.matches[0].name}`;
      session.step = 'TAXI_VEHICLE_SELECT';
      session.optionsList = [];
      await saveSession(session, dbAdmin);
      return `🚕 *AINA YA USAFIRI*\n\nTafadhali chagua aina ya usafiri unaopendelea kwa kutuma namba yake:\n\n1. Boda Boda 🏍️ (Haraka na rahisi)\n2. Bajaji 🛺 (Nafuu na salama)\n3. Gari la Teksi 🚕 (Starehe na usalama mkubwa)`;
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
      return `⚠️ Chaguo si sahihi. Tafadhali tuma namba kuanzia 1 hadi ${candidates.length} kuchagua eneo sahihi:`;
    }

    const selectedPlace = candidates[idx];
    session.resolvedDest = selectedPlace;
    session.taxiRoute = `${session.resolvedPickup?.name || "Mwenge"} - ${selectedPlace.name}`;
    session.step = 'TAXI_VEHICLE_SELECT';
    session.optionsList = [];
    await saveSession(session, dbAdmin);

    return `🚕 *AINA YA USAFIRI*\n\nTafadhali chagua aina ya usafiri unaopendelea kwa kutuma namba yake:\n\n1. Boda Boda 🏍️ (Haraka na rahisi)\n2. Bajaji 🛺 (Nafuu na salama)\n3. Gari la Teksi 🚕 (Starehe na usalama mkubwa)`;
  }

  // State: TAXI_ROUTE
  if (session.step === 'TAXI_ROUTE' && session.selectedService === 'taxi') {
    const parsed = splitTwoLocations(cleanInput);

    if (parsed) {
      // Two-location route (A - B)
      const pickupRes = await resolvePlace(parsed.rawPickup, dbAdmin);
      if (pickupRes.matches.length === 0) {
        return `⚠️ Hatukuweza kupata eneo la kuanzia la '${parsed.rawPickup}'. Tafadhali andika upya eneo la kuanzia kwa usahihi au weka eneo lingine la kuanzia (Mfano: Posta - Mikocheni):`;
      } else if (pickupRes.matches.length === 1) {
        session.resolvedPickup = pickupRes.matches[0];

        const destRes = await resolvePlace(parsed.rawDestination, dbAdmin);
        if (destRes.matches.length === 0) {
          session.step = 'TAXI_DESTINATION_INPUT';
          await saveSession(session, dbAdmin);
          return `⚠️ Hatukuweza kupata eneo la mwisho la '${parsed.rawDestination}'.\n\nTafadhali andika eneo unalokwenda sasa hivi (Destination):`;
        } else if (destRes.matches.length === 1) {
          session.resolvedDest = destRes.matches[0];
          session.taxiRoute = `${pickupRes.matches[0].name} - ${destRes.matches[0].name}`;
          session.step = 'TAXI_VEHICLE_SELECT';
          await saveSession(session, dbAdmin);
          return `🚕 *AINA YA USAFIRI*\n\nTafadhali chagua aina ya usafiri unaopendelea kwa kutuma namba yake:\n\n1. Boda Boda 🏍️ (Haraka na rahisi)\n2. Bajaji 🛺 (Nafuu na salama)\n3. Gari la Teksi 🚕 (Starehe na usalama mkubwa)`;
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
        return `⚠️ Hatukuweza kupata eneo la '${cleanInput}'.\n\nTafadhali andika njia yako kwa usahihi kwa kutumia alama ya '-' (Mfano: Posta - Kimara):`;
      } else if (pickupRes.matches.length === 1) {
        session.resolvedPickup = pickupRes.matches[0];
        session.step = 'TAXI_DESTINATION_INPUT';
        await saveSession(session, dbAdmin);
        return `📍 Eneo la kuanzia limethibitishwa: *${pickupRes.matches[0].name}*\n\nTafadhali andika eneo unalokwenda (Destination):`;
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
      typeName = 'Boda Boda 🏍️';
    } else if (cleanInput === '2' || lowerInput.includes('bajaj') || lowerInput.includes('sharo')) {
      vehicleType = 'bajaj';
      typeName = 'Bajaji 🛺';
    } else if (cleanInput === '3' || lowerInput.includes('taxi') || lowerInput.includes('gari') || lowerInput.includes('mini') || lowerInput.includes('car')) {
      vehicleType = 'mini';
      typeName = 'Gari la Teksi 🚕';
    } else {
      return `⚠️ Chaguo si sahihi. Tafadhali tuma:\n1. Boda Boda 🏍️\n2. Bajaji 🛺\n3. Gari la Teksi 🚕`;
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
                typeName = 'Boda Boda 🏍️';
              } else if (driverVTypeNormalized === 'bajaj') {
                typeName = 'Bajaji 🛺';
              } else {
                typeName = 'Gari la Teksi 🚕';
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

    let reply = `🧮 *KADIRIO LA NAULI*\n\n`;
    reply += `Kutoka: *${pickupName}*\n`;
    reply += `Kwenda: *${destName}*\n`;
    reply += `nisawa na kilometa : *${distanceKm} km* (Muda wa safari: ~${durationMin} dk)\n`;
    reply += `Aina ya Usafiri: *${typeName}*\n\n`;
    reply += `💵 *Nauli inayokadiriwa: TZS ${fare.toLocaleString()}/=*\n`;
    reply += `📌 Tuna madereva *${nearbyCount}* karibu nawe waliotayari!\n\n`;
    reply += `Je, unakubali kuanza kutafutiwa dereva?\n`;
    reply += `1. Ndio, Tafuta Dereva\n`;
    reply += `2. Hapana, Ghairi Safari`;
    return reply;
  }

  if (session.step === 'TAXI_CONFIRM_TRIP' && session.selectedService === 'taxi') {
    const calcData = session.optionsList?.[0];
    if (!calcData) {
      session.step = 'START';
      await saveSession(session, dbAdmin);
      return `⚠️ Hitilafu imetokea. Tafadhali tuma "HI" kuanza upya.`;
    }

    if (cleanInput === '1' || lowerInput.includes('ndio') || lowerInput.includes('tafuta') || lowerInput.includes('kubali') || lowerInput.includes('yes')) {
      if (session.passengerName && session.passengerPhone) {
        session.step = 'TAXI_ASK_PREVIOUS_DETAILS';
        await saveSession(session, dbAdmin);
        return `👤 *TAARIFA ZA MSAFIRI*\n\nTumepata taarifa za msafiri ulizowahi kutumia awali:\n- Jina: *${session.passengerName}*\n- Namba ya Simu: *${session.passengerPhone}*\n\nJe, ungependa kutumia taarifa hizi za awali au kuweka mpya?\n\n*1* - Ndio, Tumia hizi hizi\n*2* - Hapana, Badilisha taarifa (Weka mpya)`;
      } else {
        session.step = 'TAXI_PASSENGER_NAME';
        await saveSession(session, dbAdmin);
        return `👤 *TAARIFA ZA MSAFIRI (Hatua ya 1/2)*\n\nTafadhali andika jina lako au la msafiri (Mfano: Juma Kiboko):`;
      }
    } else if (cleanInput === '2' || lowerInput.includes('hapana') || lowerInput.includes('ghairi') || lowerInput.includes('no') || lowerInput.includes('cancel')) {
      session.step = 'START';
      session.selectedService = undefined;
      session.optionsList = [];
      await saveSession(session, dbAdmin);
      return `❌ Safari yako imesitishwa kikamilifu. Karibu tena wakati mwingine ukiwa tayari kusafiri na Papo Hapo! 🚖`;
    } else {
      return `⚠️ Samahani, sielewi chaguo lako. Tafadhali tuma:\n*1* - Ndio, Tafuta Dereva\n*2* - Hapana, Ghairi Safari`;
    }
  }

  if (session.step === 'TAXI_ASK_PREVIOUS_DETAILS' && session.selectedService === 'taxi') {
    const calcData = session.optionsList?.[0];
    if (!calcData) {
      session.step = 'START';
      await saveSession(session, dbAdmin);
      return `⚠️ Hitilafu imetokea. Tafadhali tuma "HI" kuanza upya.`;
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

      return `✅ *Oda ya Taxi imewasilishwa!* 🚖\n\n` +
             `Safari ya msafiri *${finalPassengerName}* (${finalPhone}) imetumwa kwa madereva wa *${calcData.typeName}* waliopo karibu.\n\n` +
             `- Kutoka: *${calcData.pickupName}*\n` +
             `- Kwenda: *${calcData.destName}*\n` +
             `- Umbali: *${calcData.distanceKm} km*\n` +
             `- Muda wa safari: *~${calcData.durationMin} dk*\n` +
             `- Nauli: *TZS ${calcData.fare?.toLocaleString()}/=*\n\n` +
             `Madereva wa karibu wamepewa taarifa sasa hivi. Dereva atakapokubali kukuja kukufuata, msafiri atafahamishwa kupitia SMS na kupigiwa simu kwenye namba *${finalPhone}*. Ahsante sana kwa kutumia Papo Hapo! 🙏✨`;
    } else if (cleanInput === '2' || lowerInput.includes('hapana') || lowerInput.includes('badilisha') || lowerInput.includes('weka') || lowerInput.includes('mpya') || lowerInput.includes('no')) {
      session.step = 'TAXI_PASSENGER_NAME';
      await saveSession(session, dbAdmin);
      return `👤 *TAARIFA ZA MSAFIRI (Hatua ya 1/2)*\n\nTafadhali andika jina lako au la msafiri (Mfano: Juma Kiboko):`;
    } else {
      return `⚠️ Chaguo si sahihi. Tafadhali jibu kwa kuandika:\n*1* - Kutumia taarifa za awali\n*2* - Kubadilisha taarifa (Kuweka mpya)`;
    }
  }

  if (session.step === 'TAXI_PASSENGER_NAME' && session.selectedService === 'taxi') {
    if (!cleanInput) {
      return `⚠️ Tafadhali andika jina la msafiri (Mfano: John Doe):`;
    }
    session.passengerName = cleanInput;
    session.step = 'TAXI_PASSENGER_PHONE';
    await saveSession(session, dbAdmin);
    return `📞 *TAARIFA ZA MSAFIRI (Hatua ya 2/2)*\n\nTafadhali andika namba ya simu ya msafiri (Mfano: 0712345678).\n\n👉 *Tuma alama ya nyota (*) kama unataka kutumia namba yako hii hii ya sasa (${session.phone.replace('ussd:', '')}):*`;
  }

  if (session.step === 'TAXI_PASSENGER_PHONE' && session.selectedService === 'taxi') {
    const calcData = session.optionsList?.[0];
    if (!calcData) {
      session.step = 'START';
      await saveSession(session, dbAdmin);
      return `⚠️ Hitilafu imetokea. Tafadhali tuma "HI" kuanza upya.`;
    }

    let finalPhone = session.phone.replace('ussd:', '');
    if (cleanInput !== '*') {
      const rawInput = cleanInput.replace(/\s+/g, '');
      if (/^[0-9+]+$/.test(rawInput) && rawInput.length >= 8) {
        finalPhone = rawInput;
      } else {
        return `⚠️ Namba ya simu si sahihi. Tafadhali andika namba sahihi au tuma alama ya nyota (*) kutumia namba hii ya sasa:`;
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

    return `✅ *Oda ya Taxi imewasilishwa!* 🚖\n\n` +
           `Safari ya msafiri *${finalPassengerName}* (${finalPhone}) imetumwa kwa madereva wa *${calcData.typeName}* waliopo karibu.\n\n` +
           `- Kutoka: *${calcData.pickupName}*\n` +
           `- Kwenda: *${calcData.destName}*\n` +
           `- Umbali: *${calcData.distanceKm} km*\n` +
           `- Muda wa safari: *~${calcData.durationMin} dk*\n` +
           `- Nauli: *TZS ${calcData.fare?.toLocaleString()}/=*\n\n` +
           `Madereva wa karibu wamepewa taarifa sasa hivi. Dereva atakapokubali kukuja kukufuata, msafiri atafahamishwa kupitia SMS na kupigiwa simu kwenye namba *${finalPhone}*. Ahsante sana kwa kutumia Papo Hapo! 🙏✨`;
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

    let reply = `💇‍♀️ Saluni bora kabisa karibu nawe kwa ajili ya [${subLabel}]:\n\n`;
    salons.forEach((sal, idx) => {
      reply += `${idx + 1}. ${sal.name}\n📍 ${sal.desc}\n💰 Huduma kuanzia: TSH ${sal.price.toLocaleString()}\n\n`;
    });
    reply += "Tuma namba ya Saluni unayotaka kujitengeneza miadi (booking) sasa hivi:";
    return reply;
  }

  if (session.step === 'SALON_SELECT' && session.selectedService === 'salon') {
    const idx = parseInt(cleanInput) - 1;
    const selected = session.optionsList?.[idx];
    if (!selected) {
      return "⚠️ Namba uliyotuma si sahihi. Tafadhali tuma 1, 2 au 3 kulingana na saluni unayotaka.";
    }

    session.selectedSalonId = selected.id;
    session.selectedSalonName = selected.name;
    session.step = 'START'; // complete
    await saveSession(session, dbAdmin);

    // Create realistic order
    await triggerMockOrder(dbAdmin, selected.id, 'salon', [{ name: `Service Custom: ${session.selectedSalonCategory}`, price: selected.price, quantity: 1 }], selected.price, fromPhone, "Weka Miadi SMS", `SMS request for ${session.selectedSalonCategory}`);

    return `💇‍♀️ Hongera sana! Umefanikiwa kuweka miadi (booking) na "${selected.name}".\n💰 Huduma ya Kuanzia: TSH ${selected.price.toLocaleString()}\n⏳ Tafadhali fika saluni kwa wakati kukamilisha huduma yako. Simu ya Saluni itawasiliana nawe punde! Ahsante! ✨`;
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

    let reply = `🚌 Safari za route ya ${routeParts}:\nChagua basi kwa kutuma namba yake:\n\n`;
    operators.forEach((op, idx) => {
      reply += `${idx + 1}. ${op.businessName}\n💰 Nauli: TSH ${op.price.toLocaleString()}\n\n`;
    });
    reply += "Weka namba ya mtoa usafiri sasa hivi kukata kiti chako:";
    return reply;
  }

  if (session.step === 'BUS_SELECT_OPERATOR' && session.selectedService === 'bus_ticket') {
    const idx = parseInt(cleanInput) - 1;
    const selected = session.optionsList?.[idx];
    if (!selected) {
      return "⚠️ Namba ya basi uliyotuma si sahihi. Chagua namba sahihi ya opereta kwenye orodha yetu.";
    }

    session.selectedOperatorId = selected.id;
    session.selectedOperatorName = selected.businessName;
    session.selectedProductPrice = selected.price;
    session.step = 'BUS_SEAT';
    await saveSession(session, dbAdmin);

    return `🚌 Umechagua Basi la: ${selected.businessName}.\n\nTafadhali chagua namba ya kiti upendacho kukaa.\nMfano wa viti vilivyowazi sasa:\nA12, B3, C7, D10.\n\nTuma herufi ya kiti chako sasa:`;
  }

  if (session.step === 'BUS_SEAT' && session.selectedService === 'bus_ticket') {
    const seatInput = cleanInput.toUpperCase();
    session.selectedSeat = seatInput;
    session.step = 'BUS_PHONE';
    await saveSession(session, dbAdmin);

    return `💺 Umechagua *KITI ${seatInput}* kwenye basi la ${session.selectedOperatorName}.\n\nTafadhali tuma namba ya simu ya lipa hapa (pesa ya simu) ya kufanya malipo (Mfano: 0712345678 au 0687123456):`;
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

    return `🎉 ASDANTE SANA! Umefanikiwa kuhifadhi kiti chako:\n\n` +
           `- Route: ${session.busRoute}\n` +
           `- Basi: ${session.selectedOperatorName}\n` +
           `- Kiti: ${session.selectedSeat}\n` +
           `- Malipo Mapokezi: TSH ${(session.selectedProductPrice || 45000).toLocaleString()}\n` +
           `- Simu ya malipo: ${paymentPhone}\n\n` +
           `Tumetuma ombi la kulipia kupitia mtandao wa simu (PUSH) kwenda ${paymentPhone}. Tafadhali weka PIN yako kukamilisha ununuzi. Tiketi yako kamili itatuma kwa SMS punde! Safari njema! 🚌✨`;
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

    let reply = `📦 Bidhaa zote tulizopata kwa neno: ["${cleanInput}"]:\n\n`;
    matches.forEach((p, idx) => {
      reply += `${idx + 1}. ${p.name}\n💰 Bei: TSH ${p.price.toLocaleString()}\n\n`;
    });
    reply += "Tuma namba ya bidhaa unayotaka kuagiza sasa hivi:";
    return reply;
  }

  if (session.step === 'STORE_SELECT_ITEM') {
    const idx = parseInt(cleanInput) - 1;
    const selected = session.optionsList?.[idx];
    if (!selected) {
      return "⚠️ Namba ya bidhaa si sahihi. Chagua namba sahihi kuanzia kwenye list.";
    }

    session.selectedProductId = selected.id;
    session.selectedProductName = selected.name;
    session.selectedProductPrice = selected.price;
    session.selectedOperatorId = selected.vendorId; // save target vendor
    session.step = 'STORE_PHONE';
    await saveSession(session, dbAdmin);

    return `🛍️ Umechagua kuagiza:\n[${selected.name} - TSH ${selected.price.toLocaleString()}]\n\nTafadhali tuma namba ya simu ya kufanyia malipo na uwasilishaji sasa (Mfano: 07XXXXXXXX):`;
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

    return `🎉 ODA YAKO IMESAJILIWA!\n\n` +
           `- Huduma: ${session.selectedProductName}\n` +
           `- Jumla ya Kulipa: TSH ${(session.selectedProductPrice || 0).toLocaleString()}\n` +
           `- Namba ya mteja: ${deliveryPhone}\n\n` +
           `Tumetuma ujumbe wa muamala (Push prompt) kwenye simu yako ya malipo tayari. Baada ya kukamilisha weka siri, duka litaandaa na kuwasilisha mzigo wako haraka iwezekanavyo! Ahsante sana! 🍱🚴‍♂️`;
  }

  // Fallback reset
  session.step = 'START';
  await saveSession(session, dbAdmin);
  return welcomeMessage;
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
