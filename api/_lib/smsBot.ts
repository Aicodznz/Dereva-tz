export interface SMSSession {
  phone: string;
  step: 'START' | 'SELECT_SERVICE' | 'BUS_ROUTE' | 'BUS_SELECT_OPERATOR' | 'BUS_SEAT' | 'BUS_PHONE' | 'TAXI_ROUTE' | 'TAXI_DRIVER_SELECT' | 'SALON_SUB' | 'SALON_SELECT' | 'STORE_SEARCH' | 'STORE_SELECT_ITEM' | 'STORE_PHONE';
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
}

// In-memory fallback sessions state
const inMemorySessions = new Map<string, SMSSession>();

// Simple in-memory global config for Twilio Responder (can be updated by vendors)
export interface TwilioConfig {
  isEnabled: boolean;
  welcomeMessage: string;
  phoneNumber: string; 
  vendorRules: Record<string, { welcome: string; services: string[] }>;
}

export const defaultTwilioConfig: TwilioConfig = {
  isEnabled: true,
  welcomeMessage: "Karibu kwenye Mfumo wa Huduma za Papo Hapo! 🌟\n\nTafadhali chagua huduma unayotaka kwa kutuma namba yake:\n1. 🚕 TAXI\n2. 💇‍♀️ SALUNI (Salons)\n3. 🚌 MABASI (Bus Tickets)\n4. 🥗 CHAKULA (Restaurants)\n5. 🥦 SOKO (Groceries)\n6. 💊 PHARMACY",
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
  dbAdmin: any
): Promise<string> {
  const cleanInput = textBody.trim();
  const lowerInput = cleanInput.toLowerCase();
  
  // Get existing flow session
  const session = await getSession(fromPhone, dbAdmin);

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
    return defaultTwilioConfig.welcomeMessage;
  }

  // Step 1: Selecting Category Service
  if (session.step === 'SELECT_SERVICE') {
    if (cleanInput === '1') {
      // TAXI
      session.step = 'TAXI_ROUTE';
      session.selectedService = 'taxi';
      await saveSession(session, dbAdmin);
      return "🚕 MFUMO WA TAXI (Taxi Booking):\n\nTafadhali tuma njia unayotaka kusafiri (Kutoka kuelekea unapoenda).\nMfano:\nPOSTA - KINONDONI\nau AIRPORT - MASAKI";
    } 
    else if (cleanInput === '2') {
      // SALUNI
      session.step = 'SALON_SUB';
      session.selectedService = 'salon';
      await saveSession(session, dbAdmin);
      return "💇‍♀️ MFUMO WA SALUNI (Salons Near You):\n\nChagua aina ya huduma ya urembo unayotafuta kwa kutuma namba:\n1. Saluni ya Nywele (Nywele / Hair cuts)\n2. Matunzo ya Kucha (Manicure / Nails)\n3. Urembo & Make-up\n4. Spa & Body Massage";
    } 
    else if (cleanInput === '3') {
      // MABASI
      session.step = 'BUS_ROUTE';
      session.selectedService = 'bus_ticket';
      await saveSession(session, dbAdmin);
      return "🚌 MFUMO WA MABASI (Bus Booking):\n\nTafadhali tuma route unayotaka kusafiri (Mwanzo - Mwisho).\nMfano:\nDAR - MWANZA\nau ARUSHA - KILIMANJARO";
    } 
    else if (cleanInput === '4') {
      // CHAKULA
      session.step = 'STORE_SEARCH';
      session.selectedService = 'restaurant';
      await saveSession(session, dbAdmin);
      return "🍱 MFUMO WA VILAJI NA CHAKULA (Restaurants):\n\nTuma jina la chakula unachotafuta sasa hivi.\nMfano:\nChips Kuku, Wali Nyama, Samaki au Biryani:";
    } 
    else if (cleanInput === '5') {
      // SOKO
      session.step = 'STORE_SEARCH';
      session.selectedService = 'grocery';
      await saveSession(session, dbAdmin);
      return "🥦 MFUMO WA SOKONI (Groceries & Market):\n\nTuma jina la bidhaa ya soko unayotaka kununua leo.\nMfano:\nNdizi, Nyanya, Vitunguu au Mchele:";
    } 
    else if (cleanInput === '6') {
      // PHARMACY
      session.step = 'STORE_SEARCH';
      session.selectedService = 'pharmacy';
      await saveSession(session, dbAdmin);
      return "💊 MFUMO WA PHARMACY (Dawa & Pharmacy):\n\nTuma jina la dawa unayotafuta sasa hivi hospitalini.\nMfano:\nParacetamol, Panadol, Amoxicillin au Dawa ya Kikohozi:";
    }
    else {
      return "⚠️ Chaguo si sahihi! Tafadhali tuma namba kuanzia 1 mpaka 6 kuchagua huduma sahihi, au tuma \"HI\" kuanza upya.";
    }
  }

  // TAXI BOOKING FLOWS
  if (session.step === 'TAXI_ROUTE' && session.selectedService === 'taxi') {
    session.taxiRoute = cleanInput.toUpperCase();
    session.step = 'TAXI_DRIVER_SELECT';
    
    // Simulate drivers
    const drivers = [
      { id: 'drv-1', name: 'Juma Ally (Vitz - White)', price: 6500, rating: '⭐ 4.9' },
      { id: 'drv-2', name: 'Frank Kimaro (Passo - Silver)', price: 7000, rating: '⭐ 4.8' },
      { id: 'drv-3', name: 'Amos Shayo (Bajaji - Yellow)', price: 4000, rating: '⭐ 4.7' }
    ];
    session.optionsList = drivers;
    await saveSession(session, dbAdmin);

    let reply = `🚕 Tumepata madereva 3 wanaofanya kazi njia ya ${session.taxiRoute}:\n\n`;
    drivers.forEach((drv, idx) => {
      reply += `${idx + 1}. ${drv.name} - ${drv.rating}\n💰 Bei: TSH ${drv.price.toLocaleString()}\n\n`;
    });
    reply += "Tuma namba ya dereva unayependa kumpata sasa:";
    return reply;
  }

  if (session.step === 'TAXI_DRIVER_SELECT' && session.selectedService === 'taxi') {
    const idx = parseInt(cleanInput) - 1;
    const selected = session.optionsList?.[idx];
    if (!selected) {
      return "⚠️ Namba uliyotuma si sahihi. Tafadhali tuma 1, 2 au 3 kuchagua dereva.";
    }

    session.selectedDriverName = selected.name;
    session.selectedDriverPrice = selected.price;
    session.step = 'START'; // End flow
    await saveSession(session, dbAdmin);

    // Create realistic ride order in Firestore
    if (dbAdmin) {
      try {
         await dbAdmin.collection('rides').add({
           customerId: "sms-client-" + fromPhone.slice(-6),
           customerPhone: fromPhone,
           driverName: selected.name,
           status: "accepted",
           route: session.taxiRoute,
           fare: selected.price,
           createdAt: new Date()
         });
      } catch (e) {
         console.warn("Could not insert ride request", e);
      }
    }

    return `✅ Hongera! Dereva ${selected.name} amepokea ombi lako.\n📍 Njia: ${session.taxiRoute}\n💰 Bei ya kulipa: TSH ${selected.price.toLocaleString()}\n\nDereva atakupigia simu sasa hivi kufuata ulipo. Ahsante kwa kutumia Papo Hapo! 🚕`;
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
  return defaultTwilioConfig.welcomeMessage;
}
