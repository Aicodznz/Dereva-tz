import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import { resolvePlace, getRoadDistanceAndDuration, SEED_PLACES } from './geocoder.js';
import { cleanUndefined } from './getFirestoreDb.js';

export interface MetaHistoryEntry {
  step: MetaSession['step'];
  service?: MetaSession['service'];
  details: Record<string, any>;
  prompt: string;
}

export interface MetaSavedLocation {
  placeId?: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  updatedAt?: number;
}

export interface MetaSession {
  senderId: string;
  channel: 'whatsapp' | 'messenger' | 'instagram';
  step:
    | 'START'
    | 'CHOOSING_LANGUAGE'
    | 'CHANGING_PHONE'
    | 'REGISTERING_CUSTOMER'
    | 'COLLECTING_ROUTE'
    | 'SELECTING_OPTION'
    | 'SELECTING_PAYMENT_METHOD'
    | 'COLLECTING_PHONE'
    | 'CONFIRMING'
    | 'SELECTING_VEHICLE'
    | 'CONFIRMING_TRIP'
    | 'RATING_DRIVER'
    | 'FOOD_CHOOSE_MODE'
    | 'FOOD_SELECT_VENDOR'
    | 'FOOD_SELECT_ITEM'
    | 'FOOD_ITEM_QUANTITY'
    | 'FOOD_CART_DECISION'
    | 'FOOD_DELIVERY_ADDRESS'
    | 'TABLE_SELECT_SEATS'
    | 'TABLE_SELECT_TIME'
    | 'TABLE_ASK_PREORDER'
    | 'HOTEL_SELECT_VENDOR'
    | 'HOTEL_SELECT_ROOM'
    | 'TRACKING_LOOKUP_PHONE'
    | 'FIX_SELECT_CAT'
    | 'FIX_SELECT_VENDOR'
    | 'FIX_DESCRIBE_PROBLEM'
    | 'MALL_SELECT_ITEM'
    | 'MALL_QUANTITY'
    | 'MALL_DELIVERY_ADDRESS'
    | 'EVENT_SELECT'
    | 'EVENT_SELECT_TIER'
    | 'EVENT_QUANTITY'
    | 'PAPOPAY_MENU'
    | 'PAPOPAY_PAY_TARGET'
    | 'PAPOPAY_PAY_AMOUNT';
  service?:
    | 'taxi'
    | 'food'
    | 'grocery'
    | 'parcel'
    | 'salon'
    | 'hotel'
    | 'car_rental'
    | 'pharmacy'
    | 'bus_ticket'
    | 'handyman'
    | 'ecommerce'
    | 'events'
    | 'papopay';
  details: {
    route?: string;
    itemQuery?: string;
    selectedId?: string;
    selectedName?: string;
    selectedPrice?: number;
    phone?: string;
    lastLocation?: MetaSavedLocation;
    optionsList?: any[];
    [key: string]: any;
  };
  history?: MetaHistoryEntry[];
  lastPrompt?: string;
  lastUpdated: number;
}

export interface MetaMediaAttachment {
  url: string;
  caption?: string;
}

export interface MetaBotResponse {
  text: string;
  media: MetaMediaAttachment[];
}

export interface MetaCustomerProfile {
  senderId: string;
  channel: 'whatsapp' | 'messenger' | 'instagram';
  name: string;
  phone: string;
  lang?: 'sw' | 'en';
  lastLocation?: MetaSavedLocation;
  createdAt: number;
}

// In-memory fallbacks
const metaSessions = new Map<string, MetaSession>();
const metaCustomers = new Map<string, MetaCustomerProfile>();

// Lazy initialization of GoogleGenAI to prevent startup crash if GEMINI_API_KEY is not defined
let aiClient: any = null;

function getAI() {
  if (!aiClient) {
    const apiKey = typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

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

async function resolveGpsLocationPin(rawInput: string): Promise<{
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
} | null> {
  if (!rawInput || !rawInput.startsWith('__GPS_PIN__:')) return null;
  const payload = rawInput.slice('__GPS_PIN__:'.length);
  const [coordPart = '', pinName = '', pinAddr = ''] = payload.split('|');
  const [latStr, lngStr] = coordPart.split(',');
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  if (isNaN(lat) || isNaN(lng)) return null;

  let resolvedName = pinName.trim();
  let resolvedAddress = pinAddr.trim();

  if (!resolvedName) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const revResp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17`,
        {
          headers: { 'User-Agent': 'PapoHapoSuperApp/1.0' },
          signal: controller.signal,
        }
      );
      clearTimeout(timer);
      if (revResp.ok) {
        const revJson: any = await revResp.json();
        const addr = revJson?.address || {};
        resolvedName =
          addr.suburb ||
          addr.neighbourhood ||
          addr.road ||
          addr.city_district ||
          addr.town ||
          addr.city ||
          '';
        resolvedAddress = revJson?.display_name || resolvedAddress;
      }
    } catch {
      // Fallback smoothly to nearest SEED_PLACES
    }
  }

  if (!resolvedName) {
    let bestPlace = SEED_PLACES[0];
    let bestDist = Infinity;
    for (const p of SEED_PLACES) {
      const d = calculateDistanceKm(lat, lng, p.latitude, p.longitude);
      if (d < bestDist) {
        bestDist = d;
        bestPlace = p;
      }
    }
    if (bestPlace && bestDist <= 15) {
      resolvedName = bestDist <= 1.2 ? bestPlace.name : `Karibu na ${bestPlace.name}`;
      resolvedAddress = resolvedAddress || bestPlace.displayName;
    } else {
      resolvedName = `Eneo la GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      resolvedAddress = resolvedAddress || resolvedName;
    }
  }

  return {
    placeId: `GPS-${lat.toFixed(4)}-${lng.toFixed(4)}`,
    name: resolvedName,
    address: resolvedAddress || resolvedName,
    lat,
    lng,
  };
}

async function getMetaCustomerProfile(
  senderId: string,
  channel: 'whatsapp' | 'messenger' | 'instagram',
  dbAdmin: any
): Promise<MetaCustomerProfile | null> {
  const key = `${channel}:${senderId}`;
  const cached = metaCustomers.get(key);
  if (cached) return cached;

  if (dbAdmin) {
    try {
      const snap = await dbAdmin.collection('meta_customers').doc(key).get();
      if (snap.exists) {
        const data = snap.data() as MetaCustomerProfile;
        if (data?.name) {
          metaCustomers.set(key, data);
          return data;
        }
      }

      if (channel === 'whatsapp') {
        const cleanDigits = senderId.replace(/\D/g, '');
        const localPhone = cleanDigits.startsWith('255') ? `0${cleanDigits.slice(3)}` : cleanDigits;
        const usersCol = dbAdmin.collection('users');
        for (const candidate of [`+${cleanDigits}`, cleanDigits, localPhone]) {
          const uSnap = await usersCol.where('phone', '==', candidate).limit(1).get();
          if (!uSnap.empty) {
            const uData = uSnap.docs[0].data();
            const resolvedName = uData?.displayName || uData?.name;
            if (resolvedName) {
              const profile: MetaCustomerProfile = {
                senderId,
                channel,
                name: resolvedName,
                phone: uData.phone || `+${cleanDigits}`,
                createdAt: Date.now(),
              };
              metaCustomers.set(key, profile);
              return profile;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Meta Bot] Customer lookup failed:', err);
    }
  }
  return null;
}

async function saveMetaCustomerProfile(
  profile: MetaCustomerProfile,
  dbAdmin: any
): Promise<void> {
  const key = `${profile.channel}:${profile.senderId}`;
  metaCustomers.set(key, profile);
  if (dbAdmin) {
    try {
      await dbAdmin.collection('meta_customers').doc(key).set(cleanUndefined(profile));
      const cleanId = profile.senderId.replace(/[^a-zA-Z0-9]/g, '');
      const userId = `meta-${profile.channel}-${cleanId}`;
      const fallbackEmail = `${cleanId || 'guest'}@${profile.channel}.papohapo.tz`;
      await dbAdmin.collection('users').doc(userId).set(
        cleanUndefined({
          displayName: profile.name,
          name: profile.name,
          email: fallbackEmail,
          phone: profile.phone,
          role: 'customer',
          channel: profile.channel,
          metaSenderId: profile.senderId,
          updatedAt: new Date(),
        }),
        { merge: true }
      );
    } catch (err) {
      console.warn('[Meta Bot] Failed saving customer profile:', err);
    }
  }
}

/**
 * Smart Natural Language Parser for Swahili & English Ride Requests
 * Extracts vehicle type, clean pickup, and clean destination
 */
export function extractRideDetailsFromText(rawText: string): {
  vehicleType?: 'bike' | 'bajaj' | 'mini';
  vehicleTypeName?: string;
  pickupName?: string;
  destName?: string;
} {
  const text = (rawText || "").trim();

  // 1. Detect vehicle type if mentioned
  let vehicleType: 'bike' | 'bajaj' | 'mini' | undefined;
  let vehicleTypeName: string | undefined;

  if (/\b(boda|bodaboda|pikipiki|piki|bike|motorcycle)\b/i.test(text)) {
    vehicleType = 'bike';
    vehicleTypeName = 'Boda Boda 🏍️';
  } else if (/\b(bajaj|bajaji|sharo|tuk[\s-]?tuk|keke)\b/i.test(text)) {
    vehicleType = 'bajaj';
    vehicleTypeName = 'Bajaji 🛺';
  } else if (/\b(gari|teksi|taxi|cab|uber|bolt|car|mini)\b/i.test(text)) {
    vehicleType = 'mini';
    vehicleTypeName = 'Gari la Teksi 🚕';
  }

  // 2. Clean conversational filler words
  let clean = text
    .replace(/^(habari|mambo|vip|hallo|hello|hi|je|tafadhali)[,\s]+/i, "")
    .replace(/^(naomba|nahitaji|nataka|omba|agiza|tuma|nisaidie)\s+(usafiri|huduma|oda)?\s*(wa|ya|la)?\s*/i, "")
    .replace(/^(nauli|bei|gharama)\s+(ya|za)?\s*/i, "")
    .replace(/\b(usafiri|huduma)\s+(wa|ya|la)?\s*/i, "")
    .replace(/\b(wa|ya|la)?\s*(boda\s*boda|boda|pikipiki|bajaji|bajaj|gari\s*la\s*teksi|gari|teksi|taxi)\b/gi, "")
    .replace(/\b(ni\s+ngapi|ngapi|kwa\s+bei\s+gani|\?)\s*$/gi, "")
    .trim();

  let pickup: string | undefined;
  let dest: string | undefined;

  // Pattern A: "toka/kutoka <pickup> kwenda/hadi/kuelekea/to/mpaka <dest>"
  const matchA = clean.match(/(?:kutoka|toka|from)\s+([^,]+?)\s+(?:kwenda|kuelekea|hadi|mpaka|to)\s+(.+)/i);
  if (matchA && matchA[1] && matchA[2]) {
    pickup = matchA[1].trim();
    dest = matchA[2].trim();
  } else {
    // Pattern B: "<pickup> kwenda/hadi/kuelekea/to <dest>"
    const matchB = clean.match(/^([^,]+?)\s+(?:kwenda|kuelekea|hadi|mpaka|to)\s+(.+)/i);
    if (matchB && matchB[1] && matchB[2]) {
      pickup = matchB[1].trim();
      dest = matchB[2].trim();
    } else {
      // Pattern C: Separator like " - ", " – ", " / "
      const sepMatch = clean.match(/^([^-–/]+?)\s*(?:-|–|\/)\s*(.+)$/);
      if (sepMatch && sepMatch[1] && sepMatch[2]) {
        pickup = sepMatch[1].trim();
        dest = sepMatch[2].trim();
      }
    }
  }

  // Clean remaining prefixes & suffixes
  if (pickup) {
    pickup = pickup
      .replace(/^(kutoka|toka|from|hapa)\s+/i, "")
      .replace(/^(naomba|nahitaji|nataka)\s+(usafiri|gari|boda|bajaj)?\s*(wa|ya|la)?\s*/i, "")
      .replace(/\s+(kwenda|kuelekea|hadi|to)$/i, "")
      .trim();
    // Capitalize first letter of each word
    pickup = pickup.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  if (dest) {
    dest = dest
      .replace(/^(kwenda|kuelekea|hadi|mpaka|to)\s+/i, "")
      .replace(/\s+(kwa|kutumia|na)\s+(boda|bajaji|gari|teksi|taxi).*$/i, "")
      .replace(/\s*\?+$/, "")
      .trim();
    // Capitalize first letter of each word
    dest = dest.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  return {
    vehicleType,
    vehicleTypeName,
    pickupName: pickup,
    destName: dest
  };
}

// Resilient helper to call Gemini generateContent with retries and fallback models
export async function generateContentWithRetry(params: any, maxRetries = 2) {
  let attempt = 0;
  let delay = 1000;
  const modelsToTry = [params.model, "gemini-3.8-flash", "gemini-3.1-flash-lite"];
  const models = Array.from(new Set(modelsToTry.filter(Boolean)));

  const client = getAI();

  for (const model of models) {
    for (attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[Gemini API - metaBot] Calling model ${model}, attempt ${attempt + 1}...`);
        const response = await client.models.generateContent({
          ...params,
          model: model,
        });
        return response;
      } catch (err: any) {
        const status = err?.status || err?.code || 500;
        const message = err?.message || String(err);
        
        const isQuotaExceeded = status === 429 || message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.includes("quota");
        const isUnavailable = status === 503 || message.includes("503") || message.includes("UNAVAILABLE") || message.includes("high demand") || message.includes("temporary");
        
        if (isQuotaExceeded || isUnavailable) {
          console.warn(`[Gemini API - metaBot] Model ${model} failed with ${isQuotaExceeded ? 'Quota Exceeded (429)' : 'Unavailable (503)'}: ${message}. Switching to next fallback model immediately...`);
          break; // Break the retry loop for this model, proceed to the next model in the outer loop
        }

        const isTransient = status === 500 || status === 502 || status === 504 || message.includes("502") || message.includes("504") || message.includes("timeout");
        if (isTransient && attempt < maxRetries - 1) {
          console.warn(`[Gemini API - metaBot] Transient error (status: ${status}) on model ${model}: ${message}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.5;
        } else {
          console.error(`[Gemini API - metaBot] Error or out of retries for model ${model}: ${message}`);
          break; // Break current retry loop to try the next fallback model
        }
      }
    }
  }
  throw new Error("Gemini API failed on all models and retries. Please try again later.");
}

/**
 * Gets or creates session for a user on a specific channel
 */
export async function getMetaSession(
  senderId: string, 
  channel: 'whatsapp' | 'messenger' | 'instagram', 
  dbAdmin: any
): Promise<MetaSession> {
  const sessionKey = `${channel}:${senderId}`;
  
  if (dbAdmin) {
    try {
      const docRef = dbAdmin.collection('meta_sessions').doc(sessionKey);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        return docSnap.data() as MetaSession;
      }
    } catch (err) {
      console.warn("[Meta Bot] Firestore load failed, using memory:", err);
    }
  }

  const existing = metaSessions.get(sessionKey);
  if (existing) {
    return existing;
  }

  const fresh: MetaSession = {
    senderId,
    channel,
    step: 'START',
    details: {},
    lastUpdated: Date.now()
  };
  metaSessions.set(sessionKey, fresh);
  return fresh;
}

/**
 * Saves Meta Session to Firestore/Memory
 */
export async function saveMetaSession(session: MetaSession, dbAdmin: any): Promise<void> {
  const sessionKey = `${session.channel}:${session.senderId}`;
  session.lastUpdated = Date.now();
  metaSessions.set(sessionKey, session);

  if (dbAdmin) {
    try {
      const sanitized = cleanUndefined(session);
      await dbAdmin.collection('meta_sessions').doc(sessionKey).set(sanitized);
    } catch (err) {
      console.warn("[Meta Bot] Firestore write failed:", err);
    }
  }
}

/**
 * Triggers a real order inside Firebase so it reflects in Admin Dashboard
 */
async function triggerAutomatedOrder(
  dbAdmin: any,
  vendorId: string,
  category: string,
  items: any[],
  total: number,
  customerPhone: string,
  customerName: string,
  notes: string,
  source: 'whatsapp' | 'messenger' | 'instagram',
  extraFields: Record<string, any> = {}
): Promise<string | null> {
  if (!dbAdmin) return null;
  try {
    const orderData = cleanUndefined({
      customerId: `${source}-client-${customerPhone.replace(/\D/g, '')}`,
      vendorId: vendorId || "papo-hapo-express",
      customerName: customerName,
      customerPhone: customerPhone,
      items: items,
      totalAmount: total,
      subtotal: total,
      status: extraFields.status || "pending",
      type: category,
      orderSource: source,
      orderType: extraFields.orderType || "booking",
      paymentMethod: extraFields.paymentMethod || "Mobile Money (Tanzania)",
      paymentStatus: extraFields.paymentStatus || "pending",
      notes: notes || `Order created automatically via Papo Hapo Meta ${source} Bot`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...extraFields
    });
    const ref = await dbAdmin.collection('orders').add(orderData);
    console.log(`[Meta Bot] Automatic order created in DB for vendor: ${vendorId} from ${source}`);
    return ref?.id || null;
  } catch (err) {
    console.error("[Meta Bot] Error creating order:", err);
    return null;
  }
}

function resolvePublicImageUrl(rawUrl?: string): string {
  const url = String(rawUrl || '').trim();
  if (!url) return '';
  if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('data:image/')) {
    return url;
  }
  if (url.startsWith('/')) {
    const base = (process.env.APP_PUBLIC_URL || 'https://dereva-tz.onrender.com').replace(/\/+$/, '');
    return `${base}${url}`;
  }
  return '';
}

function appendMediaItems(
  collector: MetaMediaAttachment[] | undefined,
  items: Array<{ url?: string; caption?: string }>,
  maxCount = 4
) {
  if (!collector) return;
  const seen = new Set(collector.map((m) => m.url));
  let added = 0;
  for (const item of items) {
    if (added >= maxCount) break;
    const resolved = resolvePublicImageUrl(item.url);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    collector.push({
      url: resolved,
      caption: item.caption ? item.caption.slice(0, 1024) : undefined,
    });
    added++;
  }
}

export function buildPhoneVariants(rawPhone?: string): { digits: string; phoneVariants: string[]; customerIdVariants: string[] } {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits || digits.length < 7) {
    return { digits: '', phoneVariants: [], customerIdVariants: [] };
  }
  const last9 = digits.length >= 9 ? digits.slice(-9) : digits;
  const phoneVariants = Array.from(
    new Set([
      digits,
      `+${digits}`,
      `0${last9}`,
      `255${last9}`,
      `+255${last9}`,
    ])
  ).slice(0, 10);

  const customerIdVariants = Array.from(
    new Set([
      `whatsapp-client-255${last9}`,
      `whatsapp-client-0${last9}`,
      `whatsapp-client-${digits}`,
      `app-guest-0${last9}`,
      `app-guest-255${last9}`,
      `app-guest-${digits}`,
    ])
  ).slice(0, 10);

  return { digits, phoneVariants, customerIdVariants };
}

export function buildOrdersTrackingUrl(rawPhone?: string, bookingCode?: string): string {
  const base = (process.env.APP_PUBLIC_URL || 'https://dereva-tz.onrender.com').replace(/\/+$/, '');
  const digits = String(rawPhone || '').replace(/\D/g, '');
  const qs = new URLSearchParams();
  if (digits.length >= 7) {
    qs.set('phone', digits);
  }
  if (bookingCode) {
    qs.set('code', bookingCode.replace(/^#/, ''));
  }
  const qStr = qs.toString();
  return `${base}/my-orders${qStr ? `?${qStr}` : ''}`;
}

function normalizeEpochMs(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'object') {
    if (typeof val.toMillis === 'function') {
      try { return val.toMillis(); } catch {}
    }
    if (typeof val.seconds === 'number') {
      return val.seconds * 1000;
    }
  }
  const parsed = new Date(val).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatSwahiliTrackStatus(status: string, kind: string): string {
  const s = (status || 'pending').toLowerCase();
  if (kind === 'table' || s === 'reserved') {
    if (s === 'reserved') return '🪑 Imeshikiliwa (Reserved)';
    if (s === 'seated' || s === 'occupied') return '🍽️ Umeketi Mezani';
    if (s === 'completed') return '✅ Imekamilika';
    if (s === 'cancelled') return '❌ Imeghairiwa';
  }
  if (kind === 'ride') {
    if (s === 'pending' || s === 'searching') return '⏳ Inatafuta Dereva';
    if (s === 'accepted' || s === 'driver_assigned') return '🚖 Dereva Amekubali';
    if (s === 'arrived') return '📍 Dereva Amefika';
    if (s === 'in_progress' || s === 'started') return '🛣️ Safarini';
    if (s === 'completed') return '✅ Safari Imekamilika';
    if (s === 'cancelled') return '❌ Imeghairiwa';
  }
  switch (s) {
    case 'pending': return '⏳ Imepokelewa (Inasubiri)';
    case 'accepted': return '👍 Imethibitishwa';
    case 'preparing': return '👨‍🍳 Inaandaliwa Jikoni';
    case 'prepared':
    case 'ready': return '🍲 Tayari';
    case 'out_for_delivery':
    case 'picked_up':
    case 'in_transit': return '🛵 Njiani Inakuja';
    case 'delivered':
    case 'completed': return '✅ Imekamilika / Imefika';
    case 'cancelled': return '❌ Imeghairiwa';
    default: return status || 'Pending';
  }
}

export interface TrackedCustomerOrder {
  id: string;
  collection: 'orders' | 'tables' | 'rides' | 'parcels';
  code: string;
  kind: 'food' | 'table' | 'ride' | 'parcel' | 'shop';
  title: string;
  subtitle: string;
  status: string;
  statusLabel: string;
  totalAmount: number;
  channel?: string;
  vendorId?: string;
  createdAtMs: number;
  raw: any;
}

export async function lookupCustomerAllTrackables(
  dbAdmin: any,
  params: { phone?: string; uid?: string; code?: string; senderId?: string }
): Promise<TrackedCustomerOrder[]> {
  if (!dbAdmin) return [];
  const { digits, phoneVariants, customerIdVariants } = buildPhoneVariants(params.phone);
  const cleanCode = params.code ? params.code.trim().replace(/^#/, '').toUpperCase() : '';
  const sender = (params.senderId || '').trim();

  const allCustomerIds = Array.from(
    new Set([
      ...(params.uid ? [params.uid] : []),
      ...customerIdVariants,
      ...(sender ? [`whatsapp-client-${sender}`, `messenger-client-${sender}`, `instagram-client-${sender}`, `meta-client-${sender}`] : [])
    ])
  ).slice(0, 10);

  const ordersMap = new Map<string, any>();
  const tablesMap = new Map<string, any>();
  const ridesMap = new Map<string, any>();
  const parcelsMap = new Map<string, any>();

  const runSafeQuery = async (colName: string, field: string, op: '==' | 'in', val: any, target: Map<string, any>) => {
    try {
      if (op === 'in' && (!Array.isArray(val) || val.length === 0)) return;
      if (op === '==' && !val) return;
      const snap = await dbAdmin.collection(colName).where(field, op, val).limit(25).get();
      snap.forEach((d: any) => target.set(d.id, { id: d.id, ...d.data() }));
    } catch (err) {
      console.warn(`[Order Tracker] Query warning ${colName}.${field}:`, err);
    }
  };

  const tasks: Promise<void>[] = [];

  if (phoneVariants.length > 0) {
    tasks.push(runSafeQuery('orders', 'customerPhone', 'in', phoneVariants, ordersMap));
    tasks.push(runSafeQuery('tables', 'customerPhone', 'in', phoneVariants, tablesMap));
    tasks.push(runSafeQuery('rides', 'customerInfo.phone', 'in', phoneVariants, ridesMap));
    tasks.push(runSafeQuery('parcels', 'senderPhone', 'in', phoneVariants, parcelsMap));
  }

  if (allCustomerIds.length > 0) {
    tasks.push(runSafeQuery('orders', 'customerId', 'in', allCustomerIds, ordersMap));
    tasks.push(runSafeQuery('rides', 'customerId', 'in', allCustomerIds, ridesMap));
  }

  if (params.uid) {
    tasks.push(runSafeQuery('rides', 'passengerId', '==', params.uid, ridesMap));
    tasks.push(runSafeQuery('parcels', 'senderId', '==', params.uid, parcelsMap));
  }

  if (sender) {
    tasks.push(runSafeQuery('rides', 'metaSenderId', '==', sender, ridesMap));
  }

  if (cleanCode) {
    tasks.push(runSafeQuery('orders', 'bookingCode', '==', cleanCode, ordersMap));
    tasks.push(runSafeQuery('tables', 'bookingCode', '==', cleanCode, tablesMap));
    tasks.push(runSafeQuery('rides', 'bookingId', '==', cleanCode, ridesMap));
    tasks.push(runSafeQuery('parcels', 'trackingNumber', '==', cleanCode, parcelsMap));
    // Direct document ID lookup for tables/rides/orders
    tasks.push(
      (async () => {
        for (const col of ['tables', 'orders', 'rides', 'parcels']) {
          try {
            const docSnap = await dbAdmin.collection(col).doc(cleanCode).get();
            if (docSnap.exists) {
              const target = col === 'tables' ? tablesMap : col === 'rides' ? ridesMap : col === 'parcels' ? parcelsMap : ordersMap;
              target.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
            }
          } catch {}
        }
      })()
    );
  }

  await Promise.all(tasks);

  const results: TrackedCustomerOrder[] = [];
  const seenTableCodes = new Set<string>();

  for (const [id, ord] of ordersMap.entries()) {
    const code = String(ord.bookingCode || id.slice(-6)).toUpperCase();
    if (ord.isTableBooking && ord.bookingCode) {
      seenTableCodes.add(ord.bookingCode.toUpperCase());
    }
    const isTable = Boolean(ord.isTableBooking || ord.subType === 'table_booking');
    const isFood = ord.type === 'restaurant' || ord.type === 'food' || String(code).startsWith('FD-');
    const kind: TrackedCustomerOrder['kind'] = isTable ? 'table' : isFood ? 'food' : ord.type === 'parcel' ? 'parcel' : 'shop';

    const itemsArr = Array.isArray(ord.items) ? ord.items : [];
    const itemsDesc = itemsArr.map((it: any) => `${it.name}${it.quantity > 1 ? ` x${it.quantity}` : ''}`).filter(Boolean).slice(0, 3).join(', ');
    const tableInfo = isTable && ord.tableNumber ? `Meza #${ord.tableNumber} • ${ord.reservationTime || ''}` : '';

    // Enrich with linked table doc status if present
    const linkedTable = ord.bookingCode ? tablesMap.get(ord.bookingCode) : null;
    const effectiveStatus = linkedTable?.status && ord.status === 'pending' ? linkedTable.status : (ord.status || 'pending');

    results.push({
      id,
      collection: 'orders',
      code,
      kind,
      title: ord.vendorName || (isTable ? 'Booking ya Meza' : isFood ? 'Oda ya Chakula' : 'Oda ya Papo Hapo'),
      subtitle: tableInfo || itemsDesc || ord.deliveryAddress || ord.notes || 'Oda',
      status: effectiveStatus,
      statusLabel: formatSwahiliTrackStatus(effectiveStatus, kind),
      totalAmount: Number(ord.totalAmount || 0),
      channel: ord.orderSource || ord.channel,
      vendorId: ord.vendorId,
      createdAtMs: normalizeEpochMs(ord.createdAt),
      raw: { ...ord, id, bookingCode: code, createdAtMs: normalizeEpochMs(ord.createdAt) }
    });
  }

  for (const [id, tbl] of tablesMap.entries()) {
    const code = String(tbl.bookingCode || id).toUpperCase();
    if (seenTableCodes.has(code)) continue;
    results.push({
      id,
      collection: 'tables',
      code,
      kind: 'table',
      title: tbl.vendorName || 'Booking ya Meza',
      subtitle: `Meza #${tbl.tableNumber || '-'} • Viti ${tbl.seatsCount || 2} • ${tbl.scheduledTime || ''}`,
      status: tbl.status || 'reserved',
      statusLabel: formatSwahiliTrackStatus(tbl.status || 'reserved', 'table'),
      totalAmount: Number(tbl.totalAmount || 0),
      channel: tbl.channel,
      vendorId: tbl.vendorId,
      createdAtMs: normalizeEpochMs(tbl.createdAt),
      raw: { ...tbl, id, bookingCode: code, createdAtMs: normalizeEpochMs(tbl.createdAt) }
    });
  }

  for (const [id, ride] of ridesMap.entries()) {
    const code = String(ride.bookingId || `TR-${id.slice(-4)}`).toUpperCase();
    const fromAddr = ride.pickup?.address || ride.pickupAddress || 'Kuchukuliwa';
    const toAddr = ride.destination?.address || ride.dropoffAddress || 'Kwenda';
    results.push({
      id,
      collection: 'rides',
      code,
      kind: 'ride',
      title: `Safari ya ${(ride.vehicleType || 'Taxi').toUpperCase()}`,
      subtitle: `${fromAddr} ➔ ${toAddr}`,
      status: ride.status || 'pending',
      statusLabel: formatSwahiliTrackStatus(ride.status || 'pending', 'ride'),
      totalAmount: Number(ride.fare || ride.estimatedFare || 0),
      channel: ride.channel || ride.metaChannel,
      createdAtMs: normalizeEpochMs(ride.createdAt),
      raw: { ...ride, id, bookingId: code, createdAtMs: normalizeEpochMs(ride.createdAt) }
    });
  }

  for (const [id, parcel] of parcelsMap.entries()) {
    const code = String(parcel.trackingNumber || `PR-${id.slice(-4)}`).toUpperCase();
    results.push({
      id,
      collection: 'parcels',
      code,
      kind: 'parcel',
      title: `Mzigo / Parcel (${parcel.category || 'Express'})`,
      subtitle: `${parcel.pickupAddress || ''} ➔ ${parcel.dropoffAddress || ''}`,
      status: parcel.status || 'pending',
      statusLabel: formatSwahiliTrackStatus(parcel.status || 'pending', 'parcel'),
      totalAmount: Number(parcel.fare || parcel.price || 0),
      channel: parcel.channel || 'app',
      createdAtMs: normalizeEpochMs(parcel.createdAt),
      raw: { ...parcel, id, trackingNumber: code, createdAtMs: normalizeEpochMs(parcel.createdAt) }
    });
  }

  results.sort((a, b) => b.createdAtMs - a.createdAtMs);
  if (cleanCode) {
    const matched = results.filter(
      (r) =>
        r.code.toUpperCase() === cleanCode ||
        r.id.toUpperCase() === cleanCode ||
        r.id.slice(-6).toUpperCase() === cleanCode
    );
    return matched;
  }
  return digits || params.uid ? results : [];
}

function formatTrackedOrdersWhatsAppMessage(
  items: TrackedCustomerOrder[],
  phone?: string,
  filterCode?: string,
  lang: 'sw' | 'en' = 'sw'
): string {
  const trackLink = buildOrdersTrackingUrl(phone, filterCode);
  const isEn = lang === 'en';
  if (!items || items.length === 0) {
    if (isEn) {
      return `[[EN_NATIVE]]📦 *YOUR ORDERS & BOOKINGS*\n\n` +
             `No orders or bookings found ${filterCode ? `for code *#${filterCode}* ` : ''}on this number yet.\n\n` +
             `🔗 *Track online:* ${trackLink}\n` +
             `_(Reply *Hi* or *Menu* to place a new order)_`;
    }
    return `📦 *UFUATILIAJI WA ODA ZAKO*\n\n` +
           `Hatujapata oda au booking yoyote ${filterCode ? `ya namba *#${filterCode}* ` : ''}kwa namba hii bado.\n\n` +
           `🔗 *Fungua ukurasa wa kufuatilia:* ${trackLink}\n` +
           `_(Andika *Hi* au *Menu* kuanza oda mpya)_`;
  }

  const topItems = items.slice(0, 8);
  let msg = filterCode
    ? `${isEn ? '[[EN_NATIVE]]' : ''}🔍 *${isEn ? 'ORDER STATUS' : 'HALI YA ODA'} #${filterCode.replace(/^#/, '').toUpperCase()}*\n\n`
    : `${isEn ? '[[EN_NATIVE]]' : ''}📋 *${isEn ? `ALL YOUR ORDERS & BOOKINGS (${items.length})` : `ODA & BOOKING ZAKO ZOTE (${items.length})`}*\n\n`;

  topItems.forEach((item, idx) => {
    const codeUpper = String(item.code || '').toUpperCase();
    const icon =
      item.kind === 'table' ? '🪑' :
      item.kind === 'food' ? '🍔' :
      item.kind === 'ride' ? '🚖' :
      item.kind === 'parcel' ? '📦' :
      codeUpper.startsWith('PFX-') ? '🛠️' :
      codeUpper.startsWith('TK-') ? '🎟️' :
      codeUpper.startsWith('PP-') ? '💳' : '🛍️';
    const priceText = item.totalAmount > 0 ? ` — *TZS ${item.totalAmount.toLocaleString()}*` : '';
    const dateStr = item.createdAtMs
      ? new Date(item.createdAtMs).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '';
    msg += `*${idx + 1}. ${icon} #${item.code}* — *${item.title}*\n` +
           `   📌 ${isEn ? 'Status' : 'Hali'}: *${item.statusLabel}*${priceText}\n` +
           `   📝 ${item.subtitle}${dateStr ? `\n   🕒 ${dateStr}` : ''}\n\n`;
  });

  if (items.length > 8) {
    msg += isEn
      ? `_...and ${items.length - 8} more orders._\n\n`
      : `_...na oda nyingine ${items.length - 8} zaidi._\n\n`;
  }

  msg += isEn
    ? `🔗 *Live Order Tracker:*\n${trackLink}\n\n_(Reply with an order code like *FD-3441* or *Menu*)_`
    : `🔗 *Fuatilia Live kwenye Simu/Mtandao (Oda Zote):*\n${trackLink}\n\n_(Unaweza pia kuandika namba ya oda mfano *FD-3441* au *Hi* kurudi kwenye Menu)_`;
  return msg;
}

interface MetaRestaurantOption {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  distanceKm?: number;
  openTablesCount?: number;
  imageUrl?: string;
}

interface MetaFoodMenuItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  imageUrl?: string;
  description?: string;
}

interface MetaCatalogOption {
  id: string;
  vendorId?: string;
  vendorName?: string;
  name: string;
  price: number;
  desc?: string;
  imageUrl?: string;
  galleryPhotos?: string[];
  roomPricing?: { single?: number; double?: number; vip?: number };
}

interface MetaRestaurantTable {
  id: string;
  number: string;
  capacity: number;
  status: string;
  section?: string;
}

const NON_TABLE_SHAPES = new Set([
  'entrance',
  'reception',
  'kitchen_window',
  'bar_counter',
  'restroom',
  'indoor_plant',
  'structure_divider'
]);

async function fetchRestaurantsForMeta(
  dbAdmin: any,
  gpsCoords?: { lat: number; lng: number }
): Promise<MetaRestaurantOption[]> {
  const results: MetaRestaurantOption[] = [];
  if (dbAdmin) {
    try {
      const snap = await dbAdmin.collection('vendors').where('category', '==', 'restaurant').limit(20).get();
      if (!snap.empty) {
        for (const docSnap of snap.docs) {
          const data = docSnap.data() || {};
          if (data.status === 'suspended' || data.isApproved === false) continue;
          let openTablesCount = 0;
          try {
            const secSnap = await dbAdmin.collection('vendors').doc(docSnap.id).collection('sections').get();
            secSnap.docs.forEach((sDoc: any) => {
              const s = sDoc.data() || {};
              if (!NON_TABLE_SHAPES.has(s.shape || '') && (s.status || 'available') === 'available') {
                openTablesCount += 1;
              }
            });
          } catch {}

          const vLat = typeof data.location?.lat === 'number' ? data.location.lat : undefined;
          const vLng = typeof data.location?.lng === 'number' ? data.location.lng : undefined;
          const dist =
            gpsCoords && vLat !== undefined && vLng !== undefined
              ? Math.round(calculateDistanceKm(gpsCoords.lat, gpsCoords.lng, vLat, vLng) * 10) / 10
              : undefined;

          results.push({
            id: docSnap.id,
            name: data.businessName || 'Mgahawa wa Papo Hapo',
            address: data.address || 'Dar es Salaam',
            lat: vLat,
            lng: vLng,
            distanceKm: dist,
            openTablesCount,
            imageUrl: resolvePublicImageUrl(data.bannerUrl || data.logoUrl || '')
          });
        }
      }
    } catch (err) {
      console.warn("[Meta Bot] Failed fetching restaurants:", err);
    }
  }

  if (results.length === 0) {
    return [
      {
        id: 'papo-hapo-kitchen',
        name: 'Papo Hapo Kitchen & Grill',
        address: 'Mikocheni, Dar es Salaam',
        openTablesCount: 6,
        imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80'
      },
      {
        id: 'masaki-bistro-pizza',
        name: 'Masaki Bistro & Pizza',
        address: 'Masaki, Dar es Salaam',
        openTablesCount: 5,
        imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80'
      },
      {
        id: 'al-farouq-biryani',
        name: 'Al-Farouq Biryani House',
        address: 'Kariakoo, Dar es Salaam',
        openTablesCount: 8,
        imageUrl: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=80'
      }
    ];
  }

  if (gpsCoords) {
    results.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  }
  return results.slice(0, 6);
}

async function fetchRestaurantMenu(
  dbAdmin: any,
  vendorId: string,
  searchQuery?: string
): Promise<MetaFoodMenuItem[]> {
  const items: MetaFoodMenuItem[] = [];
  if (dbAdmin && vendorId) {
    try {
      const snap = await dbAdmin.collection('products').where('vendorId', '==', vendorId).limit(30).get();
      if (!snap.empty) {
        snap.docs.forEach((pDoc: any) => {
          const p = pDoc.data() || {};
          if (p.available === false || p.hidden === true || p.status === 'discontinued') return;
          const rawImg = p.imageUrl || (Array.isArray(p.imageUrls) ? p.imageUrls[0] : '') || '';
          items.push({
            id: pDoc.id,
            name: p.name || 'Chakula Maalum',
            price: Number(p.discountPrice || p.price) || 5000,
            category: p.category || '',
            imageUrl: resolvePublicImageUrl(rawImg),
            description: p.description ? String(p.description).slice(0, 140) : undefined
          });
        });
      }
    } catch (err) {
      console.warn("[Meta Bot] Failed fetching restaurant menu:", err);
    }
  }

  if (items.length === 0) {
    items.push(
      {
        id: 'f1',
        name: 'Chips Kuku Choma (Nusu)',
        price: 8500,
        category: 'Chakula',
        imageUrl: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80'
      },
      {
        id: 'f2',
        name: 'Pizza ya Kuku & Cheese (Classic)',
        price: 15000,
        category: 'Pizza',
        imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80'
      },
      {
        id: 'f3',
        name: 'Biryani ya Nyama (Mlo Kamili)',
        price: 9000,
        category: 'Biryani',
        imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80'
      },
      {
        id: 'f4',
        name: 'Beef Burger & Chips Combo',
        price: 12000,
        category: 'Burger',
        imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80'
      },
      {
        id: 'f5',
        name: 'Juisi ya Embe / Passion (Fresh)',
        price: 3000,
        category: 'Vinywaji',
        imageUrl: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=800&q=80'
      }
    );
  }

  if (searchQuery && searchQuery.length >= 3) {
    const q = searchQuery.toLowerCase();
    items.sort((a, b) => {
      const aMatch = a.name.toLowerCase().includes(q) ? 0 : 1;
      const bMatch = b.name.toLowerCase().includes(q) ? 0 : 1;
      return aMatch - bMatch;
    });
  }
  return items.slice(0, 8);
}

async function fetchCatalogItemsForMeta(
  dbAdmin: any,
  vendorCategory: string,
  searchQuery: string | undefined,
  fallbacks: MetaCatalogOption[]
): Promise<MetaCatalogOption[]> {
  const results: MetaCatalogOption[] = [];
  if (dbAdmin) {
    try {
      const prodSnap = await dbAdmin.collection('products').where('vendorCategory', '==', vendorCategory).limit(20).get();
      if (!prodSnap.empty) {
        prodSnap.docs.forEach((docSnap: any) => {
          const p = docSnap.data() || {};
          if (p.hidden === true || p.status === 'discontinued') return;
          const rawImg = p.imageUrl || (Array.isArray(p.imageUrls) ? p.imageUrls[0] : '') || '';
          results.push({
            id: docSnap.id,
            vendorId: p.vendorId || `${vendorCategory}-vendor-meta`,
            name: p.name || 'Bidhaa Maalum',
            price: Number(p.discountPrice || p.price) || 5000,
            desc: p.description ? String(p.description).slice(0, 90) : (p.category || ''),
            imageUrl: resolvePublicImageUrl(rawImg)
          });
        });
      }

      if (results.length === 0) {
        const vSnap = await dbAdmin.collection('vendors').where('category', '==', vendorCategory).limit(10).get();
        if (!vSnap.empty) {
          for (const vDoc of vSnap.docs) {
            const v = vDoc.data() || {};
            if (v.status === 'suspended' || v.isApproved === false) continue;
            const vpSnap = await dbAdmin.collection('products').where('vendorId', '==', vDoc.id).limit(10).get();
            if (!vpSnap.empty) {
              vpSnap.docs.forEach((pDoc: any) => {
                const p = pDoc.data() || {};
                if (p.hidden === true || p.status === 'discontinued') return;
                const rawImg = p.imageUrl || (Array.isArray(p.imageUrls) ? p.imageUrls[0] : '') || v.bannerUrl || v.logoUrl || '';
                results.push({
                  id: pDoc.id,
                  vendorId: vDoc.id,
                  vendorName: v.businessName || '',
                  name: p.name || v.businessName || 'Huduma Maalum',
                  price: Number(p.discountPrice || p.price) || 10000,
                  desc: p.description ? String(p.description).slice(0, 90) : (v.address || ''),
                  imageUrl: resolvePublicImageUrl(rawImg)
                });
              });
            } else {
              results.push({
                id: vDoc.id,
                vendorId: vDoc.id,
                vendorName: v.businessName || '',
                name: v.businessName || 'Mtoa Huduma',
                price: 15000,
                desc: v.description ? String(v.description).slice(0, 90) : (v.address || ''),
                imageUrl: resolvePublicImageUrl(v.bannerUrl || v.logoUrl || '')
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[Meta Bot] Failed fetching ${vendorCategory} catalog:`, err);
    }
  }

  const finalItems = results.length > 0 ? results : fallbacks;
  if (searchQuery && searchQuery.length >= 3) {
    const q = searchQuery.toLowerCase();
    finalItems.sort((a, b) => {
      const aMatch = `${a.name} ${a.desc || ''}`.toLowerCase().includes(q) ? 0 : 1;
      const bMatch = `${b.name} ${b.desc || ''}`.toLowerCase().includes(q) ? 0 : 1;
      return aMatch - bMatch;
    });
  }
  return finalItems.slice(0, 6);
}

async function fetchHotelsForMeta(dbAdmin: any): Promise<MetaCatalogOption[]> {
  const results: MetaCatalogOption[] = [];
  if (dbAdmin) {
    try {
      const snap = await dbAdmin.collection('vendors').where('category', '==', 'hotel').limit(15).get();
      if (!snap.empty) {
        snap.docs.forEach((docSnap: any) => {
          const data = docSnap.data() || {};
          if (data.status === 'suspended' || data.isApproved === false) return;
          const gallery = Array.isArray(data.galleryPhotos) ? data.galleryPhotos : [];
          const rawImg = data.bannerUrl || gallery[0] || data.logoUrl || '';
          const minPrice = Number(data.roomPricing?.single || data.roomPricing?.double || data.roomPricing?.vip || 85000);
          results.push({
            id: docSnap.id,
            vendorId: docSnap.id,
            name: data.businessName || 'Hoteli ya Papo Hapo',
            price: minPrice,
            desc: data.address || data.hotelCategory || 'Dar es Salaam',
            imageUrl: resolvePublicImageUrl(rawImg),
            galleryPhotos: gallery.map((g: string) => resolvePublicImageUrl(g)).filter(Boolean),
            roomPricing: data.roomPricing
          });
        });
      }
    } catch (err) {
      console.warn('[Meta Bot] Failed fetching hotels:', err);
    }
  }

  if (results.length === 0) {
    return [
      {
        id: 'htl-m1',
        vendorId: 'htl-m1',
        name: 'The Hyatt Regency Kilimanjaro',
        price: 280000,
        desc: 'Posta • Luxury Sea View',
        imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80'
      },
      {
        id: 'htl-m2',
        vendorId: 'htl-m2',
        name: 'Serena Luxury Hotel & Suites',
        price: 220000,
        desc: 'City Centre • Pool & Breakfast',
        imageUrl: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80'
      },
      {
        id: 'htl-m3',
        vendorId: 'htl-m3',
        name: 'Transit Motel Airport',
        price: 65000,
        desc: 'Kipawa • AC & WiFi',
        imageUrl: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'
      }
    ];
  }
  return results.slice(0, 6);
}

async function fetchHotelRoomsForMeta(
  dbAdmin: any,
  hotel: MetaCatalogOption
): Promise<MetaCatalogOption[]> {
  const rooms: MetaCatalogOption[] = [];
  if (dbAdmin && hotel.id) {
    try {
      const snap = await dbAdmin.collection('products').where('vendorId', '==', hotel.id).limit(20).get();
      if (!snap.empty) {
        snap.docs.forEach((pDoc: any) => {
          const p = pDoc.data() || {};
          if (p.hidden === true || p.status === 'discontinued') return;
          const rawImg = p.imageUrl || (Array.isArray(p.imageUrls) ? p.imageUrls[0] : '') || hotel.imageUrl || '';
          rooms.push({
            id: pDoc.id,
            vendorId: hotel.id,
            vendorName: hotel.name,
            name: p.name || 'Chumba Maalum',
            price: Number(p.discountPrice || p.price) || hotel.price || 85000,
            desc: p.roomAmenities || p.description || (p.capacity ? `Watu ${p.capacity}` : 'AC, WiFi & Bafu Ndani'),
            imageUrl: resolvePublicImageUrl(rawImg)
          });
        });
      }
    } catch (err) {
      console.warn('[Meta Bot] Failed fetching hotel rooms:', err);
    }
  }

  if (rooms.length === 0) {
    const gallery = hotel.galleryPhotos || [];
    const rp = hotel.roomPricing || {};
    rooms.push(
      {
        id: `${hotel.id}-single`,
        vendorId: hotel.id,
        vendorName: hotel.name,
        name: 'Standard Single Room',
        price: Number(rp.single) || hotel.price || 65000,
        desc: 'Kitanda 1 • AC, WiFi & TV',
        imageUrl: gallery[0] || hotel.imageUrl || 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=80'
      },
      {
        id: `${hotel.id}-double`,
        vendorId: hotel.id,
        vendorName: hotel.name,
        name: 'Deluxe Double Room',
        price: Number(rp.double) || Math.round((hotel.price || 85000) * 1.4),
        desc: 'Watu 2 • Breakfast & Balcony',
        imageUrl: gallery[1] || 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80'
      },
      {
        id: `${hotel.id}-vip`,
        vendorId: hotel.id,
        vendorName: hotel.name,
        name: 'Executive VIP Suite',
        price: Number(rp.vip) || Math.round((hotel.price || 100000) * 2),
        desc: 'Lounge, Breakfast & Airport Pickup',
        imageUrl: gallery[2] || 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=800&q=80'
      }
    );
  }
  return rooms.slice(0, 6);
}

async function fetchAvailableRestaurantTables(
  dbAdmin: any,
  vendorId: string,
  minSeats?: number
): Promise<MetaRestaurantTable[]> {
  const tables: MetaRestaurantTable[] = [];
  if (dbAdmin && vendorId) {
    try {
      const snap = await dbAdmin.collection('vendors').doc(vendorId).collection('sections').get();
      if (!snap.empty) {
        snap.docs.forEach((sDoc: any) => {
          const s = sDoc.data() || {};
          if (NON_TABLE_SHAPES.has(s.shape || '')) return;
          tables.push({
            id: sDoc.id,
            number: String(s.number || sDoc.id.slice(-2)),
            capacity: Number(s.capacity) || 4,
            status: s.status || 'available',
            section: s.section || 'Indoor'
          });
        });
      }
    } catch (err) {
      console.warn("[Meta Bot] Failed fetching restaurant tables:", err);
    }
  }

  const available = tables.filter((t) => t.status === 'available' && (!minSeats || t.capacity >= minSeats));
  if (available.length > 0) {
    return available.sort((a, b) => a.capacity - b.capacity);
  }
  return tables.filter((t) => t.status === 'available').sort((a, b) => b.capacity - a.capacity);
}

async function createTableReservationRecord(
  dbAdmin: any,
  params: {
    vendorId: string;
    vendorName: string;
    vendorAddress: string;
    customerName: string;
    customerPhone: string;
    seatsCount: number;
    scheduledTime: string;
    preferredTableId?: string;
    preferredTableNumber?: string;
    preOrderItems?: Array<{ id?: string; name: string; price: number; quantity: number }>;
    paymentMethod: string;
    paymentMethodLabel: string;
    channel: 'whatsapp' | 'messenger' | 'instagram';
  }
): Promise<{ bookingCode: string; tableNumber: string; orderId?: string | null }> {
  const rand = Math.floor(1000 + Math.random() * 9000);
  const bookingCode = `TBL-${rand}`;
  let assignedTableId = params.preferredTableId || '';
  let assignedTableNumber = params.preferredTableNumber || '';

  if (dbAdmin && params.vendorId) {
    try {
      if (!assignedTableId) {
        const availableTables = await fetchAvailableRestaurantTables(dbAdmin, params.vendorId, params.seatsCount);
        if (availableTables.length > 0) {
          assignedTableId = availableTables[0].id;
          assignedTableNumber = availableTables[0].number;
        }
      }

      if (!assignedTableNumber) {
        assignedTableNumber = String(Math.floor(1 + Math.random() * 12));
      }

      const preItems = params.preOrderItems || [];
      const preTotal = preItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);

      if (assignedTableId) {
        await dbAdmin
          .collection('vendors')
          .doc(params.vendorId)
          .collection('sections')
          .doc(assignedTableId)
          .set(
            cleanUndefined({
              status: 'reserved',
              reservation: {
                bookingCode,
                customerName: params.customerName,
                customerPhone: params.customerPhone,
                seatsCount: params.seatsCount,
                scheduledTime: params.scheduledTime,
                preOrderItems: preItems,
                totalAmount: preTotal,
                paymentMethod: params.paymentMethod,
                channel: params.channel,
                createdAt: Date.now()
              }
            }),
            { merge: true }
          );
      }

      await dbAdmin.collection('tables').doc(bookingCode).set(
        cleanUndefined({
          bookingCode,
          vendorId: params.vendorId,
          vendorName: params.vendorName,
          vendorAddress: params.vendorAddress,
          tableId: assignedTableId || null,
          tableNumber: assignedTableNumber,
          seatsCount: params.seatsCount,
          scheduledTime: params.scheduledTime,
          customerName: params.customerName,
          customerPhone: params.customerPhone,
          status: 'reserved',
          preOrderItems: preItems,
          totalAmount: preTotal,
          paymentMethod: params.paymentMethod,
          paymentMethodLabel: params.paymentMethodLabel,
          channel: params.channel,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      );

      const orderItems =
        preItems.length > 0
          ? preItems
          : [{ id: bookingCode, name: `Booking Meza #${assignedTableNumber} (Viti ${params.seatsCount})`, price: 0, quantity: 1 }];

      const orderId = await triggerAutomatedOrder(
        dbAdmin,
        params.vendorId,
        'restaurant',
        orderItems,
        preTotal,
        params.customerPhone,
        params.customerName,
        `Table Booking #${bookingCode} | Meza #${assignedTableNumber} | Viti: ${params.seatsCount} | Muda: ${params.scheduledTime}`,
        params.channel,
        {
          orderType: 'booking',
          subType: 'table_booking',
          isTableBooking: true,
          bookingCode,
          tableId: assignedTableId || null,
          tableNumber: assignedTableNumber,
          peopleCount: params.seatsCount,
          reservationTime: params.scheduledTime,
          vendorName: params.vendorName,
          paymentMethod: params.paymentMethod,
          paymentMethodLabel: params.paymentMethodLabel,
          status: 'pending'
        }
      );

      return { bookingCode, tableNumber: assignedTableNumber, orderId };
    } catch (err) {
      console.warn("[Meta Bot] Error saving table reservation:", err);
    }
  }

  return { bookingCode, tableNumber: assignedTableNumber || '1', orderId: null };
}

/**
 * Uses Gemini (or keyword fallback) to classify user intent
 */
export async function classifyIntent(message: string): Promise<{
  intent:
    | 'greeting'
    | 'taxi'
    | 'food'
    | 'grocery'
    | 'parcel'
    | 'salon'
    | 'hotel'
    | 'car_rental'
    | 'pharmacy'
    | 'bus_ticket'
    | 'handyman'
    | 'ecommerce'
    | 'events'
    | 'papopay'
    | 'other';
  confidence: number;
}> {
  const cleaned = message.trim().toLowerCase();
  const compact = cleaned.replace(/[\s_-]+/g, '');

  // Deterministic instant brand/keyword matching for all Papo Hapo services
  if (['hi', 'mambo', 'vip', 'vipi', 'habari', 'hello', 'habari gani', 'anza', 'start', 'menu', 'ya', 'oje', 'hodi', 'yo'].includes(cleaned)) {
    return { intent: 'greeting', confidence: 1.0 };
  }
  if (compact.includes('paporide') || compact === 'ride') return { intent: 'taxi', confidence: 1.0 };
  if (compact.includes('papofood')) return { intent: 'food', confidence: 1.0 };
  if (compact.includes('papomart')) return { intent: 'grocery', confidence: 1.0 };
  if (compact.includes('paposend')) return { intent: 'parcel', confidence: 1.0 };
  if (compact.includes('papomed')) return { intent: 'pharmacy', confidence: 1.0 };
  if (compact.includes('papostyle')) return { intent: 'salon', confidence: 1.0 };
  if (compact.includes('papofix')) return { intent: 'handyman', confidence: 1.0 };
  if (compact.includes('papostay')) return { intent: 'hotel', confidence: 1.0 };
  if (compact.includes('papoticket')) return { intent: 'events', confidence: 1.0 };
  if (compact.includes('papobus')) return { intent: 'bus_ticket', confidence: 1.0 };
  if (compact.includes('paporent')) return { intent: 'car_rental', confidence: 1.0 };
  if (compact.includes('papomall')) return { intent: 'ecommerce', confidence: 1.0 };
  if (compact.includes('papopay') || compact.includes('papowallet') || compact.includes('papocredit') || compact.includes('lipapapo')) {
    return { intent: 'papopay', confidence: 1.0 };
  }

  // If Gemini API Key is available, use Gemini for natural Swahili/English NLP
  if (process.env.GEMINI_API_KEY) {
    try {
      const prompt = `You are the core intent classification engine for Papo Hapo Super App in Tanzania. 
Analyze the user's message and determine their intent. Respond strictly in JSON format.

The user message might be in Swahili, English, Sheng, or mixed.

User message: "${message}"

Available Intents:
- 'greeting': When the user greets (hi, mambo, vipi, hello, habari, etc.)
- 'taxi': PapoRide — ordering taxi, ride, boda, bajaji, going to an address
- 'food': PapoFood — ordering pizza, burger, chips, chicken, biryani, restaurants, OR booking/reserving a restaurant table or seats (meza, kiti, viti)
- 'grocery': PapoMart — groceries, soko, fruits, onions, rice, vegetables
- 'parcel': PapoSend — sending packages, courier, delivery (mzigo, kutuma)
- 'salon': PapoStyle — salon booking, shaving, makeup, nails, hair, massage, spa
- 'hotel': PapoStay — hotel booking, lodging, room booking
- 'car_rental': PapoRent — renting a car, hire car, Prado, Cruiser, Noah, Vitz
- 'pharmacy': PapoMed — ordering medicine, pharmacy, panadol, syrup, dawa
- 'bus_ticket': PapoBus — bus ticket, mabasi ya mikoani
- 'handyman': PapoFix — fundi, plumber, electrician, AC/fridge repair, carpenter, cleaning, home repair, mafundi
- 'ecommerce': PapoMall — buying electronics, phones, shoes, clothes, appliances, online shop / maduka
- 'events': PapoTicket — events, football match tickets, concerts, tamasha, mechi, simba, yanga, semina, comedy
- 'papopay': PapoPay — wallet balance, salio, lipa bili, tuma pesa, wakala, QR payment, papocredit
- 'other': Any general query not fitting above

Response Schema:
{
  "intent": "greeting" | "taxi" | "food" | "grocery" | "parcel" | "salon" | "hotel" | "car_rental" | "pharmacy" | "bus_ticket" | "handyman" | "ecommerce" | "events" | "papopay" | "other",
  "confidence": number (between 0.0 and 1.0)
}`;

      const response = await generateContentWithRetry({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      });

      const result = JSON.parse(response.text || "{}");
      if (result.intent) {
        return {
          intent: result.intent,
          confidence: result.confidence || 0.9
        };
      }
    } catch (err) {
      console.warn("[Meta Bot] Gemini intent detection failed, falling back to heuristics:", err);
    }
  }

  // Robust swahili/english keyword matching fallback (always reliable)
  if (cleaned.includes('taxi') || cleaned.includes('teksi') || cleaned.includes('uber') || cleaned.includes('boda') || cleaned.includes('bajaji') || cleaned.includes('safari ya haraka') || cleaned.includes('ride') || cleaned.includes('dereva')) {
    return { intent: 'taxi', confidence: 0.95 };
  }
  if (
    cleaned.includes('chips') ||
    cleaned.includes('burger') ||
    cleaned.includes('pizza') ||
    cleaned.includes('kuku') ||
    cleaned.includes('chakula') ||
    cleaned.includes('biryani') ||
    cleaned.includes('msosi') ||
    cleaned.includes('wali') ||
    cleaned.includes('meza') ||
    cleaned.includes('kiti') ||
    cleaned.includes('viti') ||
    cleaned.includes('mgahawa') ||
    cleaned.includes('restaurant') ||
    cleaned.includes('dine') ||
    cleaned.includes('table')
  ) {
    return { intent: 'food', confidence: 0.96 };
  }
  if (cleaned.includes('nyanya') || cleaned.includes('kitunguu') || cleaned.includes('soko') || cleaned.includes('mboga') || cleaned.includes('matunda') || cleaned.includes('mchele') || cleaned.includes('grocery') || cleaned.includes('sokoni')) {
    return { intent: 'grocery', confidence: 0.90 };
  }
  if (cleaned.includes('mzigo') || cleaned.includes('tuma mzigo') || cleaned.includes('parcel') || cleaned.includes('kuria') || cleaned.includes('msafirishaji') || cleaned.includes('vifurushi')) {
    return { intent: 'parcel', confidence: 0.95 };
  }
  if (cleaned.includes('nywele') || cleaned.includes('saluni') || cleaned.includes('salon') || cleaned.includes('kinyozi') || cleaned.includes('makeup') || cleaned.includes('kucha') || cleaned.includes('massage') || cleaned.includes('spa')) {
    return { intent: 'salon', confidence: 0.95 };
  }
  if (cleaned.includes('fundi') || cleaned.includes('mafundi') || cleaned.includes('umeme') || cleaned.includes('bomba') || cleaned.includes('ac ') || cleaned.includes('friji') || cleaned.includes('fumigation') || cleaned.includes('handyman') || cleaned.includes('plumber') || cleaned.includes('electrician') || cleaned.includes('ujenzi') || cleaned.includes('carpenter')) {
    return { intent: 'handyman', confidence: 0.95 };
  }
  if (cleaned.includes('hotel') || cleaned.includes('room') || cleaned.includes('chumba') || cleaned.includes('lodging') || cleaned.includes('hoteli') || cleaned.includes('malazi')) {
    return { intent: 'hotel', confidence: 0.90 };
  }
  if (cleaned.includes('tamasha') || cleaned.includes('matukio') || cleaned.includes('mechi') || cleaned.includes('simba') || cleaned.includes('yanga') || cleaned.includes('concert') || cleaned.includes('event') || cleaned.includes('mpira') || cleaned.includes('sherehe') || cleaned.includes('semina')) {
    return { intent: 'events', confidence: 0.95 };
  }
  if (cleaned.includes('kodi') || cleaned.includes('prado') || cleaned.includes('cruiser') || cleaned.includes('rental') || cleaned.includes('rent a car') || cleaned.includes('noah') || cleaned.includes('gari la kukodi')) {
    return { intent: 'car_rental', confidence: 0.95 };
  }
  if (cleaned.includes('dawa') || cleaned.includes('panadol') || cleaned.includes('paracetamol') || cleaned.includes('syrup') || cleaned.includes('pharmacy') || cleaned.includes('famasi') || cleaned.includes('kikohozi')) {
    return { intent: 'pharmacy', confidence: 0.95 };
  }
  if (cleaned.includes('basi') || cleaned.includes('mabasi') || cleaned.includes('tiketi') || cleaned.includes('ticket')) {
    return { intent: 'bus_ticket', confidence: 0.95 };
  }
  if (cleaned.includes('mall') || cleaned.includes('duka') || cleaned.includes('maduka') || cleaned.includes('viatu') || cleaned.includes('simu') || cleaned.includes('nguo') || cleaned.includes('laptop') || cleaned.includes('electronics') || cleaned.includes('ecommerce') || cleaned.includes('shopping')) {
    return { intent: 'ecommerce', confidence: 0.92 };
  }
  if (cleaned.includes('salio') || cleaned.includes('wallet') || cleaned.includes('lipa') || cleaned.includes('wakala') || cleaned.includes('malipo') || cleaned.includes('bili') || cleaned.includes('luku') || cleaned.includes('dawasco') || cleaned.includes('credit')) {
    return { intent: 'papopay', confidence: 0.94 };
  }

  return { intent: 'other', confidence: 0.5 };
}

/**
 * Uses Gemini to answer custom user questions using the uploaded Knowledge Base (FAQs, website info)
 */
export async function queryKnowledgeBase(input: string, knowledgeBase: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY || !knowledgeBase) return null;
  try {
    const prompt = `You are the AI Customer Support Agent for Papo Hapo Super App.
Use the following Knowledge Base/FAQs to answer the user's query.

Knowledge Base:
"""
${knowledgeBase}
"""

User Query: "${input}"

Instructions:
1. If the user query can be answered using the provided Knowledge Base, give a friendly, helpful, and concise response in Swahili (Dar es Salaam Swahili slang friendly) or the user's language.
2. If the user query CANNOT be answered using the Knowledge Base (e.g. it is completely unrelated or requires booking database access), reply strictly with "UNANSWERED".
3. Do not assume or make up facts. Only use what is in the Knowledge Base.`;

    const res = await generateContentWithRetry({
      model: "gemini-3.8-flash",
      contents: prompt,
    });
    
    const reply = res.text?.trim();
    if (reply && reply !== "UNANSWERED" && !reply.includes("UNANSWERED")) {
      return reply;
    }
  } catch (err) {
    console.error("[Knowledge Base AI error]", err);
  }
  return null;
}

/**
 * Executes a custom visual workflow node chain starting from a given nodeId.
 * This runs iteratively until a node requires user input or we reach the end.
 */
export async function executeNodeChain(
  startNodeId: string,
  userInput: string,
  session: MetaSession,
  nodes: any[],
  dbAdmin: any,
  channel: 'whatsapp' | 'messenger' | 'instagram'
): Promise<string> {
  let currentNode = nodes.find(n => n.id === startNodeId);
  if (!currentNode) {
    currentNode = nodes.find(n => n.type === 'start');
  }
  if (!currentNode) {
    return "⚠️ System Error: Start node not found in active workflow.";
  }

  let replyText = "";
  let loopCount = 0;
  const maxLoops = 20; // Secure against cyclic loops
  const visitedNodeIds = new Set<string>();

  if (!session.details.variables) {
    session.details.variables = {};
  }

  // Populate dynamic system defaults for interpolation
  const chSymbol = channel === 'whatsapp' ? '🟢 WhatsApp' : channel === 'instagram' ? '📸 Instagram' : '🔵 Messenger';
  session.details.variables['customer.name'] = session.details.customerName || "Mteja";
  session.details.variables['customer.phone'] = session.details.phone || "0712345678";
  session.details.variables['channel'] = chSymbol;

  // Retrieve business services configuration for real-time dynamic filtering
  let servicesConfig: any = {};
  if (dbAdmin) {
    try {
      const bizSnap = await dbAdmin.collection('config').doc('business').get();
      if (bizSnap.exists) {
        servicesConfig = bizSnap.data().services || {};
      }
    } catch (bizErr) {
      console.warn("[Meta Bot] Failed to fetch services config in executeNodeChain:", bizErr);
    }
  }

  while (currentNode && loopCount < maxLoops) {
    loopCount++;
    if (visitedNodeIds.has(currentNode.id)) {
      console.log(`[Meta Bot] Cycle detected at node ${currentNode.id}, halting chain.`);
      break;
    }
    visitedNodeIds.add(currentNode.id);

    const nodeType = currentNode.type;
    const nodeData = currentNode.data || {};

    // 1. START NODE
    if (nodeType === 'start') {
      const nextId = nodeData.nextNodeId;
      if (nextId) {
        currentNode = nodes.find(n => n.id === nextId);
      } else {
        break;
      }
    }
    // 2. SEND MESSAGE NODE
    else if (nodeType === 'message') {
      let text = nodeData.text || "";
      // Dynamic variables replacement
      for (const [key, val] of Object.entries(session.details.variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        text = text.replace(regex, String(val));
      }

      // Dynamic filtering of services list based on real-time business config
      text = applyBusinessConfigToWelcomeText(text, servicesConfig);

      replyText += (replyText ? "\n\n" : "") + text;

      const nextId = nodeData.nextNodeId;
      if (nextId) {
        currentNode = nodes.find(n => n.id === nextId);
      } else {
        break;
      }
    }
    // 3. ASK QUESTION NODE (INPUT CAPTURE)
    else if (nodeType === 'question') {
      // If we are AWAITING the answer and resuming this exact question node
      if (session.details.activeQuestionNodeId === currentNode.id) {
        const varName = nodeData.variableName || "temp";
        session.details.variables[varName] = userInput;
        delete session.details.activeQuestionNodeId; // Cleared

        let nextId = nodeData.nextNodeId;
        // Option/Quick Reply routing
        if (nodeData.options && nodeData.options.length > 0) {
          const matchedOpt = nodeData.options.find((opt: any) => 
            opt.key?.toString()?.trim() === userInput.trim() || 
            opt.value?.toLowerCase()?.trim() === userInput.toLowerCase()?.trim()
          );
          if (matchedOpt && matchedOpt.nextNodeId) {
            nextId = matchedOpt.nextNodeId;
          }
        }

        if (nextId) {
          currentNode = nodes.find(n => n.id === nextId);
        } else {
          break;
        }
      } else {
        // Entering the question for the first time: show question text & halt loop to wait for reply
        let text = nodeData.text || "";
        for (const [key, val] of Object.entries(session.details.variables)) {
          const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
          text = text.replace(regex, String(val));
        }

        // Dynamic filtering of services list based on real-time business config
        text = applyBusinessConfigToWelcomeText(text, servicesConfig);

        replyText += (replyText ? "\n\n" : "") + text;

        session.details.currentNodeId = currentNode.id;
        session.details.activeQuestionNodeId = currentNode.id;
        session.step = 'COLLECTING_PHONE'; // Freeze state
        await saveMetaSession(session, dbAdmin);
        return replyText;
      }
    }
    // 4. CONDITION BLOCK
    else if (nodeType === 'condition') {
      let nextId = nodeData.nextNodeId; // Default/Else pathway

      if (nodeData.conditions && nodeData.conditions.length > 0) {
        for (const cond of nodeData.conditions) {
          const val = String(session.details.variables[cond.variable] || "").toLowerCase().trim();
          const target = String(cond.value || "").toLowerCase().trim();
          let matched = false;

          if (cond.operator === 'equals' && val === target) matched = true;
          else if (cond.operator === 'contains' && val.includes(target)) matched = true;
          else if (cond.operator === 'exists' && val !== "") matched = true;

          if (matched && cond.nextNodeId) {
            nextId = cond.nextNodeId;
            break;
          }
        }
      }

      if (nextId) {
        currentNode = nodes.find(n => n.id === nextId);
      } else {
        break;
      }
    }
    // 5. AI INTENT DECISION BLOCK (GEMINI & KEYWORD HYBRID)
    else if (nodeType === 'ai_decision') {
      let nextId: string | undefined = undefined;
      const intentMappings = nodeData.intentMappings || [];

      if (intentMappings.length > 0) {
        const cleanedUser = userInput.toLowerCase().trim();
        // 1. Instant keyword & numeric matching
        for (const m of intentMappings) {
          const keywords = (m.keywords || "").split(',').map((k: any) => k.trim().toLowerCase());
          if (keywords.some((k: any) => cleanedUser === k || (k.length > 1 && cleanedUser.includes(k)))) {
            nextId = m.nextNodeId;
            break;
          }
        }

        // 2. Real-time AI classification via Gemini if keyword did not match directly and user input is substantial
        if (!nextId && process.env.GEMINI_API_KEY && userInput.length > 3 && !['hi', 'mambo', 'vip', 'vipi', 'habari', 'hello', 'habari gani'].includes(cleanedUser)) {
          try {
            const prompt = `You are the core AI routing engine for Papo Hapo Super App.
Analyze the customer's input message and select the best matching category from the list.

Customer Input: "${userInput}"

Categories:
${intentMappings.map((m: any) => `- ID: "${m.nextNodeId}", Description/Keywords: "${m.keywords}"`).join('\n')}

Respond strictly with the matching category ID. If none fits nicely, return "default".`;

            const res = await generateContentWithRetry({
              model: "gemini-3.8-flash",
              contents: prompt,
            });
            const ans = res.text?.trim()?.replace(/["']/g, '');
            if (ans && ans !== "default" && intentMappings.some((m: any) => m.nextNodeId === ans)) {
              nextId = ans;
              console.log(`[Workflow AI Classifier] Classified "${userInput}" to Category: ${nextId}`);
            }
          } catch (err) {
            console.warn("[Workflow AI Classifier] Gemini classification skipped:", err);
          }
        }
      }

      if (nextId) {
        currentNode = nodes.find(n => n.id === nextId);
      } else {
        // No choice made yet: stay at this decision node and await user's selection
        session.details.currentNodeId = currentNode.id;
        await saveMetaSession(session, dbAdmin);
        break;
      }
    }
    // 6. PAYMENT NODE
    else if (nodeType === 'payment') {
      const amt = nodeData.paymentAmount || "3000";
      session.details.variables['payment_status'] = "SUCCESS";
      session.details.variables['fare'] = amt;

      replyText += (replyText ? "\n\n" : "") + `💳 *Ombi la Malipo (TSH ${amt}) limetumwa!* Tafadhali thibitisha kwa kuweka PIN yako kwenye simu... Malipo yamefanikiwa kikamilifu!`;

      const nextId = nodeData.nextNodeId;
      if (nextId) {
        currentNode = nodes.find(n => n.id === nextId);
      } else {
        break;
      }
    }
    // 7. CREATE SYSTEM ORDER
    else if (nodeType === 'create_order') {
      const serviceType = nodeData.serviceType || "taxi";
      const pickup = session.details.variables['taxi_pickup_location'] || session.details.variables['pickup'] || "Mwenge";
      const dest = session.details.variables['taxi_destination'] || session.details.variables['destination'] || "Posta";
      const phone = session.details.variables['customer.phone'] || (channel === 'whatsapp' ? `+${session.senderId.replace(/\D/g, '')}` : "0712345678");
      const randId = Math.floor(1000 + Math.random() * 9000);

      session.details.variables['booking_id'] = `PH-${randId}`;
      session.details.variables['tracking_link'] = buildOrdersTrackingUrl(phone, `PH-${randId}`);

      // Trigger automatic DB record so it appears in Admin Dashboard in real-time!
      await triggerAutomatedOrder(
        dbAdmin,
        "papo-hapo-express",
        serviceType,
        [{ name: `${serviceType.toUpperCase()} ride from ${pickup} to ${dest}`, price: 4000, quantity: 1 }],
        4000,
        phone,
        session.details.variables['customer.name'] || "Meta Customer",
        `Created via Papo Hapo Automation Studio Flow node: ${currentNode.id}`,
        channel
      );

      // Also add to the 'rides' collection so that any online taxi drivers receive it!
      if (serviceType.toLowerCase() === 'taxi' || serviceType.toLowerCase() === 'teksi') {
        try {
          const cleanPickup = (pickup || "").replace(/\s*\(.*?\)/g, "").trim();
          const cleanDest = (dest || "").replace(/\s*\(.*?\)/g, "").trim();
          
          const pRes = await resolvePlace(cleanPickup, dbAdmin);
          const dRes = await resolvePlace(cleanDest, dbAdmin);

          const pLoc = pRes.matches.length > 0 ? {
            placeId: pRes.matches[0].placeId,
            name: pRes.matches[0].name,
            address: pRes.matches[0].displayName || pRes.matches[0].name,
            lat: pRes.matches[0].latitude,
            lng: pRes.matches[0].longitude
          } : {
            placeId: "TZ-DSM-MWENGE-001",
            name: "Mwenge",
            address: "Mwenge, Kinondoni, Dar es Salaam",
            lat: -6.7681,
            lng: 39.2274
          };

          const dLoc = dRes.matches.length > 0 ? {
            placeId: dRes.matches[0].placeId,
            name: dRes.matches[0].name,
            address: dRes.matches[0].displayName || dRes.matches[0].name,
            lat: dRes.matches[0].latitude,
            lng: dRes.matches[0].longitude
          } : {
            placeId: "TZ-DSM-POSTA-001",
            name: "Posta",
            address: "Posta, Ilala, Dar es Salaam",
            lat: -6.8164,
            lng: 39.2902
          };
          
          const expiresAtDate = new Date();
          expiresAtDate.setMinutes(expiresAtDate.getMinutes() + 15);

          await dbAdmin.collection('rides').add({
            status: "pending",
            customerId: `meta-client-${session.senderId}`,
            customerInfo: {
              name: session.details.variables['customer.name'] || "Meta Customer",
              phone: phone,
              rating: 4.8
            },
            driverId: null,
            pickup: pLoc,
            destination: dLoc,
            vehicleType: "taxi",
            fare: 6500,
            distance: 8.5,
            duration: 15,
            routeCoords: [
              { lat: pLoc.lat, lng: pLoc.lng },
              { lat: dLoc.lat, lng: dLoc.lng }
            ],
            createdAt: new Date(),
            expiresAt: expiresAtDate.toISOString(),
            driverInfo: null,
            driverLocation: null,
            channel: channel,
            bookingId: `PH-${randId}`
          });
          console.log(`[Meta Bot] Added ride to Firestore rides collection with status 'pending' for booking ID: PH-${randId}`);
        } catch (rideErr) {
          console.error("[Meta Bot] Error adding ride to Firestore rides:", rideErr);
        }
      }

      replyText += (replyText ? "\n\n" : "") + `🚖 *Booking ya ${serviceType.toUpperCase()} Imefanikiwa!* \n` +
                   `- Namba ya Oda: *PH-${randId}*\n` +
                   `- Kutoka: *${pickup}*\n` +
                   `- Kwenda: *${dest}*\n` +
                   `- Angalia Maendeleo: ${session.details.variables['tracking_link']}`;

      const nextId = nodeData.nextNodeId;
      if (nextId) {
        currentNode = nodes.find(n => n.id === nextId);
      } else {
        break;
      }
    }
    // 8. OCR NODE
    else if (nodeType === 'ocr') {
      session.details.variables['control_number'] = "991234567890";
      session.details.variables['extracted_amount'] = "15000";
      replyText += (replyText ? "\n\n" : "") + `🔍 *AI Vision OCR Reader*:\n` +
                   `- Kitambulisho/Risiti imesomwa!\n` +
                   `- Namba ya Malipo (Control No): *991234567890*\n` +
                   `- Kiasi: *TSH 15,000*`;
      const nextId = nodeData.nextNodeId;
      if (nextId) currentNode = nodes.find(n => n.id === nextId);
      else break;
    }
    // 9. VOICE BOT NODE
    else if (nodeType === 'voice_bot') {
      replyText += (replyText ? "\n\n" : "") + `🎙️ *WhatsApp Voice Bot Engine*:\n` +
                   `🎙️ _[Simulated Audio Received]_ \n` +
                   `🗣️ Speech-to-Text: "${userInput}"\n` +
                   `🔊 Reply generated as Swahili Speech Response!`;
      const nextId = nodeData.nextNodeId;
      if (nextId) currentNode = nodes.find(n => n.id === nextId);
      else break;
    }
    // 10. IMAGE UNDERSTANDING NODE
    else if (nodeType === 'image_understanding') {
      replyText += (replyText ? "\n\n" : "") + `📸 *Gemini Vision Analyzer*:\n` +
                   `Picha imepokelewa na kuchambuliwa!\n` +
                   `Sawa na bidhaa: *Chips Kuku Mshikaki* (Burger Point)\n` +
                   `Gharama: *TSH 9,500*`;
      const nextId = nodeData.nextNodeId;
      if (nextId) currentNode = nodes.find(n => n.id === nextId);
      else break;
    }
    // 11. LIVE MAP NODE
    else if (nodeType === 'live_map') {
      replyText += (replyText ? "\n\n" : "") + `🗺️ *Live Tracking Map Node*:\n` +
                   `📍 Dereva wako (Ally Rajabu) yupo njiani!\n` +
                   `⏱️ ETA: *Dakika 4* (Umbali: mita 850)\n` +
                   `🔗 Angalia Live Map hapa: https://papo-hapo.tz/track/PH-9921`;
      const nextId = nodeData.nextNodeId;
      if (nextId) currentNode = nodes.find(n => n.id === nextId);
      else break;
    }
    // 12. A/B TESTING NODE
    else if (nodeType === 'ab_testing') {
      const chosenFlow = Math.random() < 0.5 ? 'A' : 'B';
      const nextId = chosenFlow === 'A' ? nodeData.flowANodeId : nodeData.flowBNodeId;
      replyText += (replyText ? "\n\n" : "") + `🔀 *A/B Testing Node* (Running Flow ${chosenFlow})...`;
      if (nextId) currentNode = nodes.find(n => n.id === nextId);
      else break;
    }
    // 13. AUTO TRANSLATION NODE
    else if (nodeType === 'auto_translation') {
      replyText += (replyText ? "\n\n" : "") + `🌐 *AI Auto Translation*:\n` +
                   `- Input detected in Kiswahili/English\n` +
                   `- Agent Translation is ACTIVE!`;
      const nextId = nodeData.nextNodeId;
      if (nextId) currentNode = nodes.find(n => n.id === nextId);
      else break;
    }
    // 14. EVENT AUTOMATION NODE
    else if (nodeType === 'event_automation') {
      replyText += (replyText ? "\n\n" : "") + `⚡ *Event Triggered*: ride_completed -> Send Feedback Request!`;
      const nextId = nodeData.nextNodeId;
      if (nextId) currentNode = nodes.find(n => n.id === nextId);
      else break;
    }
    // 15. END NODE
    else if (nodeType === 'end') {
      delete session.details.currentNodeId;
      delete session.details.activeQuestionNodeId;
      session.step = 'START';
      await saveMetaSession(session, dbAdmin);

      let text = nodeData.text || "Asante kwa kutumia Papo Hapo! Karibu tena kufanya huduma nasi! 😊";
      for (const [key, val] of Object.entries(session.details.variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        text = text.replace(regex, String(val));
      }
      replyText += (replyText ? "\n\n" : "") + text;
      return replyText;
    }
    else {
      break;
    }
  }

  if (currentNode) {
    session.details.currentNodeId = currentNode.id;
  } else {
    delete session.details.currentNodeId;
    delete session.details.activeQuestionNodeId;
    session.step = 'START';
  }

  await saveMetaSession(session, dbAdmin);
  return replyText || "Mazungumzo yamekamilika.";
}

/**
 * Helper to dynamically apply current business services configuration (enabled/disabled/maintenance)
 * to any custom welcome message or node text that contains the services list.
 */
export const META_DEFAULT_SERVICES = [
  { key: 'taxi', id: 'teksi', emoji: '🚖', title: 'PapoRide', desc: 'Usafiri', enDesc: 'Rides' },
  { key: 'food', id: 'chakula', emoji: '🍔', title: 'PapoFood', desc: 'Chakula', enDesc: 'Food & Tables' },
  { key: 'grocery', id: 'sokoni', emoji: '🛍️', title: 'PapoMart', desc: 'Mahitaji ya Sokoni', enDesc: 'Groceries' },
  { key: 'parcel', id: 'vifurushi', emoji: '📦', title: 'PapoSend', desc: 'Usafirishaji wa Mizigo', enDesc: 'Parcel Delivery' },
  { key: 'pharmacy', id: 'dawa', emoji: '💊', title: 'PapoMed', desc: 'Dawa na Afya', enDesc: 'Pharmacy & Health' },
  { key: 'salon', id: 'saluni', emoji: '💇', title: 'PapoStyle', desc: 'Saluni na Spa', enDesc: 'Salon & Spa' },
  { key: 'handyman', id: 'fundi', emoji: '🛠️', title: 'PapoFix', desc: 'Mafundi na Matengenezo', enDesc: 'Repairs & Handyman' },
  { key: 'hotel', id: 'hoteli', emoji: '🏨', title: 'PapoStay', desc: 'Hoteli na Malazi', enDesc: 'Hotels & Stays' },
  { key: 'events', id: 'matukio', emoji: '🎟️', title: 'PapoTicket', desc: 'Tiketi za Matukio', enDesc: 'Event Tickets' },
  { key: 'bus_ticket', id: 'bus_ticket', emoji: '🚌', title: 'PapoBus', desc: 'Tiketi za Mabasi', enDesc: 'Bus Tickets' },
  { key: 'car_rental', id: 'car_rental', emoji: '🚗', title: 'PapoRent', desc: 'Kukodisha Magari', enDesc: 'Car Rental' },
  { key: 'ecommerce', id: 'maduka', emoji: '🛒', title: 'PapoMall', desc: 'Maduka', enDesc: 'Online Shopping' },
  { key: 'papopay', id: 'papopay', emoji: '💳', title: 'PapoPay', desc: 'Malipo na Wakala', enDesc: 'Wallet & Payments' }
];

/**
 * Helper to dynamically apply current business services configuration (enabled/disabled/maintenance)
 * to any custom welcome message or node text that contains the services list.
 */
export function applyBusinessConfigToWelcomeText(text: string, servicesConfig: any, lang: 'sw' | 'en' = 'sw'): string {
  if (!text) return text;
  if (!servicesConfig || Object.keys(servicesConfig).length === 0) return text;

  const hasServiceList =
    text.includes("TAXI") ||
    text.includes("PAPORIDE") ||
    text.includes("PapoRide") ||
    text.includes("CHAKULA") ||
    text.includes("PAPOFOOD") ||
    text.includes("PapoFood") ||
    text.includes("SOKONI");
  if (!hasServiceList) return text;

  const isEn = lang === 'en';
  const active = META_DEFAULT_SERVICES.filter(item => {
    const sData = servicesConfig[item.id];
    return !sData || sData.enabled !== false;
  }).map((item, idx) => {
    const sData = servicesConfig[item.id] || {};
    return {
      ...item,
      displayNum: idx + 1,
      isMaintenance: sData.maintenance === true
    };
  });

  const firstServiceIndex = text.search(/(🚖|🍔|🛍️|📦|💇‍♀️|💇|🏨|🚗|💊|🚌|🛠️|🎟️|🛒|💳|\*\d+\.)/);
  let welcomeHeader = isEn
    ? `👋 *WELCOME TO PAPO HAPO SUPER APP!* 🟢\n\nI'm *Papo Hapo Assistant* 🤖. Order multiple services with ease!\n\n*CHOOSE YOUR SERVICE:*\n\n`
    : `👋 *KARIBU PAPO HAPO SUPER APP!* 🟢\n\nMimi ni *Papo Hapo Assistant* 🤖. Agiza huduma mbalimbali kwa urahisi!\n\n*CHAGUA HUDUMA YAKO:*\n\n`;
  if (!isEn && firstServiceIndex !== -1) {
    welcomeHeader = text.substring(0, firstServiceIndex);
  }

  let welcomeBody = "";
  active.forEach(srv => {
    const maintTag = srv.isMaintenance ? (isEn ? " _(Maintenance)_" : " _(Matengenezo)_") : "";
    const label = isEn ? srv.enDesc : srv.desc;
    welcomeBody += `${srv.emoji} ${srv.displayNum}. ${srv.title} – ${label}${maintTag}\n`;
  });
  welcomeBody += isEn
    ? `📋 ${active.length + 1}. My Orders – Track Your Orders\n`
    : `📋 ${active.length + 1}. Oda Zangu – Fuatilia Oda Zako\n`;

  const welcomeFooter = isEn
    ? `\n✨ *Reply with a number (1–${active.length + 1}), service name, or describe what you need.*\n\n*Papo Hapo – All Services, One Place!* ❤️\n_(Andika *SW* kwa Kiswahili)_`
    : `\n✨ *Unaweza kuandika namba (1–${active.length + 1}), jina la huduma au kueleza unachohitaji moja kwa moja.*\n\n*Papo Hapo – Huduma Zote, Sehemu Moja!* ❤️\n_(Type *EN* for English)_`;
  return welcomeHeader + welcomeBody + welcomeFooter;
}

/**
 * Generates the dynamic welcome message based on active/enabled services
 */
export function generateDynamicWelcomeMessage(
  servicesConfig: any,
  chSymbol: string,
  customWelcome?: string,
  customerName?: string,
  lang: 'sw' | 'en' = 'sw'
): string {
  const isEn = lang === 'en';
  if (customWelcome && !isEn) {
    const replaced = customWelcome.replace(/{channel}/g, chSymbol);
    const applied = applyBusinessConfigToWelcomeText(replaced, servicesConfig, 'sw');
    return customerName && !applied.includes(customerName)
      ? `Habari *${customerName}* 👋\n\n${applied}`
      : applied;
  }

  const badge = chSymbol.includes('🟢') ? '🟢' : chSymbol.includes('🔵') ? '🔵' : '🟣';

  const activeServices = META_DEFAULT_SERVICES.filter(item => {
    const sData = servicesConfig?.[item.id];
    return !sData || sData.enabled !== false;
  }).map((item, idx) => {
    const sData = servicesConfig?.[item.id] || {};
    const isMaintenance = sData.maintenance === true;
    return {
      ...item,
      displayNum: (idx + 1).toString(),
      isMaintenance
    };
  });

  let welcome = '';
  if (isEn) {
    welcome = customerName ? `Hello *${customerName}* 👋\n\n` : '';
    welcome +=
      `👋 *WELCOME TO PAPO HAPO SUPER APP!* ${badge}\n\n` +
      `I'm *Papo Hapo Assistant* 🤖. Order multiple services with ease!\n\n` +
      `*CHOOSE YOUR SERVICE:*\n\n`;

    activeServices.forEach(srv => {
      const maintTag = srv.isMaintenance ? " _(Maintenance)_" : "";
      welcome += `${srv.emoji} ${srv.displayNum}. ${srv.title} – ${srv.enDesc}${maintTag}\n`;
    });
    welcome += `📋 ${activeServices.length + 1}. My Orders – Track Your Orders\n`;
    welcome +=
      `\n✨ *Reply with a number (1–${activeServices.length + 1}), service name, or describe what you need.*\n\n` +
      `*Papo Hapo – All Services, One Place!* ❤️\n_(Andika *SW* kwa Kiswahili)_`;
    return welcome;
  }

  welcome = customerName ? `Habari *${customerName}* 👋\n\n` : '';
  welcome +=
    `👋 *KARIBU PAPO HAPO SUPER APP!* ${badge}\n\n` +
    `Mimi ni *Papo Hapo Assistant* 🤖. Agiza huduma mbalimbali kwa urahisi!\n\n` +
    `*CHAGUA HUDUMA YAKO:*\n\n`;

  activeServices.forEach(srv => {
    const maintTag = srv.isMaintenance ? " _(Matengenezo)_" : "";
    welcome += `${srv.emoji} ${srv.displayNum}. ${srv.title} – ${srv.desc}${maintTag}\n`;
  });
  welcome += `📋 ${activeServices.length + 1}. Oda Zangu – Fuatilia Oda Zako\n`;
  welcome +=
    `\n✨ *Unaweza kuandika namba (1–${activeServices.length + 1}), jina la huduma au kueleza unachohitaji moja kwa moja.*\n\n` +
    `*Papo Hapo – Huduma Zote, Sehemu Moja!* ❤️\n_(Type *EN* for English)_`;
  return welcome;
}

async function translateSwahiliReplyToEnglish(swText: string): Promise<string> {
  if (!swText) return swText;
  const clean = swText.replace(/^\[\[EN_NATIVE\]\]/, '');
  if (swText.startsWith('[[EN_NATIVE]]')) {
    return clean;
  }

  // Try Gemini Flash for natural, crisp English keeping WhatsApp markdown, URLs, codes & TZS untouched
  if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
    try {
      const prompt = `Translate this WhatsApp customer-bot message from Swahili to concise, natural English.
RULES:
- Preserve ALL WhatsApp markdown (*bold*, _italic_), emojis, numbers, prices (TZS ...), booking codes (#...), brand names (PapoRide, PapoFood, PapoMart, PapoSend, PapoMed, PapoStyle, PapoFix, PapoStay, PapoTicket, PapoBus, PapoRent, PapoMall, PapoPay), and URLs EXACTLY as-is.
- Keep it short, crisp, and mobile-friendly.
- Output ONLY the translated English message, no preamble or quotes.

Message:
${clean}`;
      const res = await generateContentWithRetry({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      const out = res?.text?.trim();
      if (out && out.length > 0) {
        return out;
      }
    } catch (err) {
      console.warn('[Meta Bot] English translation fallback triggered:', err);
    }
  }
  return clean;
}

/**
 * Handles input from Meta channels (WhatsApp, Facebook, Instagram) and returns text + media cards
 */
export async function handleMetaInputWithMedia(
  senderId: string,
  textBody: string,
  channel: 'whatsapp' | 'messenger' | 'instagram',
  dbAdmin: any
): Promise<MetaBotResponse> {
  const mediaCollector: MetaMediaAttachment[] = [];
  let text = await handleMetaInputInternal(senderId, textBody, channel, dbAdmin, mediaCollector);
  const session = await getMetaSession(senderId, channel, dbAdmin);
  const lang = session.details?.lang || 'sw';

  if (text.startsWith('[[EN_NATIVE]]')) {
    text = text.slice('[[EN_NATIVE]]'.length);
  } else if (lang === 'en') {
    text = await translateSwahiliReplyToEnglish(text);
  }

  return { text, media: mediaCollector };
}

/**
 * Handles input from Meta channels (WhatsApp, Facebook, Instagram)
 */
export async function handleMetaInput(
  senderId: string,
  textBody: string,
  channel: 'whatsapp' | 'messenger' | 'instagram',
  dbAdmin: any
): Promise<string> {
  const res = await handleMetaInputWithMedia(senderId, textBody, channel, dbAdmin);
  return res.text;
}

function cloneSessionDetails(details: Record<string, any> | undefined): Record<string, any> {
  if (!details) return {};
  try {
    return JSON.parse(JSON.stringify(details));
  } catch {
    return { ...details };
  }
}

function preserveCustomerFields(
  details: Record<string, any> | undefined,
  langOverride?: 'sw' | 'en',
  profile?: MetaCustomerProfile | null
): Record<string, any> {
  const next: Record<string, any> = {};
  const cName = details?.customerName || profile?.name;
  const cPhone = details?.phone || profile?.phone;
  const cLang = langOverride || details?.lang || profile?.lang;
  const cLoc = details?.lastLocation || profile?.lastLocation;
  if (cName) next.customerName = cName;
  if (cPhone) next.phone = cPhone;
  if (cLang) next.lang = cLang;
  if (cLoc) next.lastLocation = cLoc;
  return next;
}

function isValidationErrorReply(reply: string): boolean {
  const stripped = (reply || '').replace(/^\[\[EN_NATIVE\]\]/, '').trim();
  return stripped.startsWith('⚠️');
}

function withActiveStepNavHint(replyText: string, lang: 'sw' | 'en', session: MetaSession): string {
  if (!replyText || isValidationErrorReply(replyText)) return replyText;
  const inFoodCheckoutCart =
    session.service === 'food' &&
    session.step === 'FOOD_SELECT_ITEM' &&
    Array.isArray(session.details?.foodCart) &&
    session.details.foodCart.length > 0;
  const hint =
    lang === 'en'
      ? inFoodCheckoutCart
        ? `\n\n_(Reply *Back* to go back • *Restart* for Main Menu)_`
        : `\n\n_(0. Back • 00. Start over)_`
      : inFoodCheckoutCart
      ? `\n\n_(Andika *Rudi* kurudi • *Anza upya* mwanzo)_`
      : `\n\n_(0. Rudi nyuma • 00. Anza upya)_`;
  return `${replyText}${hint}`;
}

async function handleMetaInputInternal(
  senderId: string,
  textBody: string,
  channel: 'whatsapp' | 'messenger' | 'instagram',
  dbAdmin: any,
  mediaCollector?: MetaMediaAttachment[]
): Promise<string> {
  const session = await getMetaSession(senderId, channel, dbAdmin);
  const beforeSnapshot: MetaHistoryEntry = {
    step: session.step,
    service: session.service,
    details: cloneSessionDetails(session.details),
    prompt: session.lastPrompt || ''
  };
  const beforeSerialized = JSON.stringify(beforeSnapshot.details);

  let skipHistoryUpdate = false;
  const markSkipHistory = () => {
    skipHistoryUpdate = true;
  };

  const reply = await processMetaInputCore(
    senderId,
    textBody,
    channel,
    dbAdmin,
    session,
    mediaCollector,
    markSkipHistory
  );

  const lang: 'sw' | 'en' = session.details?.lang === 'en' ? 'en' : 'sw';

  if (skipHistoryUpdate) {
    return reply;
  }

  if (isValidationErrorReply(reply)) {
    return reply;
  }

  const inInteractiveFlow =
    (Boolean(session.service) && session.step !== 'START') ||
    session.step === 'CHOOSING_LANGUAGE' ||
    session.step === 'TRACKING_LOOKUP_PHONE' ||
    session.step === 'CHANGING_PHONE';

  if (inInteractiveFlow) {
    const stateProgressed =
      beforeSnapshot.step !== session.step ||
      beforeSnapshot.service !== session.service ||
      beforeSerialized !== JSON.stringify(session.details || {});

    if (
      stateProgressed &&
      beforeSnapshot.step !== 'START' &&
      beforeSnapshot.step !== 'REGISTERING_CUSTOMER' &&
      (beforeSnapshot.prompt || (beforeSnapshot.step === 'COLLECTING_ROUTE' && !beforeSnapshot.service))
    ) {
      const nextHistory = Array.isArray(session.history) ? [...session.history] : [];
      nextHistory.push(beforeSnapshot);
      session.history = nextHistory.slice(-10);
    }
    session.lastPrompt = reply;
    await saveMetaSession(session, dbAdmin);
    return withActiveStepNavHint(reply, lang, session);
  }

  // Idle / completed / Main Menu state
  session.history = [];
  const stripped = (reply || '').replace(/^\[\[EN_NATIVE\]\]/, '').trim();
  const isCompletionOrTracking =
    stripped.startsWith('✅') ||
    stripped.startsWith('🎉') ||
    stripped.startsWith('📋') ||
    stripped.startsWith('📲') ||
    stripped.startsWith('🎟️') ||
    stripped.startsWith('🏨') ||
    stripped.startsWith('🛠️') ||
    stripped.startsWith('✨');
  if (!session.service && session.step === 'COLLECTING_ROUTE' && !isCompletionOrTracking) {
    session.lastPrompt = reply;
  } else {
    delete session.lastPrompt;
  }
  await saveMetaSession(session, dbAdmin);
  return reply;
}

async function processMetaInputCore(
  senderId: string,
  textBody: string,
  channel: 'whatsapp' | 'messenger' | 'instagram',
  dbAdmin: any,
  session: MetaSession,
  mediaCollector: MetaMediaAttachment[] | undefined,
  markSkipHistory: () => void
): Promise<string> {
  const cleanInput = textBody.trim();
  const cleanedLower = cleanInput.toLowerCase();
  
  // Quick channel-specific visual prefixes for beautiful formatting
  const chSymbol = channel === 'whatsapp' ? '🟢 WhatsApp' : channel === 'instagram' ? '📸 Instagram' : '🔵 Messenger';
  const waDigits = channel === 'whatsapp' ? senderId.replace(/\D/g, '') : '';
  const defaultWaPhone = waDigits.length >= 9 ? `+${waDigits}` : '';

  // --- 0A. POST-TRIP DRIVER RATING INTERCEPTOR ---
  if (session.details?.ratingRideId) {
    const ratingMatch = cleanInput.match(/^([1-5])(?:\s*(?:nyota|stars?|\/\s*5|\*))?$/i);
    if (ratingMatch) {
      const stars = parseInt(ratingMatch[1], 10);
      const rideId = session.details.ratingRideId;
      const driverId = session.details.ratingDriverId || '';
      const driverName = session.details.ratingDriverName || 'Dereva';
      const cName = session.details.customerName || 'Mteja';

      if (dbAdmin && rideId) {
        try {
          await dbAdmin.collection('rides').doc(rideId).update({
            rating: stars,
            ratedAt: new Date(),
          });
          await dbAdmin.collection('reviews').add({
            rideId,
            driverId,
            customerId: `meta-client-${senderId}`,
            customerName: cName,
            rating: stars,
            channel,
            createdAt: new Date(),
          });
        } catch (rateErr) {
          console.warn('[Meta Bot] Could not persist rating:', rateErr);
        }
      }

      delete session.details.ratingRideId;
      delete session.details.ratingDriverId;
      delete session.details.ratingDriverName;
      session.step = 'COLLECTING_ROUTE';
      delete session.service;
      await saveMetaSession(session, dbAdmin);

      const starEmoji = '⭐'.repeat(stars);
      return `🙏 Asante sana *${cName}* kwa kumpa dereva *${driverName}* tathmini ya ${starEmoji} (*${stars}/5*)!\n\nMaoni yako yanatusaidia kuboresha huduma zetu. Andika *Menu* kuagiza huduma nyingine wakati wowote! 🚖✨`;
    }

    if (['skip', 'ruka', 'baadae', 'menu', 'hi', 'habari', 'mambo', 'hello', '00', 'anza upya', 'restart'].includes(cleanedLower)) {
      delete session.details.ratingRideId;
      delete session.details.ratingDriverId;
      delete session.details.ratingDriverName;
      session.step = 'START';
      await saveMetaSession(session, dbAdmin);
    } else {
      return `⭐ Tafadhali tuma namba *1* hadi *5* kumpa tathmini dereva *${session.details.ratingDriverName || 'wako'}* (au andika *Menu* kuendelea na huduma nyingine).`;
    }
  }

  // --- 0B. CUSTOMER PROFILE SYNC & LANGUAGE PREFERENCE ---
  let customerProfile = await getMetaCustomerProfile(senderId, channel, dbAdmin);
  if (customerProfile) {
    session.details.customerName = customerProfile.name;
    if (!session.details.phone && customerProfile.phone) {
      session.details.phone = customerProfile.phone;
    }
    if (customerProfile.lang && !session.details.lang) {
      session.details.lang = customerProfile.lang;
    }
    if (customerProfile.lastLocation && !session.details.lastLocation) {
      session.details.lastLocation = customerProfile.lastLocation;
    }
  }

  let lang: 'sw' | 'en' = session.details.lang || customerProfile?.lang || 'sw';

  const getKnownPhone = (): string => {
    for (const cand of [session.details?.phone, customerProfile?.phone, defaultWaPhone]) {
      if (!cand) continue;
      const digits = String(cand).replace(/\D/g, '');
      if (digits.length >= 9) return String(cand).trim();
    }
    return '';
  };

  const persistPhonePreference = async (phoneVal: string) => {
    const cleanP = (phoneVal || '').trim();
    if (!cleanP || cleanP.replace(/\D/g, '').length < 9) return;
    session.details.phone = cleanP;
    if (customerProfile) {
      customerProfile = { ...customerProfile, phone: cleanP };
      await saveMetaCustomerProfile(customerProfile, dbAdmin);
    }
  };

  const persistLocationPreference = async (loc: MetaSavedLocation) => {
    if (!loc?.name) return;
    const saved: MetaSavedLocation = {
      placeId: loc.placeId,
      name: loc.name,
      address: loc.address || loc.name,
      lat: loc.lat,
      lng: loc.lng,
      updatedAt: Date.now()
    };
    session.details.lastLocation = saved;
    if (customerProfile) {
      customerProfile = { ...customerProfile, lastLocation: saved };
      await saveMetaCustomerProfile(customerProfile, dbAdmin);
    }
  };

  const loadServicesConfigQuick = async () => {
    let cfg: any = {};
    if (dbAdmin) {
      try {
        const bizSnap = await dbAdmin.collection('config').doc('business').get();
        if (bizSnap.exists) cfg = bizSnap.data().services || {};
      } catch {}
    }
    return cfg;
  };

  // Global Language Switch Commands (work from any step!)
  const isSwitchToEnglish = /^(en|eng|english|kiingereza|speak\s+english|switch\s+to\s+english|change\s+(?:language\s+)?to\s+english|use\s+english|in\s+english)$/i.test(cleanInput);
  const isSwitchToSwahili = /^(sw|swa|swahili|kiswahili|tumia\s+kiswahili|switch\s+to\s+swahili|change\s+(?:language\s+)?to\s+swahili|badili\s+(?:lugha\s+)?kwenda\s+kiswahili)$/i.test(cleanInput);
  const isLanguagePickerCmd = /^(lugha|language|lang|change\s+language|badili\s+lugha|switch\s+language)$/i.test(cleanInput);

  if (isSwitchToEnglish || isSwitchToSwahili) {
    const nextLang: 'sw' | 'en' = isSwitchToEnglish ? 'en' : 'sw';
    lang = nextLang;
    session.details.lang = nextLang;
    if (customerProfile) {
      customerProfile = { ...customerProfile, lang: nextLang };
      await saveMetaCustomerProfile(customerProfile, dbAdmin);
    }
    if (!customerProfile && !session.details.customerName) {
      session.step = 'REGISTERING_CUSTOMER';
      markSkipHistory();
      await saveMetaSession(session, dbAdmin);
      return nextLang === 'en'
        ? `[[EN_NATIVE]]🇬🇧 *Language set to English!*\n\n👋 Welcome to *Papo Hapo* (${chSymbol})!\nEnter your *full name* to get started (e.g. *Juma Hassan*):`
        : `🇹🇿 *Lugha imebadilishwa kuwa Kiswahili!*\n\n👋 Karibu *Papo Hapo* (${chSymbol})!\nAndika *jina lako kamili* kuanza (mf. *Juma Hassan*):`;
    }
    const cName = customerProfile?.name || session.details.customerName;
    session.history = [];
    session.step = 'COLLECTING_ROUTE';
    delete session.service;
    session.details = preserveCustomerFields(session.details, nextLang, customerProfile);
    const servicesCfg = await loadServicesConfigQuick();
    const menuText = generateDynamicWelcomeMessage(servicesCfg, chSymbol, undefined, cName, nextLang);
    const wrappedMenu = nextLang === 'en' ? `[[EN_NATIVE]]${menuText}` : menuText;
    session.lastPrompt = wrappedMenu;
    markSkipHistory();
    await saveMetaSession(session, dbAdmin);
    return wrappedMenu;
  }

  if (isLanguagePickerCmd) {
    session.step = 'CHOOSING_LANGUAGE';
    delete session.service;
    await saveMetaSession(session, dbAdmin);
    return `[[EN_NATIVE]]🌐 *Chagua Lugha / Choose Language:*\n\n1. 🇹🇿 *Kiswahili*\n2. 🇬🇧 *English*`;
  }

  if (session.step === 'CHOOSING_LANGUAGE') {
    let pickedLang: 'sw' | 'en' | null = null;
    if (cleanInput === '1' || /swahili|kiswahili/i.test(cleanInput)) pickedLang = 'sw';
    else if (cleanInput === '2' || /english|kiingereza|\ben\b/i.test(cleanInput)) pickedLang = 'en';

    if (!pickedLang) {
      return `[[EN_NATIVE]]⚠️ Chagua *1* (Kiswahili) au *2* (English).`;
    }
    lang = pickedLang;
    session.details.lang = pickedLang;
    if (customerProfile) {
      customerProfile = { ...customerProfile, lang: pickedLang };
      await saveMetaCustomerProfile(customerProfile, dbAdmin);
    }
    if (!customerProfile && !session.details.customerName) {
      session.step = 'REGISTERING_CUSTOMER';
      markSkipHistory();
      await saveMetaSession(session, dbAdmin);
      return pickedLang === 'en'
        ? `[[EN_NATIVE]]🇬🇧 *English selected!*\n\n👋 Welcome to *Papo Hapo*!\nEnter your *full name* to get started (e.g. *Juma Hassan*):`
        : `🇹🇿 *Kiswahili kimechaguliwa!*\n\n👋 Karibu *Papo Hapo* (${chSymbol})!\nAndika *jina lako kamili* kuanza (mf. *Juma Hassan*):`;
    }
    const cName = customerProfile?.name || session.details.customerName;
    session.history = [];
    session.step = 'COLLECTING_ROUTE';
    delete session.service;
    session.details = preserveCustomerFields(session.details, pickedLang, customerProfile);
    const servicesCfg = await loadServicesConfigQuick();
    const menuText = generateDynamicWelcomeMessage(servicesCfg, chSymbol, undefined, cName, pickedLang);
    const wrappedMenu = pickedLang === 'en' ? `[[EN_NATIVE]]${menuText}` : menuText;
    session.lastPrompt = wrappedMenu;
    markSkipHistory();
    await saveMetaSession(session, dbAdmin);
    return wrappedMenu;
  }

  if (!customerProfile && !session.details.customerName) {
    if (session.step === 'REGISTERING_CUSTOMER') {
      const isGps = cleanInput.startsWith('__GPS_PIN__:');
      const isDigitOnly = /^\d+$/.test(cleanInput);
      const isGreetingWord = ['hi', 'mambo', 'vip', 'vipi', 'habari', 'hello', 'anza', 'start', 'menu', '0', '00', 'rudi', 'back'].includes(cleanedLower);
      if (isGps || isDigitOnly || isGreetingWord || cleanInput.length < 2) {
        return lang === 'en'
          ? `[[EN_NATIVE]]👋 Please enter your *full name* to finish quick registration (e.g. *Juma Hassan*):`
          : `👋 Tafadhali andika *Jina lako kamili* ili tukamilishe usajili wako mfupi (Mfano: *Juma Hassan*):`;
      }

      const cleanName = cleanInput
        .replace(/^(jina langu ni|naitwa|mimi ni|my name is)\s+/i, '')
        .trim()
        .split(/\s+/)
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

      const newProfile: MetaCustomerProfile = {
        senderId,
        channel,
        name: cleanName,
        phone: defaultWaPhone || session.details.phone || senderId,
        lang,
        createdAt: Date.now(),
      };
      await saveMetaCustomerProfile(newProfile, dbAdmin);
      session.details.customerName = cleanName;
      if (newProfile.phone) session.details.phone = newProfile.phone;
      session.step = 'COLLECTING_ROUTE';
      delete session.service;

      const servicesCfg = await loadServicesConfigQuick();
      const menuText = generateDynamicWelcomeMessage(servicesCfg, chSymbol, undefined, cleanName, lang);
      const wrappedMenu = lang === 'en' ? `[[EN_NATIVE]]${menuText}` : menuText;
      session.lastPrompt = wrappedMenu;
      markSkipHistory();
      await saveMetaSession(session, dbAdmin);
      return wrappedMenu;
    } else {
      session.step = 'REGISTERING_CUSTOMER';
      markSkipHistory();
      await saveMetaSession(session, dbAdmin);
      return lang === 'en'
        ? `[[EN_NATIVE]]👋 Welcome to *Papo Hapo* (${chSymbol})!\n\nEnter your *full name* to get started (e.g. *Juma Hassan*):`
        : `👋 Karibu *Papo Hapo* (${chSymbol})!\n\nAndika *jina lako kamili* kuanza (mf. *Juma Hassan*):`;
    }
  }

  // --- 0B2. GLOBAL CHANGE PHONE COMMAND ---
  const isChangePhoneCmd = /^(badili\s*(?:namba|simu)|change\s*(?:phone|number)|weka\s*namba\s*mpya)$/i.test(cleanInput);
  if (isChangePhoneCmd) {
    session.step = 'CHANGING_PHONE';
    await saveMetaSession(session, dbAdmin);
    return lang === 'en'
      ? `[[EN_NATIVE]]📞 Enter your new phone number (e.g. *0712345678*):`
      : `📞 Andika namba yako mpya ya simu (mf. *0712345678*):`;
  }

  // --- 0B3. GLOBAL "ANZA UPYA" (START OVER) & "RUDI NYUMA" (GO BACK) ---
  const isRestartCmd = /^(anza\s*upya|anza\s*tena|mwanzo|kurudi\s*mwanzo|restart|start\s*over|reset|home|menu|menyu|00)$/i.test(cleanInput);
  const allowZeroAsBack = !(
    session.service === 'food' &&
    session.step === 'FOOD_SELECT_ITEM' &&
    Array.isArray(session.details?.foodCart) &&
    session.details.foodCart.length > 0
  );
  const isBackCmd =
    /^(rudi|rudi\s*nyuma|nyuma|back|go\s*back|previous|prev)$/i.test(cleanInput) ||
    (allowZeroAsBack && cleanInput === '0');

  if (isRestartCmd) {
    const cName = customerProfile?.name || session.details?.customerName;
    session.history = [];
    session.step = 'COLLECTING_ROUTE';
    delete session.service;
    session.details = preserveCustomerFields(session.details, lang, customerProfile);
    const servicesCfg = await loadServicesConfigQuick();
    const menuText = generateDynamicWelcomeMessage(servicesCfg, chSymbol, undefined, cName, lang);
    const wrappedMenu = lang === 'en' ? `[[EN_NATIVE]]${menuText}` : menuText;
    session.lastPrompt = wrappedMenu;
    markSkipHistory();
    await saveMetaSession(session, dbAdmin);
    return wrappedMenu;
  }

  if (isBackCmd) {
    markSkipHistory();
    const historyList = Array.isArray(session.history) ? [...session.history] : [];
    const cName = customerProfile?.name || session.details?.customerName;

    if (historyList.length > 0) {
      const prev = historyList.pop()!;
      session.history = historyList;
      session.step = prev.step;
      if (prev.service) {
        session.service = prev.service;
      } else {
        delete session.service;
      }
      session.details = {
        ...(prev.details || {}),
        ...preserveCustomerFields(session.details, lang, customerProfile)
      };

      if (!session.service && (session.step === 'COLLECTING_ROUTE' || session.step === 'START')) {
        session.step = 'COLLECTING_ROUTE';
        session.history = [];
        const servicesCfg = await loadServicesConfigQuick();
        const menuText = generateDynamicWelcomeMessage(servicesCfg, chSymbol, undefined, cName, lang);
        const wrappedMenu = lang === 'en' ? `[[EN_NATIVE]]${menuText}` : menuText;
        session.lastPrompt = wrappedMenu;
        await saveMetaSession(session, dbAdmin);
        return wrappedMenu;
      }

      session.lastPrompt = prev.prompt || '';
      await saveMetaSession(session, dbAdmin);
      return withActiveStepNavHint(prev.prompt, lang, session);
    }

    // No history remaining => cleanly return to Main Menu
    session.history = [];
    session.step = 'COLLECTING_ROUTE';
    delete session.service;
    session.details = preserveCustomerFields(session.details, lang, customerProfile);
    const servicesCfg = await loadServicesConfigQuick();
    const menuText = generateDynamicWelcomeMessage(servicesCfg, chSymbol, undefined, cName, lang);
    const wrappedMenu = lang === 'en' ? `[[EN_NATIVE]]${menuText}` : menuText;
    session.lastPrompt = wrappedMenu;
    await saveMetaSession(session, dbAdmin);
    return wrappedMenu;
  }

  if (session.step === 'CHANGING_PHONE') {
    const digitsOnly = cleanInput.replace(/\D/g, '');
    if (digitsOnly.length < 9) {
      return lang === 'en'
        ? `[[EN_NATIVE]]⚠️ Enter a valid phone number (e.g. *0712345678*):`
        : `⚠️ Andika namba sahihi ya simu (mf. *0712345678*):`;
    }
    await persistPhonePreference(cleanInput);
    const cName = customerProfile?.name || session.details?.customerName;
    session.history = [];
    session.step = 'COLLECTING_ROUTE';
    delete session.service;
    session.details = preserveCustomerFields(session.details, lang, customerProfile);
    const servicesCfg = await loadServicesConfigQuick();
    const menuText = generateDynamicWelcomeMessage(servicesCfg, chSymbol, undefined, cName, lang);
    const confirmPrefix =
      lang === 'en'
        ? `✅ Phone number updated to *${cleanInput}*!\n\n`
        : `✅ Namba ya simu imehifadhiwa: *${cleanInput}*!\n\n`;
    const full = `${confirmPrefix}${menuText}`;
    const wrapped = lang === 'en' ? `[[EN_NATIVE]]${full}` : full;
    session.lastPrompt = wrapped;
    markSkipHistory();
    await saveMetaSession(session, dbAdmin);
    return wrapped;
  }

  // --- 0C. GLOBAL GPS LOCATION PIN HANDLER ---
  if (cleanInput.startsWith('__GPS_PIN__:')) {
    delete session.details.currentNodeId;
    delete session.details.activeQuestionNodeId;
    const gpsLoc = await resolveGpsLocationPin(cleanInput);
    if (!gpsLoc) {
      return lang === 'en'
        ? `[[EN_NATIVE]]⚠️ Could not read your GPS pin. Please type your area name (e.g. *Mikocheni*):`
        : `⚠️ Imeshindikana kusoma eneo la GPS. Tafadhali andika jina la mtaa uliopo (Mfano: *Mikocheni*):`;
    }
    await persistLocationPreference(gpsLoc);

    if (session.service === 'food' && session.step === 'FOOD_DELIVERY_ADDRESS') {
      session.details.deliveryAddress = gpsLoc.name;
      session.details.deliveryCoords = gpsLoc;
      session.step = 'SELECTING_PAYMENT_METHOD';
      await saveMetaSession(session, dbAdmin);
      const cartTotal = (session.details.foodCart || []).reduce((s: number, it: any) => s + (it.price || 0) * (it.quantity || 1), 0);
      return lang === 'en'
        ? `[[EN_NATIVE]]📍 Delivery: *${gpsLoc.name}*\nTotal: *TZS ${cartTotal.toLocaleString()}*\n\n💳 *Payment Method:*\n1. 💵 Cash\n2. 📱 M-Pesa\n3. 📱 Tigo Pesa\n4. 📱 Airtel Money`
        : `📍 Eneo la kuletewa chakula: *${gpsLoc.name}*\nJumla ya oda: *TZS ${cartTotal.toLocaleString()}/=*\n\n💳 *CHAGUA NJIA YA MALIPO:*\n1. 💵 *Cash* (Lipa ukipokea)\n2. 📱 *M-Pesa*\n3. 📱 *Tigo Pesa (Mixx by Yas)*\n4. 📱 *Airtel Money*`;
    }
    if (session.service === 'ecommerce' && session.step === 'MALL_DELIVERY_ADDRESS') {
      session.details.deliveryAddress = gpsLoc.name;
      session.step = 'SELECTING_PAYMENT_METHOD';
      await saveMetaSession(session, dbAdmin);
      const total = session.details.mallTotal || session.details.selectedPrice || 0;
      return `📍 Eneo la kuletewa: *${gpsLoc.name}*\nJumla: *TZS ${total.toLocaleString()}*\n\n💳 *CHAGUA NJIA YA MALIPO:*\n1. 💵 *Cash* (Lipa ukipokea)\n2. 📱 *M-Pesa*\n3. 📱 *Tigo Pesa (Mixx by Yas)*\n4. 📱 *Airtel Money*`;
    }
    if (session.service === 'food' && (session.step === 'FOOD_SELECT_VENDOR' || session.step === 'FOOD_CHOOSE_MODE')) {
      const restaurants = await fetchRestaurantsForMeta(dbAdmin, { lat: gpsLoc.lat, lng: gpsLoc.lng });
      session.details.restaurantOptions = restaurants;
      session.step = 'FOOD_SELECT_VENDOR';
      await saveMetaSession(session, dbAdmin);
      appendMediaItems(
        mediaCollector,
        restaurants.map((r, idx) => ({
          url: r.imageUrl,
          caption: `*${idx + 1}. ${r.name}*\n📍 ${r.address}`
        }))
      );
      let resp = `📍 Migahawa ya karibu na *${gpsLoc.name}*:\n\n`;
      restaurants.forEach((r, idx) => {
        const distPart = typeof r.distanceKm === 'number' ? ` • ~${r.distanceKm} km` : '';
        const tblPart = r.openTablesCount ? ` • 🪑 Meza ${r.openTablesCount} wazi` : '';
        resp += `*${idx + 1}. ${r.name}*\n📍 ${r.address}${distPart}${tblPart}\n\n`;
      });
      resp += `Andika namba ya mgahawa (*1–${restaurants.length}*):`;
      return resp;
    }
    if ((session.service === 'grocery' || session.service === 'pharmacy') && session.step === 'COLLECTING_PHONE') {
      return await routeToServiceFlow(session, gpsLoc.name, dbAdmin, channel, mediaCollector, {
        getKnownPhone,
        persistPhonePreference,
        persistLocationPreference
      });
    }
    if (session.service === 'taxi' && session.details.awaitingDest && session.details.pickupName) {
      session.details.destCoordsOverride = gpsLoc;
      session.details.destinationName = gpsLoc.name;
      delete session.details.awaitingDest;
      delete session.details.awaitingPickup;
      session.details.route = `${session.details.pickupName} - ${gpsLoc.name}`;
      session.step = 'SELECTING_VEHICLE';
      await saveMetaSession(session, dbAdmin);
      const avail = await getLiveDriverAvailability(dbAdmin);
      const vMsg = formatVehicleChoiceMessage(session.details.pickupName, gpsLoc.name, avail, lang);
      return lang === 'en' ? `[[EN_NATIVE]]${vMsg}` : vMsg;
    }
    session.service = 'taxi';
    session.step = 'COLLECTING_ROUTE';
    session.details.pickupCoordsOverride = gpsLoc;
    session.details.pickupName = gpsLoc.name;
    delete session.details.route;
    delete session.details.awaitingPickup;
    session.details.awaitingDest = true;
    await saveMetaSession(session, dbAdmin);
    return lang === 'en'
      ? `[[EN_NATIVE]]📍 *Pickup:* ${gpsLoc.name}\n\n*Where are you going?* _(Type destination or send 📍 Location pin)_:`
      : `📍 *Kutoka:* ${gpsLoc.name}\n\n*Unaenda wapi?* _(Andika eneo au tuma 📍 Location)_:`;
  }

  // --- 0D. GLOBAL ORDER & BOOKING TRACKING ("ODA ZANGU" / #FD-3441 / #TBL-3947 / #PFX-... / #TK-... / #ML-... / #PP-...) ---
  const codeMatch = cleanInput.match(/^#?((?:FD|TBL|PH|PR|CR|SL|SK|HT|RX|BS|TR|PFX|ML|TK|PP)-[A-Z0-9]{3,10})$/i);
  const isTrackKeyword = /^(oda\s*zangu|fuatilia(\s+oda(\s+zangu)?)?|my\s*orders?|orders?|track(\s+orders?)?|booking\s*zangu|meza\s*zangu|safari\s*zangu|hali\s+ya\s+oda|status\s+ya\s+oda)$/i.test(cleanInput);

  if (session.step === 'TRACKING_LOOKUP_PHONE') {
    const typedDigits = cleanInput.replace(/\D/g, '');
    if (typedDigits.length >= 9) {
      await persistPhonePreference(cleanInput);
      session.step = 'COLLECTING_ROUTE';
      delete session.service;
      await saveMetaSession(session, dbAdmin);
      const tracked = await lookupCustomerAllTrackables(dbAdmin, { phone: cleanInput, senderId });
      return formatTrackedOrdersWhatsAppMessage(tracked, cleanInput, undefined, lang);
    }
    if (!['hi', 'menu', 'anza', 'start'].includes(cleanedLower)) {
      return lang === 'en'
        ? `[[EN_NATIVE]]⚠️ Please enter a valid phone number (e.g. *0782542520*), or reply *Menu*.`
        : `⚠️ Tafadhali andika namba sahihi ya simu uliyoagizia (Mfano: *0782542520*), au andika *Hi* kurudi kwenye Menu.`;
    }
  }

  if (codeMatch || isTrackKeyword) {
    delete session.details.currentNodeId;
    delete session.details.activeQuestionNodeId;
    const lookupPhone = getKnownPhone();
    const matchedCode = codeMatch ? codeMatch[1].toUpperCase() : undefined;

    if (!lookupPhone && !matchedCode) {
      session.step = 'TRACKING_LOOKUP_PHONE';
      delete session.service;
      await saveMetaSession(session, dbAdmin);
      return lang === 'en'
        ? `[[EN_NATIVE]]📋 *Track Your Orders*\n\nPlease enter the *phone number* used for your orders (e.g. *0782542520*):`
        : `📋 *Fuatilia Oda Zako Zote*\n\nTafadhali andika *namba yako ya simu* uliyoagizia ili tukuonyeshe oda zako zote (Mfano: *0782542520*):`;
    }

    session.step = 'COLLECTING_ROUTE';
    delete session.service;
    await saveMetaSession(session, dbAdmin);
    const tracked = await lookupCustomerAllTrackables(dbAdmin, {
      phone: lookupPhone,
      code: matchedCode,
      senderId
    });
    return formatTrackedOrdersWhatsAppMessage(tracked, lookupPhone, matchedCode, lang);
  }

  // Load custom meta config from local JSON or Firebase if database is available
  let customWelcome = "";
  let customTriggers: Array<{ keywords: string; response: string; title: string }> = [];
  let useWorkflow = false;
  let workflowNodes: any[] = [];
  let knowledgeBase = "";
  let loadedLocally = false;

  try {
    const localPath = path.join(process.cwd(), 'meta_config.json');
    if (fs.existsSync(localPath)) {
      const fileContent = fs.readFileSync(localPath, 'utf8');
      const configData = JSON.parse(fileContent);
      if (configData) {
        if (configData.welcomeMessage) {
          customWelcome = configData.welcomeMessage;
        }
        if (configData.triggers) {
          customTriggers = configData.triggers;
        }
        if (configData.useWorkflow !== undefined) {
          useWorkflow = !!configData.useWorkflow;
        }
        if (configData.nodes && configData.nodes.length > 0) {
          workflowNodes = configData.nodes;
        }
        if (configData.knowledgeBase) {
          knowledgeBase = configData.knowledgeBase;
        }
        loadedLocally = true;
        console.log("[Meta Bot] Loaded configuration from local meta_config.json file.");
      }
    }
  } catch (localErr) {
    console.warn("[Meta Bot] Failed to load local meta_config.json:", localErr);
  }
  
  if (!loadedLocally && dbAdmin) {
    try {
      const configSnap = await dbAdmin.collection('vendors').doc('papo-hapo-express').collection('settings').doc('meta_config').get();
      if (configSnap.exists) {
        const configData = configSnap.data();
        if (configData.welcomeMessage) {
          customWelcome = configData.welcomeMessage;
        }
        if (configData.triggers) {
          customTriggers = configData.triggers;
        }
        if (configData.useWorkflow) {
          useWorkflow = true;
        }
        if (configData.nodes && configData.nodes.length > 0) {
          workflowNodes = configData.nodes;
        }
        if (configData.knowledgeBase) {
          knowledgeBase = configData.knowledgeBase;
        }
      }
    } catch (err) {
      console.error("[Meta Bot] Error loading custom chat flow config from Firestore:", err);
    }
  }

  // --- KNOWLEDGE BASE INTEGRATION FALLBACK / INTERCEPTOR ---
  if (knowledgeBase && !session.service && cleanInput.length > 3 && !/^\d{1,2}$/.test(cleanInput)) {
    const isBasicGreeting = ['hi', 'mambo', 'vip', 'vipi', 'habari', 'hello', 'habari gani', 'anza', 'start', 'menu', 'ya', 'hodi', 'oje'].includes(cleanedLower);
    if (!isBasicGreeting) {
      const kbAnswer = await queryKnowledgeBase(cleanInput, knowledgeBase);
      if (kbAnswer) {
        return kbAnswer;
      }
    }
  }

  // --- RUN WORKFLOW ENGINE IF ACTIVE (without overriding active smart service / Taxi engine) ---
  const inActiveSmartService = Boolean(session.service) && !session.details.currentNodeId;
  const atWorkflowMenuOrIdle =
    !inActiveSmartService &&
    !session.details.activeQuestionNodeId &&
    (!session.details.currentNodeId ||
      ['n_menu_decision', 'n_welcome', 'n_start'].includes(session.details.currentNodeId));
  const isTaxiSelectionOrIntent =
    atWorkflowMenuOrIdle &&
    (cleanedLower === '1' ||
      cleanedLower === 'taxi' ||
      cleanedLower === 'teksi' ||
      cleanedLower === 'paporide' ||
      /\b(paporide|taxi|teksi|boda|bodaboda|bajaji|uber|bolt)\b/i.test(cleanedLower));

  const isFoodSelectionOrIntent =
    atWorkflowMenuOrIdle &&
    (cleanedLower === '2' ||
      cleanedLower === 'chakula' ||
      cleanedLower === 'food' ||
      cleanedLower === 'papofood' ||
      /\b(papofood|chakula|food|pizza|burger|chips|biryani|msosi|meza|kiti|viti|mgahawa|restaurant|book\s+meza|booking\s+meza|weka\s+meza)\b/i.test(cleanedLower));

  const isOtherAppServiceIntent =
    atWorkflowMenuOrIdle &&
    (/\b(papofix|papomall|papoticket|papopay|papomart|paposend|papomed|papostyle|papostay|papobus|paporent|fundi|umeme|bomba|tamasha|mechi|wallet|salio)\b/i.test(cleanedLower) ||
      ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'].includes(cleanInput));

  if (isTaxiSelectionOrIntent || isFoodSelectionOrIntent || isOtherAppServiceIntent) {
    delete session.details.currentNodeId;
    delete session.details.activeQuestionNodeId;
    session.step = 'COLLECTING_ROUTE';
    delete session.service;
  }

  if (useWorkflow && workflowNodes.length > 0 && !inActiveSmartService && !isTaxiSelectionOrIntent && !isFoodSelectionOrIntent && !isOtherAppServiceIntent) {
    const isReset = ['hi', 'mambo', 'vip', 'vipi', 'habari', 'hello', 'habari gani', 'anza', 'start', 'menu', 'ya', 'hodi', 'oje'].includes(cleanedLower);
    
    if (isReset || !session.details.currentNodeId) {
      // Reset flow and find start node
      const startNode = workflowNodes.find(n => n.type === 'start');
      if (startNode) {
        session.details.currentNodeId = startNode.id;
      } else {
        delete session.details.currentNodeId;
      }
      delete session.details.activeQuestionNodeId;
      session.details.variables = {};
      session.step = 'START';
      await saveMetaSession(session, dbAdmin);
      
      if (startNode) {
        return await executeNodeChain(startNode.id, cleanInput, session, workflowNodes, dbAdmin, channel);
      }
    } else {
      // Resume current workflow node
      return await executeNodeChain(session.details.currentNodeId, cleanInput, session, workflowNodes, dbAdmin, channel);
    }
  }

  // Check if user input matches any custom keywords defined by the admin (legacy triggers)
  if (customTriggers && customTriggers.length > 0) {
    for (const t of customTriggers) {
      if (!t.keywords) continue;
      const keywordsArray = t.keywords.split(',').map(k => k.trim().toLowerCase());
      if (keywordsArray.includes(cleanedLower)) {
        // Clear active session to return to start mode, and return response
        session.step = 'COLLECTING_ROUTE';
        delete session.service;
        session.details = {};
        await saveMetaSession(session, dbAdmin);
        return t.response;
      }
    }
  }

  // Load business services config
  let servicesConfig: any = {};
  if (dbAdmin) {
    try {
      const bizSnap = await dbAdmin.collection('config').doc('business').get();
      if (bizSnap.exists) {
        servicesConfig = bizSnap.data().services || {};
      }
    } catch (bizErr) {
      console.warn("[Meta Bot] Failed to fetch config/business for services:", bizErr);
    }
  }

  const activeServices = META_DEFAULT_SERVICES.filter(item => {
    const sData = servicesConfig[item.id];
    return !sData || sData.enabled !== false;
  }).map((item, idx) => {
    const sData = servicesConfig[item.id] || {};
    const isMaintenance = sData.maintenance === true;
    return {
      ...item,
      displayNum: (idx + 1).toString(),
      isMaintenance,
      maintenanceMessage: sData.message || `Huduma ya ${item.title} ipo kwenye matengenezo kwa sasa.`
    };
  });

  const trackMenuNumber = (activeServices.length + 1).toString();

  // Master Welcome Message
  const getWelcomeMessage = (customerName?: string) => {
    const welcomeStr = generateDynamicWelcomeMessage(servicesConfig, chSymbol, customWelcome, customerName, lang);
    return lang === 'en' ? `[[EN_NATIVE]]${welcomeStr}` : welcomeStr;
  };

  // If user says "hi" or triggers restart
  const isGreeting = ['hi', 'mambo', 'vip', 'vipi', 'habari', 'hello', 'habari gani', 'anza', 'start', 'menu', 'ya', 'hodi', 'oje'].includes(cleanedLower);
  
  if (isGreeting || session.step === 'START') {
    const preservedName = session.details?.customerName;
    const preservedPhone = session.details?.phone;
    const preservedLang = session.details?.lang || lang;
    session.step = 'START';
    delete session.service;
    session.details = {};
    if (preservedName) session.details.customerName = preservedName;
    if (preservedPhone) session.details.phone = preservedPhone;
    if (preservedLang) session.details.lang = preservedLang;
    
    // Classify first statement if it is conversational and not just a greeting
    if (!isGreeting && cleanInput.length > 3) {
      const { intent } = await classifyIntent(cleanInput);
      if (intent !== 'greeting' && intent !== 'other') {
        const matchedSrv = activeServices.find(srv => srv.key === intent);
        if (matchedSrv) {
          if (matchedSrv.isMaintenance) {
            return lang === 'en'
              ? `[[EN_NATIVE]]⚠️ *${matchedSrv.title}* is currently under maintenance.`
              : `⚠️ *${matchedSrv.title}* ipo kwenye matengenezo kwa sasa.`;
          }
          session.service = intent as any;
          return await routeToServiceFlow(session, cleanInput, dbAdmin, channel, mediaCollector, {
            getKnownPhone,
            persistPhonePreference,
            persistLocationPreference
          });
        } else {
          return lang === 'en'
            ? `[[EN_NATIVE]]⚠️ Sorry, *${intent.toUpperCase()}* is currently unavailable.`
            : `⚠️ Samahani, huduma ya *${intent.toUpperCase()}* haipatikani kwa sasa.`;
        }
      }
    }
    
    session.step = 'COLLECTING_ROUTE'; // Transition to standard numeric choices
    await saveMetaSession(session, dbAdmin);
    return getWelcomeMessage(preservedName);
  }

  // If we are collecting initial selection
  if (session.step === 'COLLECTING_ROUTE' && !session.service) {
    if (cleanInput === trackMenuNumber) {
      const lookupPhone = getKnownPhone();
      if (!lookupPhone) {
        session.step = 'TRACKING_LOOKUP_PHONE';
        await saveMetaSession(session, dbAdmin);
        return lang === 'en'
          ? `[[EN_NATIVE]]📋 *Track Your Orders*\n\nPlease enter the *phone number* used for your orders (e.g. *0782542520*):`
          : `📋 *Fuatilia Oda Zako Zote*\n\nTafadhali andika *namba yako ya simu* uliyoagizia ili tukuonyeshe oda zako zote (Mfano: *0782542520*):`;
      }
      const tracked = await lookupCustomerAllTrackables(dbAdmin, { phone: lookupPhone, senderId });
      return formatTrackedOrdersWhatsAppMessage(tracked, lookupPhone, undefined, lang);
    }

    // Check if numeric input matches any display number of active services
    const matchedSrvByNum = activeServices.find(srv => srv.displayNum === cleanInput);
    if (matchedSrvByNum) {
      if (matchedSrvByNum.isMaintenance) {
        return `⚠️ *MATENGENEZO / MAINTENANCE* ⚠️\n\n${matchedSrvByNum.maintenanceMessage}`;
      }
      session.service = matchedSrvByNum.key as any;
    } else {
      if (/^\d{1,2}$/.test(cleanInput)) {
        return lang === 'en'
          ? `[[EN_NATIVE]]⚠️ Invalid choice. Please reply with *1–${trackMenuNumber}* from the menu.`
          : `⚠️ Samahani, huduma hii haipatikani kwa sasa au imefungwa. Tafadhali chagua namba kati ya *1–${trackMenuNumber}* kwenye menu!`;
      }

      // Use NLP classifier for conversational selection!
      const { intent } = await classifyIntent(cleanInput);
      if (intent !== 'other' && intent !== 'greeting') {
        const matchedSrv = activeServices.find(srv => srv.key === intent);
        if (matchedSrv) {
          if (matchedSrv.isMaintenance) {
            return `⚠️ *MATENGENEZO / MAINTENANCE* ⚠️\n\n${matchedSrv.maintenanceMessage}`;
          }
          session.service = intent as any;
        } else {
          return `⚠️ Samahani, huduma ya ${intent.toUpperCase()} haipatikani kwa sasa.`;
        }
      } else {
        return lang === 'en'
          ? `[[EN_NATIVE]]⚠️ I didn't quite get that. Reply with a number (*1–${trackMenuNumber}*), a service name (e.g. *PapoFix*, *PapoMall*), or *Menu*.`
          : `⚠️ Samahani, sijaelewa ombi lako. Tafadhali chagua namba (*1–${trackMenuNumber}*), andika jina la huduma (mf. *PapoFix*, *PapoMall*, *PapoTicket*, *PapoPay*), au andika *Hi* kuanza upya.`;
      }
    }
    
    return await routeToServiceFlow(session, cleanInput, dbAdmin, channel, mediaCollector, {
      getKnownPhone,
      persistPhonePreference,
      persistLocationPreference
    });
  }

  // Allow seamless switching if user types an exact Papo* brand command mid-flow (e.g., "PapoTicket", "PapoPay", "PapoFix")
  const explicitBrandSwitchMap: Record<string, NonNullable<MetaSession['service']>> = {
    paporide: 'taxi',
    papofood: 'food',
    papomart: 'grocery',
    paposend: 'parcel',
    papomed: 'pharmacy',
    papostyle: 'salon',
    papofix: 'handyman',
    papostay: 'hotel',
    papoticket: 'events',
    papobus: 'bus_ticket',
    paporent: 'car_rental',
    papomall: 'ecommerce',
    papopay: 'papopay'
  };
  const requestedBrandService = explicitBrandSwitchMap[cleanedLower];
  if (session.service && requestedBrandService && requestedBrandService !== session.service) {
    const matchedBrandSrv = activeServices.find(srv => srv.key === requestedBrandService);
    if (matchedBrandSrv) {
      if (matchedBrandSrv.isMaintenance) {
        return `⚠️ *MATENGENEZO / MAINTENANCE* ⚠️\n\n${matchedBrandSrv.maintenanceMessage}`;
      }
      session.details = preserveCustomerFields(session.details, lang, customerProfile);
      session.service = requestedBrandService;
      session.step = 'COLLECTING_ROUTE';
      await saveMetaSession(session, dbAdmin);
      return await routeToServiceFlow(session, cleanInput, dbAdmin, channel, mediaCollector, {
        getKnownPhone,
        persistPhonePreference,
        persistLocationPreference
      });
    }
  }

  // Active Flow handling
  const activeSrv = activeServices.find(srv => srv.key === session.service);
  if (activeSrv && activeSrv.isMaintenance) {
    session.step = 'START';
    delete session.service;
    session.details = preserveCustomerFields(session.details, lang, customerProfile);
    await saveMetaSession(session, dbAdmin);
    return `⚠️ *MATENGENEZO / MAINTENANCE* ⚠️\n\n${activeSrv.maintenanceMessage}`;
  }

  return await routeToServiceFlow(session, cleanInput, dbAdmin, channel, mediaCollector, {
    getKnownPhone,
    persistPhonePreference,
    persistLocationPreference
  });
}

type VehicleBucket = 'bike' | 'bajaj' | 'mini';

interface LiveDriverAvailability {
  free: Record<VehicleBucket, number>;
  busy: Record<VehicleBucket, number>;
  totalOnline: number;
  totalFree: number;
  totalBusy: number;
}

function normalizeDriverVehicleBucket(rawType?: string): VehicleBucket {
  const v = String(rawType || '').toLowerCase();
  if (v.includes('bike') || v.includes('boda') || v.includes('piki') || v.includes('moto')) return 'bike';
  if (v.includes('bajaj') || v.includes('sharo') || v.includes('tri')) return 'bajaj';
  return 'mini';
}

async function getLiveDriverAvailability(dbAdmin: any): Promise<LiveDriverAvailability> {
  const result: LiveDriverAvailability = {
    free: { bike: 0, bajaj: 0, mini: 0 },
    busy: { bike: 0, bajaj: 0, mini: 0 },
    totalOnline: 0,
    totalFree: 0,
    totalBusy: 0
  };
  if (!dbAdmin) return result;

  try {
    const [driversSnap, activeRidesSnap, activeParcelsSnap] = await Promise.all([
      dbAdmin.collection('drivers').where('isOnline', '==', true).get(),
      dbAdmin
        .collection('rides')
        .where('status', 'in', ['accepted', 'driver_arriving', 'driver_arrived', 'on_trip'])
        .limit(50)
        .get()
        .catch(() => ({ docs: [] })),
      dbAdmin
        .collection('parcels')
        .where('status', 'in', ['accepted', 'picked_up', 'in_transit'])
        .limit(50)
        .get()
        .catch(() => ({ docs: [] }))
    ]);

    const busyDriverIds = new Set<string>();
    (activeRidesSnap?.docs || []).forEach((doc: any) => {
      const r = doc.data() || {};
      if (r.driverId) busyDriverIds.add(String(r.driverId));
    });
    (activeParcelsSnap?.docs || []).forEach((doc: any) => {
      const p = doc.data() || {};
      if (p.driverId) busyDriverIds.add(String(p.driverId));
      if (p.riderId) busyDriverIds.add(String(p.riderId));
    });

    const staleCutoffMs = Date.now() - 5 * 60 * 1000;
    (driversSnap?.docs || []).forEach((doc: any) => {
      const d = doc.data() || {};
      const lastActiveMs = normalizeEpochMs(d.lastActive) || normalizeEpochMs(d.updatedAt);
      if (lastActiveMs > 0 && lastActiveMs < staleCutoffMs) {
        return; // Stale heartbeat (> 5 min) => treat as offline
      }

      const bucket = normalizeDriverVehicleBucket(
        d.vehicleType || d.driverType || d.driverRegVehicle || d.selectedService
      );
      const isBusy =
        d.receiving === false ||
        String(d.status || '').toLowerCase() === 'busy' ||
        busyDriverIds.has(doc.id);

      result.totalOnline += 1;
      if (isBusy) {
        result.busy[bucket] += 1;
        result.totalBusy += 1;
      } else {
        result.free[bucket] += 1;
        result.totalFree += 1;
      }
    });
  } catch (err) {
    console.warn('[Meta Bot] Could not query live drivers availability:', err);
  }

  return result;
}

function formatDriverBucketBadge(avail: LiveDriverAvailability, bucket: VehicleBucket, lang: 'sw' | 'en' = 'sw'): string {
  const freeN = avail.free[bucket];
  const busyN = avail.busy[bucket];
  if (lang === 'en') {
    if (freeN > 0) return `🟢 ${freeN} ready`;
    if (busyN > 0) return `🟡 All busy`;
    return `🔴 Offline`;
  }
  if (freeN > 0) return `🟢 ${freeN} tayari`;
  if (busyN > 0) return `🟡 Wako busy`;
  return `🔴 Hawapo online`;
}

function formatVehicleChoiceMessage(
  pickupName: string,
  destName: string,
  avail: LiveDriverAvailability,
  lang: 'sw' | 'en' = 'sw'
): string {
  if (lang === 'en') {
    return (
      `🗺️ *${pickupName}* ➜ *${destName}*\n\n` +
      `Choose ride type:\n` +
      `1. 🏍️ *Boda Boda* _(${formatDriverBucketBadge(avail, 'bike', 'en')})_\n` +
      `2. 🛺 *Bajaji* _(${formatDriverBucketBadge(avail, 'bajaj', 'en')})_\n` +
      `3. 🚕 *Cab / Taxi* _(${formatDriverBucketBadge(avail, 'mini', 'en')})_`
    );
  }
  return (
    `🗺️ *${pickupName}* ➜ *${destName}*\n\n` +
    `Chagua usafiri:\n` +
    `1. 🏍️ *Boda Boda* _(${formatDriverBucketBadge(avail, 'bike', 'sw')})_\n` +
    `2. 🛺 *Bajaji* _(${formatDriverBucketBadge(avail, 'bajaj', 'sw')})_\n` +
    `3. 🚕 *Teksi* _(${formatDriverBucketBadge(avail, 'mini', 'sw')})_`
  );
}

/**
 * Route input to specific module flow states
 */
interface RouteFlowHelpers {
  getKnownPhone?: () => string;
  persistPhonePreference?: (phone: string) => Promise<void>;
  persistLocationPreference?: (loc: MetaSavedLocation) => Promise<void>;
}

async function routeToServiceFlow(
  session: MetaSession,
  input: string,
  dbAdmin: any,
  channel: 'whatsapp' | 'messenger' | 'instagram',
  mediaCollector?: MetaMediaAttachment[],
  helpers?: RouteFlowHelpers
): Promise<string> {
  const service = session.service;
  const cleaned = input.toUpperCase();
  const lang: 'sw' | 'en' = session.details?.lang === 'en' ? 'en' : 'sw';
  const isEn = lang === 'en';
  const waDigitsFallback = channel === 'whatsapp' ? session.senderId.replace(/\D/g, '') : '';
  const knownPhone =
    helpers?.getKnownPhone?.() ||
    (session.details?.phone && String(session.details.phone).replace(/\D/g, '').length >= 9
      ? String(session.details.phone).trim()
      : waDigitsFallback.length >= 9
      ? `+${waDigitsFallback}`
      : '');
  const savedLoc: MetaSavedLocation | undefined = session.details?.lastLocation;
  const savePhonePref = async (p: string) => {
    if (helpers?.persistPhonePreference) await helpers.persistPhonePreference(p);
    else if (p && p.replace(/\D/g, '').length >= 9) session.details.phone = p.trim();
  };
  const saveLocPref = async (loc: MetaSavedLocation) => {
    if (!loc?.name) return;
    if (helpers?.persistLocationPreference) await helpers.persistLocationPreference(loc);
    else session.details.lastLocation = loc;
  };

  // 1. TAXI FLOW
  if (service === 'taxi') {
    const cleanPlaceName = (raw: string) =>
      raw
        .replace(/^(naomba|nahitaji|nataka|omba|tuma|leta|agiza)\s+(usafiri|gari|teksi|taxi|boda|bajaji|usafirishaji)?\s*(wa|ya|la)?\s*/i, "")
        .replace(/^(kutoka|toka|from|hapa|nipo|niko|kwenda|kuelekea|hadi|mpaka|to)\s+/i, "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

    // Step A: Collect Pickup & Destination
    if (!session.details.route && session.step !== 'SELECTING_VEHICLE' && session.step !== 'CONFIRMING_TRIP' && session.step !== 'SELECTING_PAYMENT_METHOD' && session.step !== 'COLLECTING_PHONE') {
      if (!session.details.awaitingPickup && !session.details.awaitingDest && (cleaned === '1' || cleaned === 'TAXI' || cleaned === 'TEKSI' || cleaned === 'PAPORIDE' || input.trim().length < 3)) {
        session.details.awaitingPickup = true;
        session.step = 'COLLECTING_ROUTE';
        await saveMetaSession(session, dbAdmin);
        if (savedLoc?.name) {
          return isEn
            ? `[[EN_NATIVE]]🚖 *PapoRide — Pickup Location?*\n1. 📍 Use *${savedLoc.name}*\n_Or type another area / send 📍 Location pin:_`
            : `🚖 *PapoRide — Unatoka wapi?*\n1. 📍 Tumia *${savedLoc.name}*\n_Au andika eneo lingine / tuma 📍 Location:_`;
        }
        return isEn
          ? `[[EN_NATIVE]]🚖 *PapoRide — Pickup Location?*\nType your pickup area or send 📍 *Location pin*:`
          : `🚖 *PapoRide — Unatoka wapi?*\nAndika jina la eneo au tuma 📍 *Location*:`;
      }

      if (session.details.awaitingPickup && input.trim() === '1' && savedLoc?.name) {
        session.details.pickupName = savedLoc.name;
        session.details.pickupCoordsOverride = savedLoc;
        delete session.details.awaitingPickup;
        session.details.awaitingDest = true;
        session.step = 'COLLECTING_ROUTE';
        await saveMetaSession(session, dbAdmin);
        return isEn
          ? `[[EN_NATIVE]]📍 *Pickup:* ${savedLoc.name}\n\n*Where are you going?* _(Type destination or send 📍 Location)_:`
          : `📍 *Kutoka:* ${savedLoc.name}\n\n*Unaenda wapi?* _(Andika eneo au tuma 📍 Location)_:`;
      }

      if (session.details.awaitingDest && session.details.pickupName) {
        const destClean = cleanPlaceName(input);
        if (!destClean || destClean.length < 2) {
          return isEn
            ? `[[EN_NATIVE]]📍 *Pickup:* ${session.details.pickupName}\nEnter your *destination* (e.g. *Posta*, *Kariakoo*):`
            : `📍 *Kutoka:* ${session.details.pickupName}\nAndika eneo *unapokwenda* (mf. *Posta*, *Kariakoo*):`;
        }
        session.details.destinationName = destClean;
        delete session.details.awaitingDest;
        delete session.details.awaitingPickup;
        session.details.route = `${session.details.pickupName} - ${destClean}`;
        session.step = 'SELECTING_VEHICLE';
        await saveMetaSession(session, dbAdmin);
        const avail = await getLiveDriverAvailability(dbAdmin);
        const vMsg = formatVehicleChoiceMessage(session.details.pickupName, destClean, avail, lang);
        return isEn ? `[[EN_NATIVE]]${vMsg}` : vMsg;
      }

      // Smart natural language extraction of locations and vehicle
      const parsed = extractRideDetailsFromText(input);
      let pName = parsed.pickupName;
      let dName = parsed.destName;

      if (!pName || !dName) {
        const connectors = [" - ", "-", " KUTOKA ", " TOKA ", " KWENDA ", " HADI ", " KUELEKEA ", " TO ", " / ", "/"];
        for (const conn of connectors) {
          if (input.toUpperCase().includes(conn)) {
            const parts = input.split(new RegExp(conn, 'i'));
            if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
              pName = cleanPlaceName(parts[0]);
              dName = cleanPlaceName(parts[1]);
              break;
            }
          }
        }
      }

      if (pName && dName) {
        session.details.pickupName = pName;
        session.details.destinationName = dName;
        session.details.route = `${pName} - ${dName}`;
        delete session.details.awaitingPickup;
        delete session.details.awaitingDest;

        if (parsed.vehicleType && parsed.vehicleTypeName) {
          session.step = 'SELECTING_VEHICLE';
        } else {
          session.step = 'SELECTING_VEHICLE';
          await saveMetaSession(session, dbAdmin);
          const avail = await getLiveDriverAvailability(dbAdmin);
          const vMsg = formatVehicleChoiceMessage(pName, dName, avail, lang);
          return isEn ? `[[EN_NATIVE]]${vMsg}` : vMsg;
        }
      } else {
        const singlePlace = cleanPlaceName(input);
        if (!singlePlace || singlePlace.length < 2) {
          return isEn
            ? `[[EN_NATIVE]]📍 Type your *pickup* location or send 📍 *Location pin* (e.g. *Mikocheni*):`
            : `📍 Andika eneo *unapotoka* au tuma 📍 *Location* (mf. *Mikocheni*):`;
        }
        session.details.pickupName = singlePlace;
        delete session.details.awaitingPickup;
        session.details.awaitingDest = true;
        session.step = 'COLLECTING_ROUTE';
        await saveMetaSession(session, dbAdmin);
        return isEn
          ? `[[EN_NATIVE]]📍 *Pickup:* ${singlePlace}\n\n*Where are you going?* _(Type destination or send 📍 Location)_:`
          : `📍 *Kutoka:* ${singlePlace}\n\n*Unaenda wapi?* _(Andika eneo au tuma 📍 Location)_:`;
      }
    }

    if (session.step === 'SELECTING_VEHICLE') {
      let vehicleType: VehicleBucket = 'mini';
      let typeName = '';

      const vInput = cleaned.toLowerCase();
      if (vInput === '1' || vInput.includes('boda') || vInput.includes('bike') || vInput.includes('piki')) {
        vehicleType = 'bike';
        typeName = 'Boda Boda 🏍️';
      } else if (vInput === '2' || vInput.includes('bajaj') || vInput.includes('sharo')) {
        vehicleType = 'bajaj';
        typeName = 'Bajaji 🛺';
      } else if (vInput === '3' || vInput.includes('taxi') || vInput.includes('teksi') || vInput.includes('gari') || vInput.includes('mini') || vInput.includes('car') || vInput.includes('cab')) {
        vehicleType = 'mini';
        typeName = isEn ? 'Taxi Cab 🚕' : 'Teksi 🚕';
      } else {
        return isEn
          ? `[[EN_NATIVE]]⚠️ Choose *1–3*:\n1. 🏍️ Boda Boda\n2. 🛺 Bajaji\n3. 🚕 Taxi Cab`
          : `⚠️ Chagua namba *1–3*:\n1. 🏍️ Boda Boda\n2. 🛺 Bajaji\n3. 🚕 Teksi`;
      }

      const pickupName = session.details.pickupName || "Mwenge";
      const destName = session.details.destinationName || "Posta";

      session.details.pickupName = pickupName;
      session.details.destinationName = destName;

      const cleanPickupName = pickupName.replace(/\s*\(.*?\)/g, "").trim() || "Mwenge";
      const cleanDestName = destName.replace(/\s*\(.*?\)/g, "").trim() || "Posta";

      let pLoc = session.details.pickupCoordsOverride;
      if (!pLoc) {
        const pRes = await resolvePlace(cleanPickupName, dbAdmin);
        pLoc = pRes.matches.length > 0 ? {
          placeId: pRes.matches[0].placeId,
          name: pRes.matches[0].name,
          address: pRes.matches[0].displayName || pRes.matches[0].name,
          lat: pRes.matches[0].latitude,
          lng: pRes.matches[0].longitude
        } : {
          placeId: "TZ-DSM-CUSTOM-PICKUP",
          name: cleanPickupName,
          address: `${cleanPickupName}, Dar es Salaam`,
          lat: -6.7681,
          lng: 39.2274
        };
      }

      let dLoc = session.details.destCoordsOverride;
      if (!dLoc) {
        const dRes = await resolvePlace(cleanDestName, dbAdmin);
        dLoc = dRes.matches.length > 0 ? {
          placeId: dRes.matches[0].placeId,
          name: dRes.matches[0].name,
          address: dRes.matches[0].displayName || dRes.matches[0].name,
          lat: dRes.matches[0].latitude,
          lng: dRes.matches[0].longitude
        } : {
          placeId: "TZ-DSM-CUSTOM-DEST",
          name: cleanDestName,
          address: `${cleanDestName}, Dar es Salaam`,
          lat: -6.8164,
          lng: 39.2902
        };
      }

      const routeInfo = await getRoadDistanceAndDuration(pLoc, dLoc);
      const distanceKm = routeInfo.distanceKm;
      const durationMin = routeInfo.durationMin;

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
      fare = Math.round(fare / 500) * 500;

      // Real-time driver status check (NEVER simulated!)
      const avail = await getLiveDriverAvailability(dbAdmin);
      const freeCount = avail.free[vehicleType];
      const busyCount = avail.busy[vehicleType];
      const availabilityState: 'available' | 'busy' | 'offline' =
        freeCount > 0 ? 'available' : busyCount > 0 ? 'busy' : 'offline';

      const labels: Record<VehicleBucket, string> = isEn
        ? { bike: 'Boda Boda', bajaj: 'Bajaji', mini: 'Taxi' }
        : { bike: 'Boda Boda', bajaj: 'Bajaji', mini: 'Teksi' };
      const altFreeList = (['bike', 'bajaj', 'mini'] as VehicleBucket[])
        .filter((b) => b !== vehicleType && avail.free[b] > 0)
        .map((b) => `${labels[b]} (${avail.free[b]})`);
      const altBusyList = (['bike', 'bajaj', 'mini'] as VehicleBucket[])
        .filter((b) => b !== vehicleType && avail.busy[b] > 0)
        .map((b) => `${labels[b]} (${avail.busy[b]})`);

      session.details.vehicleType = vehicleType;
      session.details.vehicleTypeName = typeName;
      session.details.calculatedDistance = distanceKm;
      session.details.calculatedDuration = durationMin;
      session.details.calculatedFare = fare;
      session.details.pickupCoords = pLoc;
      session.details.destinationCoords = dLoc;
      session.details.pickupName = pLoc.name;
      session.details.destinationName = dLoc.name;
      session.details.nearbyCount = freeCount;
      session.details.busyCount = busyCount;
      session.details.availabilityState = availabilityState;

      session.step = 'CONFIRMING_TRIP';
      await saveMetaSession(session, dbAdmin);

      if (isEn) {
        let statusLineEn = '';
        if (availabilityState === 'available') {
          statusLineEn = `🟢 *${freeCount}* driver${freeCount > 1 ? 's' : ''} ready nearby`;
        } else if (availabilityState === 'busy') {
          statusLineEn = `🟡 *${busyCount}* *${labels[vehicleType]}* driver${busyCount > 1 ? 's' : ''} are currently *busy* on trips.`;
        } else {
          statusLineEn = `🔴 No *${labels[vehicleType]}* drivers are *Online* right now.`;
        }

        let respEn = `[[EN_NATIVE]]🧾 *${pLoc.name}* ➜ *${dLoc.name}*\n` +
          `• *${typeName}* • *${distanceKm} km* (~${durationMin} min)\n` +
          `• Fare: *TZS ${fare.toLocaleString()}*\n` +
          `• Status: ${statusLineEn}`;

        if (availabilityState !== 'available') {
          if (altFreeList.length > 0) {
            respEn += `\n💡 Available now: *${altFreeList.join(', ')}*`;
          } else if (availabilityState === 'offline' && altBusyList.length > 0) {
            respEn += `\n🟡 Busy on trips: *${altBusyList.join(', ')}*`;
          }
          respEn += `\n\n1. 🔄 *Change Ride Type*\n2. ⏳ *Request Anyway (Wait)*\n3. ❌ *Cancel*`;
        } else {
          respEn += `\n\n1. ✅ *Find Driver*\n2. ❌ *Cancel*`;
        }
        return respEn;
      }

      let statusLine = '';
      if (availabilityState === 'available') {
        statusLine = `🟢 Madereva *${freeCount}* wapo tayari karibu`;
      } else if (availabilityState === 'busy') {
        statusLine = `🟡 Madereva *${busyCount}* wa *${labels[vehicleType]}* wako *busy* safarini sasa.`;
      } else {
        statusLine = `🔴 Hakuna dereva wa *${labels[vehicleType]}* aliye *Online* kwa sasa.`;
      }

      let resp = `🧾 *${pLoc.name}* ➜ *${dLoc.name}*\n` +
        `• *${typeName}* • *${distanceKm} km* (~${durationMin} dk)\n` +
        `• Nauli: *TZS ${fare.toLocaleString()}*\n` +
        `• Hali: ${statusLine}`;

      if (availabilityState !== 'available') {
        if (altFreeList.length > 0) {
          resp += `\n💡 Wapo tayari sasa: *${altFreeList.join(', ')}*`;
        } else if (availabilityState === 'offline' && altBusyList.length > 0) {
          resp += `\n🟡 Wako busy: *${altBusyList.join(', ')}*`;
        }
        resp += `\n\n1. 🔄 *Badili Usafiri*\n2. ⏳ *Tuma Ombi (Subiri Dereva)*\n3. ❌ *Ghairi*`;
      } else {
        resp += `\n\n1. ✅ *Tafuta Dereva*\n2. ❌ *Ghairi*`;
      }
      return resp;
    }

    if (session.step === 'CONFIRMING_TRIP') {
      const availState = session.details.availabilityState || 'available';

      if (availState !== 'available') {
        if (cleaned === '1' || cleaned.includes('badili') || cleaned.includes('change')) {
          session.step = 'SELECTING_VEHICLE';
          await saveMetaSession(session, dbAdmin);
          const avail = await getLiveDriverAvailability(dbAdmin);
          const vMsg = formatVehicleChoiceMessage(
            session.details.pickupName || (isEn ? 'Pickup' : 'Hapa'),
            session.details.destinationName || (isEn ? 'Destination' : 'Unapoenda'),
            avail,
            lang
          );
          return isEn ? `[[EN_NATIVE]]${vMsg}` : vMsg;
        } else if (cleaned === '2' || cleaned.includes('tuma') || cleaned.includes('subiri') || cleaned.includes('ndio') || cleaned.includes('tafuta') || cleaned.includes('request') || cleaned.includes('wait')) {
          session.step = 'SELECTING_PAYMENT_METHOD';
          await saveMetaSession(session, dbAdmin);
          const fare = session.details.calculatedFare || 0;
          return isEn
            ? `[[EN_NATIVE]]💳 *Payment — TZS ${fare.toLocaleString()}*\n1. 💵 Cash\n2. 📱 M-Pesa\n3. 📱 Tigo Pesa\n4. 📱 Airtel Money`
            : `💳 *Malipo — TZS ${fare.toLocaleString()}*\n1. 💵 Cash\n2. 📱 M-Pesa\n3. 📱 Tigo Pesa\n4. 📱 Airtel Money`;
        } else if (cleaned === '3' || cleaned.includes('hapana') || cleaned.includes('ghairi') || cleaned.includes('cancel')) {
          session.step = 'COLLECTING_ROUTE';
          delete session.service;
          session.details = preserveCustomerFields(session.details, lang);
          await saveMetaSession(session, dbAdmin);
          return isEn
            ? `[[EN_NATIVE]]❌ Ride cancelled. Reply *Menu* anytime.`
            : `❌ Safari imeghairiwa. Andika *Menu* kuendelea.`;
        } else {
          return isEn
            ? `[[EN_NATIVE]]⚠️ Reply *1* (Change Ride), *2* (Request Anyway) or *3* (Cancel).`
            : `⚠️ Chagua *1* (Badili Usafiri), *2* (Tuma Ombi Subiri) au *3* (Ghairi).`;
        }
      }

      if (cleaned === '1' || cleaned.includes('ndio') || cleaned.includes('tafuta') || cleaned.includes('kubali') || cleaned.includes('yes') || cleaned.includes('find')) {
        session.step = 'SELECTING_PAYMENT_METHOD';
        await saveMetaSession(session, dbAdmin);
        const fare = session.details.calculatedFare || 0;
        return isEn
          ? `[[EN_NATIVE]]💳 *Payment — TZS ${fare.toLocaleString()}*\n1. 💵 Cash\n2. 📱 M-Pesa\n3. 📱 Tigo Pesa\n4. 📱 Airtel Money`
          : `💳 *Malipo — TZS ${fare.toLocaleString()}*\n1. 💵 Cash\n2. 📱 M-Pesa\n3. 📱 Tigo Pesa\n4. 📱 Airtel Money`;
      } else if (cleaned === '2' || cleaned.includes('hapana') || cleaned.includes('ghairi') || cleaned.includes('no') || cleaned.includes('cancel')) {
        session.step = 'COLLECTING_ROUTE';
        delete session.service;
        session.details = preserveCustomerFields(session.details, lang);
        await saveMetaSession(session, dbAdmin);
        return isEn
          ? `[[EN_NATIVE]]❌ Ride cancelled. Reply *Menu* anytime.`
          : `❌ Safari imeghairiwa. Andika *Menu* kuendelea.`;
      } else {
        return isEn
          ? `[[EN_NATIVE]]⚠️ Reply *1* (Find Driver) or *2* (Cancel).`
          : `⚠️ Chagua *1* (Tafuta Dereva) au *2* (Ghairi).`;
      }
    }

    const finalizeTaxiOrder = async (phoneNum: string): Promise<string> => {
      await savePhonePref(phoneNum);
      const customerName = session.details.customerName || "Mteja wa WhatsApp";
      const pickupName = session.details.pickupName || "Mwenge";
      const destName = session.details.destinationName || "Posta";
      const pLoc = session.details.pickupCoords;
      const dLoc = session.details.destinationCoords;
      const vehicleType = session.details.vehicleType;
      const typeName = session.details.vehicleTypeName;
      const fare = session.details.calculatedFare;
      const distanceKm = session.details.calculatedDistance;
      const durationMin = session.details.calculatedDuration;
      const paymentMethod = session.details.paymentMethod || 'cash';
      const paymentMethodLabel = session.details.paymentMethodLabel || 'Cash 💵';
      const availState = session.details.availabilityState || 'available';

      if (pLoc?.name) await saveLocPref(pLoc);

      session.step = 'COLLECTING_ROUTE';
      delete session.service;
      session.details = preserveCustomerFields(session.details, lang);
      session.details.phone = phoneNum;
      await saveMetaSession(session, dbAdmin);

      const randId = Math.floor(100000 + Math.random() * 900000);
      const bookingCode = `PH-${randId}`;
      let createdRideId = bookingCode;
      if (dbAdmin) {
        try {
          const expiresAtDate = new Date();
          expiresAtDate.setMinutes(expiresAtDate.getMinutes() + 15);

          const rideRef = await dbAdmin.collection('rides').add({
            status: "pending",
            customerId: `meta-client-${session.senderId}`,
            metaSenderId: session.senderId,
            metaChannel: session.channel,
            customerInfo: {
              name: customerName,
              phone: phoneNum,
              rating: 4.8
            },
            driverId: null,
            pickup: pLoc,
            destination: dLoc,
            vehicleType: vehicleType,
            fare: fare,
            paymentMethod: paymentMethod,
            paymentMethodLabel: paymentMethodLabel,
            distance: distanceKm,
            duration: durationMin,
            routeCoords: [
              { lat: pLoc.lat, lng: pLoc.lng },
              { lat: dLoc.lat, lng: dLoc.lng }
            ],
            createdAt: new Date(),
            expiresAt: expiresAtDate.toISOString(),
            driverInfo: null,
            driverLocation: null,
            channel: session.channel,
            bookingId: bookingCode
          });
          if (rideRef?.id) {
            createdRideId = rideRef.id;
          }
        } catch (e) {
          console.warn("Could not insert ride request from Meta", e);
        }
      }

      const publicBaseUrl = (process.env.APP_PUBLIC_URL || 'https://dereva-tz.onrender.com').replace(/\/+$/, '');
      const trackingUrl = `${publicBaseUrl}/track/${createdRideId}`;

      if (isEn) {
        const statusNoteEn =
          availState === 'busy'
            ? `🟡 Drivers are currently *busy* — your request is queued and you'll be notified here as soon as one finishes.`
            : availState === 'offline'
            ? `🔴 No drivers are *Online* right now — your request is saved for when a driver comes online.`
            : `📡 Nearby drivers have been notified — you'll get an update here once accepted.`;

        return `[[EN_NATIVE]]✅ *PapoRide Request Sent!*\n` +
               `🔖 *${bookingCode}* • *${typeName}*\n` +
               `📍 *${pickupName}* ➜ *${destName}*\n` +
               `📏 *${distanceKm} km* (~${durationMin} min) • *TZS ${fare?.toLocaleString()}*\n` +
               `💳 ${paymentMethodLabel} • 📞 ${phoneNum}\n\n` +
               `${statusNoteEn}\n\n` +
               `🗺️ Live Map: ${trackingUrl}\n` +
               `📋 My Orders: ${buildOrdersTrackingUrl(phoneNum, bookingCode)}\n\n` +
               `_Reply *Menu* or *My Orders* anytime._`;
      }

      const statusNote =
        availState === 'busy'
          ? `🟡 Madereva wako *busy* sasa — ombi lipo kwenye foleni, utapokea taarifa hapa mmoja akimaliza safari.`
          : availState === 'offline'
          ? `🔴 Hakuna dereva aliye *Online* kwa sasa — ombi limehifadhiwa, dereva akiingia hewani ataliona.`
          : `📡 Madereva wamejulishwa — utapata taarifa hapa hapa dereva akishakubali.`;

      return `✅ *Oda ya PapoRide Imetumwa!*\n` +
             `🔖 *${bookingCode}* • *${typeName}*\n` +
             `📍 *${pickupName}* ➜ *${destName}*\n` +
             `📏 *${distanceKm} km* (~${durationMin} dk) • *TZS ${fare?.toLocaleString()}*\n` +
             `💳 ${paymentMethodLabel} • 📞 ${phoneNum}\n\n` +
             `${statusNote}\n\n` +
             `🗺️ Ramani: ${trackingUrl}\n` +
             `📋 Oda zako: ${buildOrdersTrackingUrl(phoneNum, bookingCode)}\n\n` +
             `_Andika *Menu* au *Oda zangu* muda wowote._`;
    };

    if (session.step === 'SELECTING_PAYMENT_METHOD') {
      const pLower = cleaned.toLowerCase();
      let paymentMethod = '';
      let paymentMethodLabel = '';

      if (pLower === '1' || pLower.includes('cash') || pLower.includes('taslimu') || pLower.includes('pesa mkononi')) {
        paymentMethod = 'cash';
        paymentMethodLabel = 'Cash 💵';
      } else if (pLower === '2' || pLower.includes('mpesa') || pLower.includes('m-pesa') || pLower.includes('voda')) {
        paymentMethod = 'mpesa';
        paymentMethodLabel = 'M-Pesa 📱';
      } else if (pLower === '3' || pLower.includes('tigo') || pLower.includes('yas') || pLower.includes('mixx')) {
        paymentMethod = 'tigopesa';
        paymentMethodLabel = 'Tigo Pesa 📱';
      } else if (pLower === '4' || pLower.includes('airtel')) {
        paymentMethod = 'airtelmoney';
        paymentMethodLabel = 'Airtel Money 📱';
      } else {
        return isEn
          ? `[[EN_NATIVE]]⚠️ Choose *1–4*:\n1. 💵 Cash\n2. 📱 M-Pesa\n3. 📱 Tigo Pesa\n4. 📱 Airtel Money`
          : `⚠️ Chagua *1–4*:\n1. 💵 Cash\n2. 📱 M-Pesa\n3. 📱 Tigo Pesa\n4. 📱 Airtel Money`;
      }

      session.details.paymentMethod = paymentMethod;
      session.details.paymentMethodLabel = paymentMethodLabel;

      if (knownPhone) {
        return await finalizeTaxiOrder(knownPhone);
      }

      session.step = 'COLLECTING_PHONE';
      await saveMetaSession(session, dbAdmin);

      return isEn
        ? `[[EN_NATIVE]]📞 Enter your phone number (e.g. *0712345678*):`
        : `📞 Andika namba yako ya simu (mf. *0712345678*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      const phoneNum = input.trim();
      const digitsOnly = phoneNum.replace(/\D/g, '');
      if (digitsOnly.length < 9) {
        return isEn
          ? `[[EN_NATIVE]]⚠️ Enter a valid phone number (e.g. *0712345678*):`
          : `⚠️ Weka namba sahihi ya simu (mf. *0712345678*):`;
      }
      return await finalizeTaxiOrder(phoneNum);
    }
  }

  // 2. BUS TICKET FLOW (PAPOBUS)
  if (service === 'bus_ticket') {
    const isMenuPick = /^\d{1,2}$/.test(input.trim()) || /^(papobus|mabasi|basi|tiketi|ticket)$/i.test(input.trim());
    if (!session.details.route) {
      if (isMenuPick) {
        await saveMetaSession(session, dbAdmin);
        return `🚌 *PapoBus — Tiketi za Mabasi ya Mikoani*\n\nUnaenda wapi leo? Tafadhali andika njia yako (Mfano: *Dar kwenda Arusha*, *Mwanza - Dar*, au *Dar kwenda Dodoma*):`;
      }
      session.details.route = cleaned;
      session.step = 'SELECTING_OPTION';

      const operators = [
        { id: 'op-m1', name: 'Shabiby Line (Luxury VIP)', price: 45000 },
        { id: 'op-m2', name: 'Katarama Express (Business Class)', price: 42000 },
        { id: 'op-m3', name: 'Abood Bus (Semi-Luxury)', price: 38000 }
      ];
      session.details.optionsList = operators;
      await saveMetaSession(session, dbAdmin);

      let resp = `🚌 *PapoBus — Tiketi za Mabasi*:\n\n`;
      resp += `Route: *${cleaned}*\n`;
      resp += `Mabasi yanayotoka leo:\n\n`;
      operators.forEach((op, idx) => {
        resp += `*${idx + 1}. ${op.name}*\n💰 Bei: *TSH ${op.price.toLocaleString()}*\n\n`;
      });
      resp += `Andika namba ya basi unayotaka kukata tiketi sasa:`;
      return resp;
    }

    const finalizeBusOrder = async (phoneNum: string): Promise<string> => {
      await savePhonePref(phoneNum);
      const busRoute = session.details.route || 'Dar - Arusha';
      const busName = session.details.selectedName || 'Bus Express';
      const busPrice = session.details.selectedPrice || 45000;
      const busVendorId = session.details.selectedId || 'bus-op';
      const busCustomer = session.details.customerName || 'Meta Bus Client';
      const busCode = `BS-${Math.floor(1000 + Math.random() * 9000)}`;

      session.step = 'START';
      delete session.service;
      session.details = preserveCustomerFields(session.details, lang);
      session.details.phone = phoneNum;
      await saveMetaSession(session, dbAdmin);

      await triggerAutomatedOrder(
        dbAdmin,
        busVendorId,
        "bus_ticket",
        [{ name: `Bus Seat A5 (${busRoute})`, price: busPrice, quantity: 1 }],
        busPrice,
        phoneNum,
        busCustomer,
        `Automatic bus booking #${busCode} for ${busRoute} via ${session.channel}`,
        session.channel,
        { bookingCode: busCode }
      );

      return `🎉 *Tiketi Imesajiliwa Kikamilifu!* 🚌\n` +
             `🔖 Namba ya Tiketi: *#${busCode}*\n\n` +
             `- Safari: *${busRoute}*\n` +
             `- Basi: *${busName}*\n` +
             `- Kiti: *A5 (Dirishani)*\n` +
             `- Nauli: *TSH ${busPrice.toLocaleString()}*\n\n` +
             `🔗 *Fuatilia tiketi & oda zako zote:*\n${buildOrdersTrackingUrl(phoneNum, busCode)}\n\n` +
             `Tumekutumia ujumbe wa muamala wa malipo kwenye simu yako *${phoneNum}*. Ukishalipia, tiketi yako kamili na namba ya siti vitatumwa punde. Ahsante sana! 🌟`;
    };

    if (session.step === 'SELECTING_OPTION') {
      const idx = parseInt(input) - 1;
      const selected = session.details.optionsList?.[idx];
      if (!selected) {
        return `⚠️ Namba si sahihi. Tafadhali andika *1*, *2*, au *3* kuchagua Basi.`;
      }

      session.details.selectedId = selected.id;
      session.details.selectedName = selected.name;
      session.details.selectedPrice = selected.price;
      if (knownPhone) {
        return await finalizeBusOrder(knownPhone);
      }
      session.step = 'COLLECTING_PHONE';
      await saveMetaSession(session, dbAdmin);

      return `💺 Umefanya chaguo zuri. Sasa weka namba yako ya kulipia (Mobile money) ili tukutumie muamala (Push Prompt) wa kukata tiketi hii (Mfano: *07XXXXXXXX*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      if (input.replace(/\D/g, '').length < 9) {
        return `⚠️ Weka namba sahihi ya simu (mf. *0712345678*):`;
      }
      return await finalizeBusOrder(input.trim());
    }
  }

  // 3. FOOD & TABLE/SEAT BOOKING FLOW
  if (service === 'food') {
    const trimmed = input.trim();
    const lower = trimmed.toLowerCase();
    const publicBaseUrl = (process.env.APP_PUBLIC_URL || 'https://dereva-tz.onrender.com').replace(/\/+$/, '');

    // Helper to render numbered restaurant list (with photos!)
    const promptRestaurantList = async (modeLabel: string, queryHint?: string) => {
      const gpsFilter =
        savedLoc?.lat && savedLoc?.lng ? { lat: savedLoc.lat, lng: savedLoc.lng } : undefined;
      const restaurants = await fetchRestaurantsForMeta(dbAdmin, gpsFilter);
      session.details.restaurantOptions = restaurants;
      if (queryHint) session.details.itemQuery = queryHint;
      session.step = 'FOOD_SELECT_VENDOR';
      await saveMetaSession(session, dbAdmin);

      appendMediaItems(
        mediaCollector,
        restaurants.map((r, idx) => ({
          url: r.imageUrl,
          caption: `*${idx + 1}. ${r.name}*\n📍 ${r.address}`
        }))
      );

      let resp = `${modeLabel}\n\n${gpsFilter && savedLoc?.name ? `📍 Migahawa ya karibu na *${savedLoc.name}*:` : 'Chagua mgahawa unaotaka:'}\n\n`;
      restaurants.forEach((r, idx) => {
        const distPart = typeof r.distanceKm === 'number' ? ` • ~${r.distanceKm} km` : '';
        const tblPart = r.openTablesCount ? ` • 🪑 Meza ${r.openTablesCount} wazi` : '';
        resp += `*${idx + 1}. ${r.name}*\n📍 ${r.address}${distPart}${tblPart}\n\n`;
      });
      resp += `Andika namba ya mgahawa (*1–${restaurants.length}*) au tuma *📍 GPS Location* kupata wa karibu:`;
      return resp;
    };

    const promptFoodDeliveryAddress = async (): Promise<string> => {
      session.step = 'FOOD_DELIVERY_ADDRESS';
      await saveMetaSession(session, dbAdmin);
      if (savedLoc?.name) {
        return `📍 *Eneo la kuletewa chakula?*\n1. 📍 Tumia *${savedLoc.name}*\n_Au andika mtaa mwingine / tuma 📍 Location yako:_`;
      }
      return `📍 Tafadhali andika *eneo/mtaa wa kuletewa chakula* (au tuma *📍 Location yako ya GPS* kwa kubofya 📎 → Location):`;
    };

    const finalizeFoodOrTable = async (phoneNum: string): Promise<string> => {
      await savePhonePref(phoneNum);
      const customerName = session.details.customerName || 'Mteja wa WhatsApp';
      const vendorId = session.details.selectedVendorId || 'papo-hapo-kitchen';
      const vendorName = session.details.selectedVendorName || 'Papo Hapo Kitchen';
      const vendorAddress = session.details.selectedVendorAddress || 'Dar es Salaam';
      const foodMode = session.details.foodMode || 'delivery';
      const cart: any[] = session.details.foodCart || [];
      const total = cart.reduce((s, it) => s + (it.price || 0) * (it.quantity || 1), 0);
      const paymentMethod = session.details.paymentMethod || 'cash';
      const paymentMethodLabel = session.details.paymentMethodLabel || 'Cash 💵';
      const deliveryAddress = session.details.deliveryAddress || '';
      const seatsCount = session.details.seatsCount || 2;
      const scheduledTime = session.details.scheduledTime || 'Leo';
      const preferredTableId = session.details.preferredTableId;
      const preferredTableNumber = session.details.preferredTableNumber;

      // Reset session cleanly while preserving customer identity, saved location & language
      session.step = 'COLLECTING_ROUTE';
      delete session.service;
      session.details = preserveCustomerFields(session.details, lang);
      session.details.phone = phoneNum;
      await saveMetaSession(session, dbAdmin);

      if (foodMode === 'table_booking') {
        const booking = await createTableReservationRecord(dbAdmin, {
          vendorId,
          vendorName,
          vendorAddress,
          customerName,
          customerPhone: phoneNum,
          seatsCount,
          scheduledTime,
          preferredTableId,
          preferredTableNumber,
          preOrderItems: cart,
          paymentMethod,
          paymentMethodLabel,
          channel: session.channel
        });

        const preOrderText =
          cart.length > 0
            ? `\n🍽️ *Chakula cha Mapema (Pre-Order):*\n${cart.map((c) => `• ${c.name} x${c.quantity} (TZS ${(c.price * c.quantity).toLocaleString()})`).join('\n')}\n💰 *Jumla ya Pre-Order: TZS ${total.toLocaleString()}/=*`
            : `\n🍽️ *Chakula:* Utaagiza ukifika mgahawani`;

        return `🎉 *MEZA IMEHIFADHIWA KIKAMILIFU!* 🪑✨\n` +
               `🔖 Namba ya Booking: *#${booking.bookingCode}*\n` +
               `🏠 Mgahawa: *${vendorName}*\n` +
               `📍 Eneo: *${vendorAddress}*\n` +
               `🪑 Meza: *#${booking.tableNumber}* (Viti *${seatsCount}*)\n` +
               `🕒 Muda wa Kufika: *${scheduledTime}*` +
               preOrderText + `\n` +
               `💳 Malipo: *${paymentMethodLabel}*\n` +
               `📞 Simu: *${phoneNum}*\n\n` +
               `🔗 *Fuatilia booking hii & oda zako zote:*\n${buildOrdersTrackingUrl(phoneNum, booking.bookingCode)}\n` +
               `🍽️ *Menyu ya mgahawa:* ${publicBaseUrl}/vendor/${vendorId}\n\n` +
               `Meza yako tayari imeoneshwa kama *RESERVED* kwenye mfumo wa mgahawa. Karibu sana! 🙏`;
      }

      // Delivery or Takeaway Order
      const orderType = foodMode === 'takeaway' ? 'pickup' : 'delivery';
      const randCode = `FD-${Math.floor(1000 + Math.random() * 9000)}`;
      await triggerAutomatedOrder(
        dbAdmin,
        vendorId,
        'restaurant',
        cart,
        total,
        phoneNum,
        customerName,
        foodMode === 'takeaway'
          ? `Takeaway Pickup #${randCode} via ${session.channel}`
          : `Delivery #${randCode} to: ${deliveryAddress}`,
        session.channel,
        {
          orderType,
          bookingCode: randCode,
          vendorName,
          deliveryAddress: foodMode === 'takeaway' ? 'Pickup Mgahawani' : deliveryAddress,
          paymentMethod,
          paymentMethodLabel
        }
      );

      const itemsSummary = cart.map((c) => `• ${c.name} x${c.quantity} — TZS ${(c.price * c.quantity).toLocaleString()}`).join('\n');
      return `🎉 *ODA YA CHAKULA IMEPOKELEWA!* ${foodMode === 'takeaway' ? '🥡' : '🍔🛵'}\n` +
             `🔖 Namba ya Oda: *#${randCode}*\n` +
             `🏠 Mgahawa: *${vendorName}*\n\n` +
             `${itemsSummary}\n\n` +
             `💰 *Jumla ya Kulipa: TZS ${total.toLocaleString()}/=*\n` +
             `💳 Malipo: *${paymentMethodLabel}*\n` +
             `${foodMode === 'takeaway' ? '🥡 *Aina:* Utachukua mwenyewe mgahawani' : `📍 *Eneo la Kuletewa:* ${deliveryAddress}`}\n` +
             `📞 Simu: *${phoneNum}*\n\n` +
             `🔗 *Fuatilia oda hii & oda zako zote:*\n${buildOrdersTrackingUrl(phoneNum, randCode)}\n` +
             `🍽️ *Agiza tena:* ${publicBaseUrl}/vendor/${vendorId}\n\n` +
             `Jiko limeanza kuandaa oda yako sasa hivi! Ahsante kwa kutumia *Papo Hapo* 🙏✨`;
    };

    // Helper to render restaurant menu items (with food photos!)
    const promptMenuList = async (vendorId: string, vendorName: string, queryHint?: string) => {
      const menu = await fetchRestaurantMenu(dbAdmin, vendorId, queryHint);
      session.details.foodMenu = menu;
      session.step = 'FOOD_SELECT_ITEM';
      await saveMetaSession(session, dbAdmin);

      appendMediaItems(
        mediaCollector,
        menu.map((item, idx) => ({
          url: item.imageUrl,
          caption: `*${idx + 1}. ${item.name}* — *TZS ${item.price.toLocaleString()}/=*${item.description ? `\n${item.description}` : ''}`
        }))
      );

      const currentCart = session.details.foodCart || [];
      let resp = `🍽️ *MENYU YA ${vendorName.toUpperCase()}*\n\n`;
      menu.forEach((item, idx) => {
        resp += `*${idx + 1}. ${item.name}* — *TZS ${item.price.toLocaleString()}/=*\n`;
      });
      if (currentCart.length > 0) {
        const sub = currentCart.reduce((s: number, it: any) => s + (it.price || 0) * (it.quantity || 1), 0);
        resp += `\n🧺 Kwenye kikapu: *${currentCart.length} vitu* (*TZS ${sub.toLocaleString()}/=*)\n`;
        resp += `\nAndika namba ya chakula kuongeza, au *0* kuendelea kukamilisha:`;
      } else {
        resp += `\nAndika namba ya chakula unachotaka (*1–${menu.length}*):`;
      }
      return resp;
    };

    // Initial entry into Food service
    const isInFoodSubStep = [
      'FOOD_CHOOSE_MODE',
      'FOOD_SELECT_VENDOR',
      'FOOD_SELECT_ITEM',
      'FOOD_ITEM_QUANTITY',
      'FOOD_CART_DECISION',
      'FOOD_DELIVERY_ADDRESS',
      'TABLE_SELECT_SEATS',
      'TABLE_SELECT_TIME',
      'TABLE_ASK_PREORDER',
      'SELECTING_PAYMENT_METHOD',
      'COLLECTING_PHONE'
    ].includes(session.step);

    if (!isInFoodSubStep) {
      session.details.foodCart = [];
      // Direct shortcut if user explicitly mentioned table/seat booking
      if (/\b(meza|kiti|viti|table|reserve|dine|booking meza|book meza)\b/i.test(lower)) {
        session.details.foodMode = 'table_booking';
        return await promptRestaurantList('🪑 *WEKA MEZA / VITI MGAHAWANI (Table Booking)*');
      }

      // Direct shortcut if user named a dish like "naomba chips kuku"
      if (trimmed.length > 3 && lower !== '2' && lower !== 'chakula' && lower !== 'food') {
        session.details.itemQuery = trimmed;
      }

      session.step = 'FOOD_CHOOSE_MODE';
      await saveMetaSession(session, dbAdmin);
      return `🍔 *PAPO HAPO CHAKULA & MIGAHAWA*\n\nUngependa huduma ipi leo?\n\n` +
             `1. 🛵 *Niletewe Chakula (Delivery)*\n` +
             `2. 🥡 *Nitachukua Mwenyewe (Takeaway)*\n` +
             `3. 🪑 *Weka Meza / Viti Mgahawani (Book Table)*`;
    }

    // Step 1: Choose Mode (Delivery, Takeaway, or Table Booking)
    if (session.step === 'FOOD_CHOOSE_MODE') {
      if (lower === '1' || lower.includes('delivery') || lower.includes('letew') || lower.includes('nyumbani')) {
        session.details.foodMode = 'delivery';
        return await promptRestaurantList('🛵 *AGIZA CHAKULA (DELIVERY)*', session.details.itemQuery);
      } else if (lower === '2' || lower.includes('takeaway') || lower.includes('chukua') || lower.includes('pickup')) {
        session.details.foodMode = 'takeaway';
        return await promptRestaurantList('🥡 *AGIZA & CHUKUA MWENYEWE (TAKEAWAY)*', session.details.itemQuery);
      } else if (lower === '3' || lower.includes('meza') || lower.includes('kiti') || lower.includes('viti') || lower.includes('table') || lower.includes('book')) {
        session.details.foodMode = 'table_booking';
        return await promptRestaurantList('🪑 *WEKA MEZA / VITI MGAHAWANI (Table Booking)*');
      } else {
        return `⚠️ Chaguo si sahihi. Tafadhali andika:\n*1.* Niletewe Chakula (Delivery)\n*2.* Nitachukua Mwenyewe (Takeaway)\n*3.* Weka Meza / Viti Mgahawani`;
      }
    }

    // Step 2: Select Restaurant
    if (session.step === 'FOOD_SELECT_VENDOR') {
      const options: MetaRestaurantOption[] = session.details.restaurantOptions || [];
      let chosen: MetaRestaurantOption | undefined;
      const idx = parseInt(trimmed, 10) - 1;
      if (!isNaN(idx) && options[idx]) {
        chosen = options[idx];
      } else {
        chosen = options.find((r) => r.name.toLowerCase().includes(lower));
      }
      if (!chosen) {
        return `⚠️ Tafadhali andika namba sahihi ya mgahawa (*1–${options.length}*) kutoka kwenye orodha:`;
      }

      session.details.selectedVendorId = chosen.id;
      session.details.selectedVendorName = chosen.name;
      session.details.selectedVendorAddress = chosen.address;

      if (session.details.foodMode === 'table_booking') {
        const availableTables = await fetchAvailableRestaurantTables(dbAdmin, chosen.id);
        session.details.availableTables = availableTables;
        session.step = 'TABLE_SELECT_SEATS';
        await saveMetaSession(session, dbAdmin);

        let resp = `🪑 *BOOKING YA MEZA — ${chosen.name.toUpperCase()}*\n📍 ${chosen.address}\n\n`;
        if (availableTables.length > 0) {
          resp += `Meza zilizo wazi sasa:\n`;
          availableTables.slice(0, 5).forEach((tbl, i) => {
            resp += `• Chaguo *M${i + 1}*: Meza *#${tbl.number}* (${tbl.capacity} Viti • ${tbl.section || 'Indoor'})\n`;
          });
          resp += `\n`;
        }
        resp += `Je, mnahitaji *viti / watu wangapi*? (Mfano andika: *1*, *2*, *4*, *6* — au andika *M1* kuchagua meza maalum):`;
        return resp;
      }

      return await promptMenuList(chosen.id, chosen.name, session.details.itemQuery);
    }

    // TABLE BOOKING BRANCH A: Select Seats / Specific Table
    if (session.step === 'TABLE_SELECT_SEATS') {
      const availableTables: MetaRestaurantTable[] = session.details.availableTables || [];
      let seatsCount = 0;
      let preferredTable: MetaRestaurantTable | undefined;

      const mMatch = trimmed.match(/^m(\d+)$/i);
      if (mMatch) {
        const tIdx = parseInt(mMatch[1], 10) - 1;
        preferredTable = availableTables[tIdx];
        if (preferredTable) {
          seatsCount = preferredTable.capacity;
        }
      } else {
        const numMatch = trimmed.match(/\d+/);
        if (numMatch) {
          seatsCount = parseInt(numMatch[0], 10);
        }
      }

      if (!seatsCount || seatsCount < 1 || seatsCount > 50) {
        return `⚠️ Tafadhali andika idadi sahihi ya viti/watu (Mfano: *1*, *2*, *4*, au *6*):`;
      }

      if (!preferredTable && availableTables.length > 0) {
        preferredTable = availableTables.find((t) => t.capacity >= seatsCount) || availableTables[0];
      }

      session.details.seatsCount = seatsCount;
      if (preferredTable) {
        session.details.preferredTableId = preferredTable.id;
        session.details.preferredTableNumber = preferredTable.number;
      }
      session.step = 'TABLE_SELECT_TIME';
      await saveMetaSession(session, dbAdmin);

      return `👥 Viti vilivyochaguliwa: *Watu ${seatsCount}*${preferredTable ? ` (Meza *#${preferredTable.number}*)` : ''}\n\n` +
             `🕒 *CHAGUA SIKU NA MUDA WA KUFIKA:*\n` +
             `1. ⚡ Sasa hivi (Ndani ya dakika 30)\n` +
             `2. 🌆 Leo Jioni (Saa 1:00 Usiku)\n` +
             `3. 🌙 Leo Usiku (Saa 2:30 Usiku)\n` +
             `4. 📅 Kesho Mchana (Saa 7:00 Mchana)\n\n` +
             `_Andika namba (*1–4*) au andika muda wako mwenyewe (Mfano: *Leo saa 11 jioni*):_`;
    }

    // TABLE BOOKING BRANCH B: Select Date & Time
    if (session.step === 'TABLE_SELECT_TIME') {
      let scheduledTime = '';
      if (lower === '1') scheduledTime = 'Sasa hivi (Ndani ya dakika 30)';
      else if (lower === '2') scheduledTime = 'Leo Saa 1:00 Usiku (19:00)';
      else if (lower === '3') scheduledTime = 'Leo Saa 2:30 Usiku (20:30)';
      else if (lower === '4') scheduledTime = 'Kesho Saa 7:00 Mchana (13:00)';
      else if (trimmed.length >= 3) scheduledTime = trimmed;
      else {
        return `⚠️ Tafadhali chagua muda (*1–4*) au andika muda utakaofika (Mfano: *Leo saa 1:30 usiku*):`;
      }

      session.details.scheduledTime = scheduledTime;
      session.step = 'TABLE_ASK_PREORDER';
      await saveMetaSession(session, dbAdmin);

      return `🕒 Muda wa kufika: *${scheduledTime}*\n\n` +
             `🍽️ Je, ungependa *kuchagua chakula mapema (Pre-order)* ukute kimeandaliwa mezani, au utaagiza ukifika mgahawani?\n\n` +
             `1. 🍔 *Ndio, Chagua Chakula Sasa (Pre-order)*\n` +
             `2. 🪑 *Hapana, Nitaagiza Nikifika (Shikilia Meza Tu)*`;
    }

    // TABLE BOOKING BRANCH C: Ask Pre-order or Hold Table Only
    if (session.step === 'TABLE_ASK_PREORDER') {
      if (lower === '1' || lower.includes('ndio') || lower.includes('pre') || lower.includes('chagua') || lower.includes('yes')) {
        session.details.isTablePreOrder = true;
        session.details.foodCart = [];
        return await promptMenuList(
          session.details.selectedVendorId,
          session.details.selectedVendorName || 'Mgahawa'
        );
      } else if (lower === '2' || lower.includes('hapana') || lower.includes('nikifika') || lower.includes('shikilia') || lower.includes('no')) {
        session.details.isTablePreOrder = false;
        session.details.foodCart = [];
        session.details.paymentMethod = 'cash';
        session.details.paymentMethodLabel = 'Lipa Mgahawani Ukifika 💵';

        if (knownPhone) {
          return await finalizeFoodOrTable(knownPhone);
        }

        session.step = 'COLLECTING_PHONE';
        await saveMetaSession(session, dbAdmin);
        return `📞 Tafadhali andika namba yako ya simu ya kuthibitishia booking ya meza (Mfano: *0712345678*):`;
      } else {
        return `⚠️ Tafadhali andika *1* kuchagua chakula mapema au *2* kushikilia meza pekee.`;
      }
    }

    // FOOD MENU ITEM SELECTION (Delivery, Takeaway, or Table Pre-Order)
    if (session.step === 'FOOD_SELECT_ITEM') {
      const cart: any[] = session.details.foodCart || [];
      if (lower === '0' && cart.length > 0) {
        if (session.details.foodMode === 'delivery') {
          return await promptFoodDeliveryAddress();
        }
        session.step = 'SELECTING_PAYMENT_METHOD';
        await saveMetaSession(session, dbAdmin);
        const total = cart.reduce((s, it) => s + (it.price || 0) * (it.quantity || 1), 0);
        return `💳 *CHAGUA NJIA YA MALIPO*\nJumla ya oda: *TZS ${total.toLocaleString()}/=*\n\n1. 💵 *Cash*\n2. 📱 *M-Pesa*\n3. 📱 *Tigo Pesa (Mixx by Yas)*\n4. 📱 *Airtel Money*`;
      }

      const menu: MetaFoodMenuItem[] = session.details.foodMenu || [];
      const xMatch = trimmed.match(/^(\d+)\s*[x*]\s*(\d+)$/i);
      const itemIdx = parseInt(xMatch ? xMatch[1] : trimmed, 10) - 1;
      const inlineQty = xMatch ? Math.max(1, parseInt(xMatch[2], 10)) : 0;

      const selectedItem = menu[itemIdx];
      if (!selectedItem) {
        return `⚠️ Chaguo si sahihi. Tafadhali andika namba ya chakula (*1–${menu.length}*)${cart.length > 0 ? ' au *0* kuendelea' : ''}:`;
      }

      if (inlineQty > 0) {
        cart.push({ id: selectedItem.id, name: selectedItem.name, price: selectedItem.price, quantity: inlineQty });
        session.details.foodCart = cart;
        session.step = 'FOOD_CART_DECISION';
        await saveMetaSession(session, dbAdmin);
        const total = cart.reduce((s, it) => s + (it.price || 0) * (it.quantity || 1), 0);
        return `✅ Imeongezwa: *${selectedItem.name} x${inlineQty}*\n🧺 Jumla kwenye kikapu: *TZS ${total.toLocaleString()}/=*\n\n1. ➕ Ongeza chakula kingine\n2. ✅ Endelea kukamilisha oda`;
      }

      session.details.pendingFoodItem = selectedItem;
      session.step = 'FOOD_ITEM_QUANTITY';
      await saveMetaSession(session, dbAdmin);
      return `🍔 Umechagua: *${selectedItem.name}* (*TZS ${selectedItem.price.toLocaleString()}/=*)\n\nUngependa sahani / idadi ngapi? (Andika mfano: *1*, *2*, *3*):`;
    }

    // Quantity selection
    if (session.step === 'FOOD_ITEM_QUANTITY') {
      const qty = parseInt(trimmed, 10);
      const pending = session.details.pendingFoodItem;
      if (!pending || isNaN(qty) || qty < 1 || qty > 50) {
        return `⚠️ Tafadhali andika namba sahihi ya idadi (Mfano: *1*, *2*, *3*):`;
      }
      const cart: any[] = session.details.foodCart || [];
      cart.push({ id: pending.id, name: pending.name, price: pending.price, quantity: qty });
      session.details.foodCart = cart;
      delete session.details.pendingFoodItem;
      session.step = 'FOOD_CART_DECISION';
      await saveMetaSession(session, dbAdmin);

      const total = cart.reduce((s, it) => s + (it.price || 0) * (it.quantity || 1), 0);
      return `✅ Imeongezwa: *${pending.name} x${qty}*\n🧺 Jumla ya sasa: *TZS ${total.toLocaleString()}/=*\n\n1. ➕ Ongeza chakula / kinywaji kingine\n2. ✅ Endelea kukamilisha`;
    }

    // Add more or proceed to checkout
    if (session.step === 'FOOD_CART_DECISION') {
      if (lower === '1' || lower.includes('ongeza') || lower.includes('add')) {
        return await promptMenuList(
          session.details.selectedVendorId,
          session.details.selectedVendorName || 'Mgahawa'
        );
      } else if (lower === '2' || lower.includes('endelea') || lower.includes('maliza') || lower.includes('lipia') || lower.includes('checkout')) {
        if (session.details.foodMode === 'delivery') {
          return await promptFoodDeliveryAddress();
        }
        session.step = 'SELECTING_PAYMENT_METHOD';
        await saveMetaSession(session, dbAdmin);
        const cart = session.details.foodCart || [];
        const total = cart.reduce((s: number, it: any) => s + (it.price || 0) * (it.quantity || 1), 0);
        return `💳 *CHAGUA NJIA YA MALIPO*\nJumla ya oda: *TZS ${total.toLocaleString()}/=*\n\n1. 💵 *Cash*\n2. 📱 *M-Pesa*\n3. 📱 *Tigo Pesa (Mixx by Yas)*\n4. 📱 *Airtel Money*`;
      } else {
        return `⚠️ Tafadhali andika *1* kuongeza chakula kingine au *2* kuendelea kukamilisha.`;
      }
    }

    // Delivery address text fallback (GPS pin handled globally in 0C too)
    if (session.step === 'FOOD_DELIVERY_ADDRESS') {
      let deliveryPlace = trimmed;
      if (trimmed === '1' && savedLoc?.name) {
        deliveryPlace = savedLoc.name;
        session.details.deliveryCoords = savedLoc;
      } else if (trimmed.length < 3) {
        return `⚠️ Tafadhali andika jina la eneo lako la kuletewa chakula (Mfano: *Mikocheni B, karibu na Shoppers*):`;
      } else {
        await saveLocPref({ name: trimmed, address: trimmed });
      }
      session.details.deliveryAddress = deliveryPlace;
      session.step = 'SELECTING_PAYMENT_METHOD';
      await saveMetaSession(session, dbAdmin);
      const cart = session.details.foodCart || [];
      const total = cart.reduce((s: number, it: any) => s + (it.price || 0) * (it.quantity || 1), 0);
      return `📍 Eneo la kuletewa: *${deliveryPlace}*\nJumla ya oda: *TZS ${total.toLocaleString()}/=*\n\n💳 *CHAGUA NJIA YA MALIPO:*\n1. 💵 *Cash* (Lipa ukipokea)\n2. 📱 *M-Pesa*\n3. 📱 *Tigo Pesa (Mixx by Yas)*\n4. 📱 *Airtel Money*`;
    }

    // Payment method selection for food / pre-order
    if (session.step === 'SELECTING_PAYMENT_METHOD') {
      let paymentMethod = '';
      let paymentMethodLabel = '';
      if (lower === '1' || lower.includes('cash') || lower.includes('taslimu')) {
        paymentMethod = 'cash';
        paymentMethodLabel = 'Cash (Pesa Taslimu) 💵';
      } else if (lower === '2' || lower.includes('mpesa') || lower.includes('m-pesa') || lower.includes('voda')) {
        paymentMethod = 'mpesa';
        paymentMethodLabel = 'M-Pesa 📱';
      } else if (lower === '3' || lower.includes('tigo') || lower.includes('yas') || lower.includes('mixx')) {
        paymentMethod = 'tigopesa';
        paymentMethodLabel = 'Tigo Pesa (Mixx by Yas) 📱';
      } else if (lower === '4' || lower.includes('airtel')) {
        paymentMethod = 'airtelmoney';
        paymentMethodLabel = 'Airtel Money 📱';
      } else {
        return `⚠️ Chaguo la malipo si sahihi. Tafadhali andika *1* (Cash), *2* (M-Pesa), *3* (Tigo Pesa), au *4* (Airtel Money):`;
      }

      session.details.paymentMethod = paymentMethod;
      session.details.paymentMethodLabel = paymentMethodLabel;

      if (knownPhone) {
        return await finalizeFoodOrTable(knownPhone);
      }

      session.step = 'COLLECTING_PHONE';
      await saveMetaSession(session, dbAdmin);
      return `💳 Malipo: *${paymentMethodLabel}*\n\n📞 Tafadhali andika namba yako ya simu (Mfano: *0712345678*):`;
    }

    // Final confirmation & DB creation
    if (session.step === 'COLLECTING_PHONE') {
      const phoneNum = trimmed;
      const digitsOnly = phoneNum.replace(/\D/g, '');
      if (digitsOnly.length < 9) {
        return `⚠️ Namba ya simu si sahihi. Andika namba yenye tarakimu 10 (Mfano: *0712345678*):`;
      }
      return await finalizeFoodOrTable(phoneNum);
    }
  }

  // 4. GENERAL CATEGORY REDIRECTS FOR FULL INTENT SCOPE (SALON, PARCEL, CAR RENTAL, GROCERY, HOTEL, PHARMACY)
  // To keep it clean and interactive, we will provide a beautiful instant checkout block for each of these!
  
  // PARCEL FLOW
  if (service === 'parcel') {
    const isMenuPick =
      /^\d{1,2}$/.test(input.trim()) ||
      /^(paposend|parcel|mzigo|mizigo|tuma\s*mzigo|delivery)$/i.test(input.trim());

    const finalizeParcel = async (parcelPhone: string, routeText: string) => {
      const prCode = `PR-${Math.floor(1000 + Math.random() * 9000)}`;
      const cleanRoute = routeText || session.details.route || input.trim();
      const custName = session.details.customerName || 'Meta Courier Client';
      session.step = 'START';
      delete session.service;
      session.details = preserveCustomerFields(session.details, lang);
      await saveMetaSession(session, dbAdmin);

      const avail = await getLiveDriverAvailability(dbAdmin);
      const courierStatusNote =
        avail.free.bike + avail.free.bajaj > 0
          ? `📡 Madereva *${avail.free.bike + avail.free.bajaj}* wapo tayari kuchukua mzigo.`
          : avail.busy.bike + avail.busy.bajaj > 0
          ? `🟡 Madereva wa mizigo wako *busy* sasa — ombi lipo kwenye foleni, utapigiwa akimaliza.`
          : `🔴 Hakuna dereva aliye *Online* sasa — ombi limehifadhiwa, dereva akiingia hewani ataliona.`;

      await triggerAutomatedOrder(
        dbAdmin,
        'papo-hapo-courier',
        'parcel',
        [{ name: `Courier Delivery: ${cleanRoute}`, price: 5000, quantity: 1 }],
        5000,
        parcelPhone,
        custName,
        `Parcel #${prCode} | Route: ${cleanRoute}`,
        session.channel,
        { bookingCode: prCode, orderType: 'delivery', deliveryAddress: cleanRoute }
      );

      return (
        `✅ *Oda ya PapoSend Imepokelewa!*\n` +
        `🔖 *#${prCode}* • *TZS 5,000*\n` +
        `📦 ${cleanRoute}\n` +
        `📞 Simu: *${parcelPhone}*\n\n` +
        `${courierStatusNote}\n\n` +
        `📋 Oda zako: ${buildOrdersTrackingUrl(parcelPhone, prCode)}`
      );
    };

    const inParcelStep =
      (session.step === 'COLLECTING_ROUTE' && Boolean(session.details.awaitingParcelRoute)) ||
      session.step === 'COLLECTING_PHONE';
    if (!inParcelStep) {
      const hasInlineRoute = !isMenuPick && /(-|kwenda|mpaka|hadi|\bto\b)/i.test(input.trim()) && input.trim().length >= 5;
      if (!hasInlineRoute) {
        session.step = 'COLLECTING_ROUTE';
        session.details.awaitingParcelRoute = true;
        await saveMetaSession(session, dbAdmin);
        return isEn
          ? `[[EN_NATIVE]]📦 *PapoSend — Send a Parcel*\nType pickup & dropoff route (e.g. *Kariakoo - Tegeta*):`
          : `📦 *PapoSend — Tuma Mzigo*\nAndika *njia ya mzigo* — unatoka wapi kwenda wapi (Mfano: *Kariakoo - Tegeta*):`;
      }
      if (knownPhone) {
        return await finalizeParcel(knownPhone, input.trim());
      }
      session.details.route = input.trim();
      delete session.details.awaitingParcelRoute;
      session.step = 'COLLECTING_PHONE';
      await saveMetaSession(session, dbAdmin);
      return `📦 Njia: *${input.trim()}*\n\n📞 Andika *namba yako ya simu* kwa uthibitisho (Mfano: *0712345678*):`;
    }

    if (session.step === 'COLLECTING_ROUTE') {
      const routeVal = input.trim();
      if (routeVal.length < 3 || /^\d{1,2}$/.test(routeVal)) {
        return `⚠️ Tafadhali andika njia ya mzigo (Mfano: *Kariakoo - Tegeta*):`;
      }
      if (knownPhone) {
        return await finalizeParcel(knownPhone, routeVal);
      }
      session.details.route = routeVal;
      session.step = 'COLLECTING_PHONE';
      await saveMetaSession(session, dbAdmin);
      return `📦 Njia: *${routeVal}*\n\n📞 Andika *namba yako ya simu* kwa uthibitisho (Mfano: *0712345678*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
      const rawPhone = parts[0] || '';
      const phoneDigits = rawPhone.replace(/\D/g, '');
      const parcelPhone = phoneDigits.length >= 9 ? rawPhone : knownPhone;
      if (!parcelPhone || parcelPhone.replace(/\D/g, '').length < 9) {
        return `⚠️ Tafadhali weka namba sahihi ya simu (Mfano: *0712345678*):`;
      }
      await savePhonePref(parcelPhone);
      const routeFromInput = parts.length > 1 ? parts.slice(1).join(', ') : '';
      return await finalizeParcel(parcelPhone, routeFromInput || session.details.route || '');
    }
  }

  // CAR RENTAL FLOW
  if (service === 'car_rental') {
    const isMenuPick =
      /^\d{1,2}$/.test(input.trim()) ||
      /^(paporent|kodi(\s*gari)?|car\s*rental|rent(\s*car)?)$/i.test(input.trim());

    const finalizeCarRental = async (rentalPhone: string) => {
      const crCode = `CR-${Math.floor(1000 + Math.random() * 9000)}`;
      const selectedVendorId = session.details.selectedVendorId || 'car-rental-meta-vendor';
      const selectedName = session.details.selectedName || 'Rental Car';
      const selectedPrice = session.details.selectedPrice || 100000;
      const custName = session.details.customerName || 'Meta Car Rental Client';

      session.step = 'START';
      delete session.service;
      session.details = preserveCustomerFields(session.details, lang);
      await saveMetaSession(session, dbAdmin);

      await triggerAutomatedOrder(
        dbAdmin,
        selectedVendorId,
        'car_rental',
        [{ name: `Car Rental: ${selectedName}`, price: selectedPrice, quantity: 1 }],
        selectedPrice,
        rentalPhone,
        custName,
        `Car Rental #${crCode} | ${selectedName}`,
        session.channel,
        { bookingCode: crCode }
      );

      return (
        `🎉 *Kuhifadhi Gari Limefanikiwa!* 🚗🔑\n` +
        `🔖 Namba ya Booking: *#${crCode}*\n\n` +
        `- Gari: *${selectedName}*\n` +
        `- Gharama/Siku: *TSH ${selectedPrice.toLocaleString()}*\n` +
        `- Simu Yako: *${rentalPhone}*\n\n` +
        `🔗 *Fuatilia booking & oda zako zote:*\n${buildOrdersTrackingUrl(rentalPhone, crCode)}\n\n` +
        `Mwakilishi wetu atawasiliana nawe hivi punde kuleta gari na funguo mahali ulipo au kukuelekeza ofisini. Ahsante na karibu sana!`
      );
    };

    const inRentalStep = ['SELECTING_OPTION', 'COLLECTING_PHONE'].includes(session.step);
    if (!inRentalStep) {
      const searchQ = isMenuPick ? undefined : cleaned;
      session.details.itemQuery = searchQ || 'ALL';
      session.step = 'SELECTING_OPTION';

      const cars = await fetchCatalogItemsForMeta(dbAdmin, 'car_rental', searchQ, [
        {
          id: 'car-m1',
          name: 'Toyota Land Cruiser Prado (Silver)',
          price: 150000,
          desc: '4x4 Safari & Executive • AC',
          imageUrl: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'car-m2',
          name: 'Toyota Harrier New Model (Black)',
          price: 100000,
          desc: 'Luxury SUV • Automatic',
          imageUrl: 'https://images.unsplash.com/photo-1549317661-bd82d8be0c21?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'car-m3',
          name: 'Toyota Noah (Vibe / Safari)',
          price: 70000,
          desc: 'Watu 7 • Familia & Safari',
          imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80'
        }
      ]);
      session.details.optionsList = cars;
      await saveMetaSession(session, dbAdmin);

      appendMediaItems(
        mediaCollector,
        cars.map((car, idx) => ({
          url: car.imageUrl,
          caption: `*${idx + 1}. ${car.name}* — *TZS ${car.price.toLocaleString()}/siku*${car.desc ? `\n${car.desc}` : ''}`
        }))
      );

      let resp = `🚗 *PapoRent — Kodisha Gari*\n\n`;
      resp += `Magari yanayopatikana leo karibu nawe:\n\n`;
      cars.forEach((car, idx) => {
        resp += `*${idx + 1}. ${car.name}*\n${car.desc ? `📌 ${car.desc}\n` : ''}💰 Kodi kwa siku: *TSH ${car.price.toLocaleString()}*\n\n`;
      });
      resp += `Andika namba ya gari unalotaka kukodi leo (*1–${cars.length}*):`;
      return resp;
    }

    if (session.step === 'SELECTING_OPTION') {
      const idx = parseInt(input, 10) - 1;
      const selected = session.details.optionsList?.[idx];
      if (!selected) {
        return `⚠️ Namba si sahihi. Andika namba sahihi ya gari (*1–${session.details.optionsList?.length || 3}*).`;
      }

      session.details.selectedId = selected.id;
      session.details.selectedVendorId = selected.vendorId || 'car-rental-meta-vendor';
      session.details.selectedName = selected.name;
      session.details.selectedPrice = selected.price;
      if (knownPhone) {
        return await finalizeCarRental(knownPhone);
      }
      session.step = 'COLLECTING_PHONE';
      await saveMetaSession(session, dbAdmin);

      return `🔑 Umechagua *${selected.name}*! Andika namba yako ya simu ya mkononi ya kukamilisha kukodisha (Mfano: *0712345678*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      const rentalPhone = input.trim();
      if (rentalPhone.replace(/\D/g, '').length < 9) {
        return `⚠️ Tafadhali weka namba sahihi ya simu (Mfano: *0712345678*):`;
      }
      await savePhonePref(rentalPhone);
      return await finalizeCarRental(rentalPhone);
    }
  }

  // SALON FLOW
  if (service === 'salon') {
    const isMenuPick =
      /^\d{1,2}$/.test(input.trim()) ||
      /^(papostyle|saluni|salon|spa|nywele|kucha|makeup)$/i.test(input.trim());

    const finalizeSalon = async (salonPhone: string, arrivalDetails: string) => {
      const slCode = `SL-${Math.floor(1000 + Math.random() * 9000)}`;
      const selectedVendorId = session.details.selectedVendorId || session.details.selectedId || 'salon-meta-vendor';
      const selectedName = session.details.selectedName || 'Salon Booking';
      const selectedPrice = session.details.selectedPrice || 15000;
      const custName = session.details.customerName || 'Meta Salon Client';

      session.step = 'START';
      delete session.service;
      session.details = preserveCustomerFields(session.details, lang);
      await saveMetaSession(session, dbAdmin);

      await triggerAutomatedOrder(
        dbAdmin,
        selectedVendorId,
        'salon',
        [{ name: `Salon Booking at ${selectedName}`, price: selectedPrice, quantity: 1 }],
        selectedPrice,
        salonPhone,
        custName,
        `Salon #${slCode} | Details: ${arrivalDetails}`,
        session.channel,
        { bookingCode: slCode }
      );

      return (
        `✨ *Miadi ya Saluni Imethibitishwa!* 💇‍♀️💅\n` +
        `🔖 Namba ya Miadi: *#${slCode}*\n\n` +
        `- Saluni: *${selectedName}*\n` +
        `- Bei: *TSH ${selectedPrice.toLocaleString()}*\n` +
        `- Muda wa kufika: *${arrivalDetails}*\n` +
        `- Simu: *${salonPhone}*\n\n` +
        `🔗 *Fuatilia miadi & oda zako zote:*\n${buildOrdersTrackingUrl(salonPhone, slCode)}\n\n` +
        `Saluni imepokea ombi lako na itakupigia simu kuthibitisha muda sahihi. Ahsante kwa kutumia Papo Hapo!`
      );
    };

    const inSalonStep = ['SELECTING_OPTION', 'COLLECTING_PHONE'].includes(session.step);
    if (!inSalonStep) {
      const searchQ = isMenuPick ? undefined : cleaned;
      session.details.itemQuery = searchQ || 'ALL';
      session.step = 'SELECTING_OPTION';

      const salons = await fetchCatalogItemsForMeta(dbAdmin, 'salon', searchQ, [
        {
          id: 'sal-m1',
          name: 'Shear Illusions Executive Salon',
          price: 20000,
          desc: 'Hair Treatment & Wash',
          imageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'sal-m2',
          name: 'Glamour Nails & Makeup Lounge',
          price: 25000,
          desc: 'Manicure & Nails gel',
          imageUrl: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'sal-m3',
          name: 'VIP Barber & Facial Scrub',
          price: 10000,
          desc: 'Premium Shaving & Scrub',
          imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80'
        }
      ]);
      session.details.optionsList = salons;
      await saveMetaSession(session, dbAdmin);

      appendMediaItems(
        mediaCollector,
        salons.map((sal, idx) => ({
          url: sal.imageUrl,
          caption: `*${idx + 1}. ${sal.name}* — *TSH ${sal.price.toLocaleString()}*${sal.desc ? `\n📍 ${sal.desc}` : ''}`
        }))
      );

      let resp = `💇‍♀️ *PapoStyle — Saluni & Spa*\n\n`;
      if (searchQ) resp += `Umesema unatafuta: *"${searchQ}"*\n\n`;
      salons.forEach((sal, idx) => {
        resp += `*${idx + 1}. ${sal.name}*\n${sal.desc ? `📍 ${sal.desc}\n` : ''}💰 Huduma: *TSH ${sal.price.toLocaleString()}*\n\n`;
      });
      resp += `Andika namba ya Saluni unayotaka kuweka miadi (*1–${salons.length}*):`;
      return resp;
    }

    if (session.step === 'SELECTING_OPTION') {
      const idx = parseInt(input, 10) - 1;
      const selected = session.details.optionsList?.[idx];
      if (!selected) {
        return `⚠️ Chaguo si sahihi. Tafadhali weka namba kuanzia *1* hadi *${session.details.optionsList?.length || 3}*.`;
      }

      session.details.selectedId = selected.id;
      session.details.selectedVendorId = selected.vendorId || selected.id || 'salon-meta-vendor';
      session.details.selectedName = selected.name;
      session.details.selectedPrice = selected.price;
      session.step = 'COLLECTING_PHONE';

      if (knownPhone) {
        session.details.skipPhoneAsk = true;
        await saveMetaSession(session, dbAdmin);
        return `⏰ Umechagua *${selected.name}*!\nUngependa kufika *muda gani* saluni? (Mfano: *Leo Saa 11 Jioni* au *Kesho Saa 4 Asubuhi*):`;
      }

      delete session.details.skipPhoneAsk;
      await saveMetaSession(session, dbAdmin);
      return `⏰ Umechagua *${selected.name}*! Tafadhali andika *namba yako ya simu* na *muda* unaopendelea kufika (Mfano: *0712345678, Saa 11 Jioni*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      if (knownPhone && session.details.skipPhoneAsk) {
        return await finalizeSalon(knownPhone, input.trim());
      }
      const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
      const rawPhone = parts[0] || '';
      const salonPhone = rawPhone.replace(/\D/g, '').length >= 9 ? rawPhone : knownPhone;
      if (!salonPhone || salonPhone.replace(/\D/g, '').length < 9) {
        return `⚠️ Tafadhali weka namba sahihi ya simu na muda (Mfano: *0712345678, Saa 11 Jioni*):`;
      }
      await savePhonePref(salonPhone);
      const arrivalDetails = parts.length > 1 ? parts.slice(1).join(', ') : input.trim();
      return await finalizeSalon(salonPhone, arrivalDetails);
    }
  }

  // SOKONI / GROCERY FLOW
  if (service === 'grocery') {
    const isMenuPick =
      /^\d{1,2}$/.test(input.trim()) ||
      /^(papomart|sokoni|soko|grocery|groceries|mboga)$/i.test(input.trim());

    const finalizeGrocery = async (groceryPhone: string, deliveryAddr: string) => {
      const skCode = `SK-${Math.floor(1000 + Math.random() * 9000)}`;
      const selectedVendorId = session.details.selectedVendorId || 'sokoni-vendor-meta';
      const selectedName = session.details.selectedName || 'Grocery Item';
      const selectedPrice = session.details.selectedPrice || 5000;
      const custName = session.details.customerName || 'Meta Grocery Client';

      session.step = 'START';
      delete session.service;
      session.details = preserveCustomerFields(session.details, lang);
      await saveMetaSession(session, dbAdmin);

      await triggerAutomatedOrder(
        dbAdmin,
        selectedVendorId,
        'grocery',
        [{ name: selectedName, price: selectedPrice, quantity: 1 }],
        selectedPrice,
        groceryPhone,
        custName,
        `Sokoni #${skCode} | Market Address: ${deliveryAddr}`,
        session.channel,
        { bookingCode: skCode, orderType: 'delivery', deliveryAddress: deliveryAddr }
      );

      return (
        `🎉 *Oda Yako Sokoni Imesajiliwa!* 🥦🛍️\n` +
        `🔖 Namba ya Oda: *#${skCode}*\n\n` +
        `- Bidhaa: *${selectedName}*\n` +
        `- Jumla ya Bei: *TSH ${selectedPrice.toLocaleString()}*\n` +
        `- Eneo la Kuletewa: *${deliveryAddr}*\n` +
        `- Simu: *${groceryPhone}*\n\n` +
        `🔗 *Fuatilia oda & oda zako zote:*\n${buildOrdersTrackingUrl(groceryPhone, skCode)}\n\n` +
        `Mjumbe wetu anafunga bidhaa zako na ataondoka sokoni kukuletea hapo punde. Ahsante sana!`
      );
    };

    const inGroceryStep = ['SELECTING_OPTION', 'COLLECTING_PHONE'].includes(session.step);
    if (!inGroceryStep) {
      const searchQ = isMenuPick ? undefined : cleaned;
      session.details.itemQuery = searchQ || 'ALL';
      session.step = 'SELECTING_OPTION';

      const items = await fetchCatalogItemsForMeta(dbAdmin, 'grocery', searchQ, [
        {
          id: 'grc-m1',
          name: 'Nyanya Kiboksi (Safi)',
          price: 3500,
          desc: 'Sokoni Fresh',
          imageUrl: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'grc-m2',
          name: 'Vitunguu Fungo Kubwa (Sokoni)',
          price: 2000,
          desc: 'Vitunguu Maji Bora',
          imageUrl: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'grc-m3',
          name: 'Mchele Grade I (Sumbawanga - 5KG)',
          price: 12500,
          desc: 'Mchele Mzuri wa Mbeya/Sumbawanga',
          imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80'
        }
      ]);
      session.details.optionsList = items;
      await saveMetaSession(session, dbAdmin);

      appendMediaItems(
        mediaCollector,
        items.map((item, idx) => ({
          url: item.imageUrl,
          caption: `*${idx + 1}. ${item.name}* — *TSH ${item.price.toLocaleString()}*${item.desc ? `\n${item.desc}` : ''}`
        }))
      );

      let resp = `🥦 *PapoMart — Mahitaji ya Sokoni*\n\n`;
      if (searchQ) resp += `Bidhaa zilizopo kwa ajili ya: *"${searchQ}"*\n\n`;
      items.forEach((item, idx) => {
        resp += `*${idx + 1}. ${item.name}*\n${item.desc ? `📌 ${item.desc}\n` : ''}💰 Bei: *TSH ${item.price.toLocaleString()}*\n\n`;
      });
      resp += `Andika namba ya bidhaa unayotaka kuagiza sasa hivi (*1–${items.length}*):`;
      return resp;
    }

    if (session.step === 'SELECTING_OPTION') {
      const idx = parseInt(input, 10) - 1;
      const selected = session.details.optionsList?.[idx];
      if (!selected) {
        return `⚠️ Weka namba sahihi ya orodha kuanzia *1* hadi *${session.details.optionsList?.length || 3}*.`;
      }

      session.details.selectedId = selected.id;
      session.details.selectedVendorId = selected.vendorId || 'sokoni-vendor-meta';
      session.details.selectedName = selected.name;
      session.details.selectedPrice = selected.price;
      session.step = 'COLLECTING_PHONE';

      if (knownPhone) {
        session.details.skipPhoneAsk = true;
        await saveMetaSession(session, dbAdmin);
        if (savedLoc?.name) {
          return `🏡 Umechagua *${selected.name}*!\n📍 Tukuletée *eneo gani*?\n1. 📍 Tumia *${savedLoc.name}*\n_Au andika eneo jingine / tuma 📍 Location:_`;
        }
        return `🏡 Umechagua *${selected.name}*!\n📍 Tafadhali andika *anwani/eneo* la kuletewa mzigo (Mfano: *Kinondoni Block B* au tuma 📍 *Location*):`;
      }

      delete session.details.skipPhoneAsk;
      await saveMetaSession(session, dbAdmin);
      return `🏡 Umechagua *${selected.name}*! Tafadhali weka *namba yako ya simu* na *anwani ya kuwasilisha* (Mfano: *0712345678, Kinondoni Block B*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      if (knownPhone && session.details.skipPhoneAsk) {
        let addr = input.trim();
        if (addr === '1' && savedLoc?.name) {
          addr = savedLoc.name;
        } else if (addr.length >= 2) {
          await saveLocPref({ name: addr, address: addr });
        }
        return await finalizeGrocery(knownPhone, addr);
      }

      const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
      const rawPhone = parts[0] || '';
      const groceryPhone = rawPhone.replace(/\D/g, '').length >= 9 ? rawPhone : knownPhone;
      if (!groceryPhone || groceryPhone.replace(/\D/g, '').length < 9) {
        return `⚠️ Tafadhali weka namba sahihi ya simu na anwani (Mfano: *0712345678, Kinondoni*):`;
      }
      await savePhonePref(groceryPhone);
      const addrPart = parts.length > 1 ? parts.slice(1).join(', ') : input.trim();
      if (addrPart.length >= 2 && addrPart !== groceryPhone) {
        await saveLocPref({ name: addrPart, address: addrPart });
      }
      return await finalizeGrocery(groceryPhone, addrPart);
    }
  }

  // PHARMACY FLOW
  if (service === 'pharmacy') {
    const isMenuPick =
      /^\d{1,2}$/.test(input.trim()) ||
      /^(papomed|dawa|pharmacy|afya)$/i.test(input.trim());

    const finalizePharmacy = async (rxPhone: string, deliveryAddr: string) => {
      const rxCode = `RX-${Math.floor(1000 + Math.random() * 9000)}`;
      const selectedVendorId = session.details.selectedVendorId || 'pharmacy-meta-vendor';
      const selectedName = session.details.selectedName || 'Pharmacy Order';
      const selectedPrice = session.details.selectedPrice || 2500;
      const custName = session.details.customerName || 'Meta Pharmacy Client';

      session.step = 'START';
      delete session.service;
      session.details = preserveCustomerFields(session.details, lang);
      await saveMetaSession(session, dbAdmin);

      await triggerAutomatedOrder(
        dbAdmin,
        selectedVendorId,
        'pharmacy',
        [{ name: selectedName, price: selectedPrice, quantity: 1 }],
        selectedPrice,
        rxPhone,
        custName,
        `Pharmacy #${rxCode} | ${selectedName} | Address: ${deliveryAddr}`,
        session.channel,
        { bookingCode: rxCode, orderType: 'delivery', deliveryAddress: deliveryAddr }
      );

      return (
        `✅ *Agizo la Dawa Limepokelewa!* 💊🚑\n` +
        `🔖 Namba ya Oda: *#${rxCode}*\n\n` +
        `- Dawa: *${selectedName}*\n` +
        `- Bei ya kulipa: *TSH ${selectedPrice.toLocaleString()}*\n` +
        `- Eneo: *${deliveryAddr}*\n` +
        `- Simu: *${rxPhone}*\n\n` +
        `🔗 *Fuatilia oda & oda zako zote:*\n${buildOrdersTrackingUrl(rxPhone, rxCode)}\n\n` +
        `Tumetuma ujumbe wa malipo (Push Prompt) kwenye namba yako *${rxPhone}*. Muamala ukikamilika duka litatuma dawa zako mara moja!`
      );
    };

    const inPharmacyStep = ['SELECTING_OPTION', 'COLLECTING_PHONE'].includes(session.step);
    if (!inPharmacyStep) {
      const searchQ = isMenuPick ? undefined : cleaned;
      session.details.itemQuery = searchQ || 'ALL';
      session.step = 'SELECTING_OPTION';

      const meds = await fetchCatalogItemsForMeta(dbAdmin, 'pharmacy', searchQ, [
        {
          id: 'med-m1',
          name: 'Panadol Advance (Kopo 24)',
          price: 3000,
          desc: 'Maumivu & Homa (OTC)',
          imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'med-m2',
          name: 'Vitamin C + Zinc Boosters',
          price: 4500,
          desc: 'Kinga ya Mwili',
          imageUrl: 'https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'med-m3',
          name: 'First Aid & Bandage Kit',
          price: 6500,
          desc: 'Huduma ya Kwanza',
          imageUrl: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=800&q=80'
        }
      ]);
      session.details.optionsList = meds;
      await saveMetaSession(session, dbAdmin);

      appendMediaItems(
        mediaCollector,
        meds.map((med, idx) => ({
          url: med.imageUrl,
          caption: `*${idx + 1}. ${med.name}* — *TSH ${med.price.toLocaleString()}*${med.desc ? `\n${med.desc}` : ''}`
        }))
      );

      let resp = `💊 *PapoMed — Dawa na Afya*\n\n`;
      if (searchQ) resp += `Dawa/Vifaa vilivyopo karibu kwa ajili ya: *"${searchQ}"*\n\n`;
      meds.forEach((med, idx) => {
        resp += `*${idx + 1}. ${med.name}*\n${med.desc ? `📌 ${med.desc}\n` : ''}💰 Bei: *TSH ${med.price.toLocaleString()}*\n\n`;
      });
      resp += `Andika namba ya dawa unayohitaji kuagiza (*1–${meds.length}*):`;
      return resp;
    }

    if (session.step === 'SELECTING_OPTION') {
      const idx = parseInt(input, 10) - 1;
      const selected = session.details.optionsList?.[idx];
      if (!selected) {
        return `⚠️ Weka namba sahihi. Chagua *1* hadi *${session.details.optionsList?.length || 3}*.`;
      }

      session.details.selectedId = selected.id;
      session.details.selectedVendorId = selected.vendorId || 'pharmacy-meta-vendor';
      session.details.selectedName = selected.name;
      session.details.selectedPrice = selected.price;
      session.step = 'COLLECTING_PHONE';

      if (knownPhone) {
        session.details.skipPhoneAsk = true;
        await saveMetaSession(session, dbAdmin);
        if (savedLoc?.name) {
          return `💊 Umechagua *${selected.name}*!\n📍 Tukuletée *eneo gani*?\n1. 📍 Tumia *${savedLoc.name}*\n_Au andika eneo jingine / tuma 📍 Location:_`;
        }
        return `💊 Umechagua *${selected.name}*!\n📍 Tafadhali andika *eneo ulipo* (Mfano: *Sinza* au tuma 📍 *Location*):`;
      }

      delete session.details.skipPhoneAsk;
      await saveMetaSession(session, dbAdmin);
      return `💊 Umechagua *${selected.name}*! Tafadhali andika *namba yako ya simu* na *eneo ulipo* (Mfano: *0712345678, Sinza*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      if (knownPhone && session.details.skipPhoneAsk) {
        let addr = input.trim();
        if (addr === '1' && savedLoc?.name) {
          addr = savedLoc.name;
        } else if (addr.length >= 2) {
          await saveLocPref({ name: addr, address: addr });
        }
        return await finalizePharmacy(knownPhone, addr);
      }

      const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
      const rawPhone = parts[0] || '';
      const rxPhone = rawPhone.replace(/\D/g, '').length >= 9 ? rawPhone : knownPhone;
      if (!rxPhone || rxPhone.replace(/\D/g, '').length < 9) {
        return `⚠️ Tafadhali weka namba sahihi ya simu na eneo (Mfano: *0712345678, Sinza*):`;
      }
      await savePhonePref(rxPhone);
      const addrPart = parts.length > 1 ? parts.slice(1).join(', ') : input.trim();
      if (addrPart.length >= 2 && addrPart !== rxPhone) {
        await saveLocPref({ name: addrPart, address: addrPart });
      }
      return await finalizePharmacy(rxPhone, addrPart);
    }
  }

  // HOTEL & ROOMS FLOW
  if (service === 'hotel') {
    const finalizeHotel = async (hotelPhone: string, checkInInfo: string) => {
      const htCode = `HT-${Math.floor(1000 + Math.random() * 9000)}`;
      const vendorId = session.details.selectedHotelId || session.details.selectedId || 'hotel-meta-vendor';
      const selectedName = session.details.selectedName || 'Hotel Room';
      const selectedPrice = session.details.selectedPrice || 100000;
      const custName = session.details.customerName || 'Meta Hotel Client';

      session.step = 'START';
      delete session.service;
      session.details = preserveCustomerFields(session.details, lang);
      await saveMetaSession(session, dbAdmin);

      await triggerAutomatedOrder(
        dbAdmin,
        vendorId,
        'hotel',
        [{ name: `Hotel Room: ${selectedName}`, price: selectedPrice, quantity: 1 }],
        selectedPrice,
        hotelPhone,
        custName,
        `Hotel Booking #${htCode} | Room Booking info: ${checkInInfo}`,
        session.channel,
        { bookingCode: htCode, orderType: 'booking' }
      );

      return (
        `🏨 *Booking ya Chumba Imethibitishwa!* 🎉\n` +
        `🔖 Namba ya Booking: *#${htCode}*\n\n` +
        `- Chumba: *${selectedName}*\n` +
        `- Bei/Usiku: *TSH ${selectedPrice.toLocaleString()}*\n` +
        `- Tarehe ya Kuingia: *${checkInInfo}*\n` +
        `- Simu: *${hotelPhone}*\n\n` +
        `🔗 *Fuatilia booking & oda zako zote:*\n${buildOrdersTrackingUrl(hotelPhone, htCode)}\n\n` +
        `Hoteli imepokea booking yako na itakupigia/kutuma uthibitisho punde. Karibu sana! 🇹🇿`
      );
    };

    const isInHotelStep = ['HOTEL_SELECT_VENDOR', 'HOTEL_SELECT_ROOM', 'COLLECTING_PHONE'].includes(session.step);

    if (!isInHotelStep) {
      const hotels = await fetchHotelsForMeta(dbAdmin);
      session.details.optionsList = hotels;
      session.step = 'HOTEL_SELECT_VENDOR';
      await saveMetaSession(session, dbAdmin);

      appendMediaItems(
        mediaCollector,
        hotels.map((htl, idx) => ({
          url: htl.imageUrl,
          caption: `*${idx + 1}. ${htl.name}*\n📍 ${htl.desc || 'Tanzania'} • Kuanzia *TZS ${htl.price.toLocaleString()}/usiku*`
        }))
      );

      let resp = `🏨 *PapoStay — Hoteli & Malazi*\n\n`;
      resp += `Hoteli na nyumba za wageni zilizopo:\n\n`;
      hotels.forEach((htl, idx) => {
        resp += `*${idx + 1}. ${htl.name}*\n📍 ${htl.desc}\n💰 Kuanzia: *TSH ${htl.price.toLocaleString()}/usiku*\n\n`;
      });
      resp += `Andika namba ya hoteli kuona *picha na bei za vyumba vyake* (*1–${hotels.length}*):`;
      return resp;
    }

    if (session.step === 'HOTEL_SELECT_VENDOR') {
      const idx = parseInt(input, 10) - 1;
      const hotelList: MetaCatalogOption[] = session.details.optionsList || [];
      const selectedHotel = hotelList[idx];
      if (!selectedHotel) {
        return `⚠️ Namba uliyoweka haipo. Tafadhali chagua *1–${hotelList.length}*:`;
      }

      session.details.selectedHotelId = selectedHotel.id;
      session.details.selectedHotelName = selectedHotel.name;
      const rooms = await fetchHotelRoomsForMeta(dbAdmin, selectedHotel);
      session.details.roomOptions = rooms;
      session.step = 'HOTEL_SELECT_ROOM';
      await saveMetaSession(session, dbAdmin);

      appendMediaItems(
        mediaCollector,
        rooms.map((rm, rIdx) => ({
          url: rm.imageUrl,
          caption: `*${rIdx + 1}. ${rm.name}* (${selectedHotel.name})\n💰 *TZS ${rm.price.toLocaleString()}/usiku*${rm.desc ? `\n🛏️ ${rm.desc}` : ''}`
        }))
      );

      let resp = `🛏️ *VYUMBA VYA ${selectedHotel.name.toUpperCase()}*\n\n`;
      rooms.forEach((rm, rIdx) => {
        resp += `*${rIdx + 1}. ${rm.name}*\n${rm.desc ? `✨ ${rm.desc}\n` : ''}💰 *TSH ${rm.price.toLocaleString()}/usiku*\n\n`;
      });
      resp += `Andika namba ya chumba unachotaka kuweka Booking (*1–${rooms.length}*):`;
      return resp;
    }

    if (session.step === 'HOTEL_SELECT_ROOM') {
      const idx = parseInt(input, 10) - 1;
      const roomList: MetaCatalogOption[] = session.details.roomOptions || [];
      const selectedRoom = roomList[idx];
      if (!selectedRoom) {
        return `⚠️ Chagua namba sahihi ya chumba (*1–${roomList.length}*):`;
      }

      session.details.selectedId = selectedRoom.id;
      session.details.selectedName = `${session.details.selectedHotelName} — ${selectedRoom.name}`;
      session.details.selectedPrice = selectedRoom.price;
      session.step = 'COLLECTING_PHONE';

      if (knownPhone) {
        session.details.skipPhoneAsk = true;
        await saveMetaSession(session, dbAdmin);
        return `🏨 Umechagua *${selectedRoom.name}* (*TSH ${selectedRoom.price.toLocaleString()}/usiku*)!\n\n🗓️ Unataka kuingia *lini*? (Mfano: *Leo Usiku* au *Kesho*):`;
      }

      delete session.details.skipPhoneAsk;
      await saveMetaSession(session, dbAdmin);
      return `🏨 Umechagua *${selectedRoom.name}* (*TSH ${selectedRoom.price.toLocaleString()}/usiku*)!\n\nSasa andika *namba yako ya simu* na *tarehe ya kuingia* (Mfano: *0712345678, Leo Usiku* au *Kesho*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      if (knownPhone && session.details.skipPhoneAsk) {
        return await finalizeHotel(knownPhone, input.trim());
      }
      const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
      const rawPhone = parts[0] || '';
      const hotelPhone = rawPhone.replace(/\D/g, '').length >= 9 ? rawPhone : knownPhone;
      if (!hotelPhone || hotelPhone.replace(/\D/g, '').length < 9) {
        return `⚠️ Tafadhali weka namba sahihi ya simu na tarehe (Mfano: *0712345678, Leo Usiku*):`;
      }
      await savePhonePref(hotelPhone);
      const checkInInfo = parts.length > 1 ? parts.slice(1).join(', ') : input.trim();
      return await finalizeHotel(hotelPhone, checkInInfo);
    }
  }

  // PAPOFIX (HANDYMAN & HOME SERVICES FLOW)
  if (service === 'handyman') {
    const FIX_CATEGORIES = [
      { id: 'electrician', label: 'Fundi Umeme (Electrician)', price: 10000 },
      { id: 'plumbing', label: 'Fundi Bomba (Plumbing)', price: 10000 },
      { id: 'appliances', label: 'AC & Friji Repair', price: 15000 },
      { id: 'carpentry', label: 'Fundi Mbao & Vitasa', price: 10000 },
      { id: 'cleaning', label: 'Usafi & Pest Control', price: 15000 },
      { id: 'painting', label: 'Fundi Rangi & Ujenzi', price: 12000 },
      { id: 'electronics', label: 'TV, Solar & Electronics', price: 10000 }
    ];
    const finalizeHandyman = async (fixPhone: string) => {
      const pfxCode = `PFX-${Math.floor(1000 + Math.random() * 9000)}`;
      const vendorId = session.details.selectedVendorId || 'papo-fix-express-team';
      const fixCat = session.details.fixCategory || 'Home Service';
      const selectedName = session.details.selectedName || 'Fundi';
      const selectedPrice = session.details.selectedPrice || 10000;
      const fixDesc = session.details.fixDescription || '';
      const custName = session.details.customerName || 'Meta PapoFix Client';

      session.step = 'START';
      delete session.service;
      session.details = preserveCustomerFields(session.details, lang);
      await saveMetaSession(session, dbAdmin);

      await triggerAutomatedOrder(
        dbAdmin,
        vendorId,
        'handyman',
        [{
          name: `${fixCat}: ${selectedName}`,
          price: selectedPrice,
          quantity: 1
        }],
        selectedPrice,
        fixPhone,
        custName,
        `PapoFix #${pfxCode} | ${fixDesc}`,
        session.channel,
        {
          bookingCode: pfxCode,
          service: 'PapoFix',
          vendorCategory: 'handyman',
          vendorName: selectedName,
          subCategory: fixCat,
          description: fixDesc,
          deliveryAddress: fixDesc,
          orderType: 'booking'
        }
      );

      return (
        `🛠️ *OMBI LA PAPOFIX LIMETHIBITISHWA!*\n` +
        `🔖 Namba ya Booking: *#${pfxCode}*\n\n` +
        `- Huduma: *${fixCat}*\n` +
        `- Fundi: *${selectedName}*\n` +
        `- Maelezo: *${fixDesc}*\n` +
        `- Ada ya Ukaguzi: *TZS ${selectedPrice.toLocaleString()}*\n` +
        `- Simu: *${fixPhone}*\n\n` +
        `🔗 *Fuatilia booking & oda zako zote:*\n${buildOrdersTrackingUrl(fixPhone, pfxCode)}\n\n` +
        `Fundi atakupigia hivi punde kuanza kazi! Ahsante kwa kutumia PapoFix. ✨`
      );
    };

    const inFixFlow = ['FIX_SELECT_CAT', 'FIX_SELECT_VENDOR', 'FIX_DESCRIBE_PROBLEM', 'COLLECTING_PHONE'].includes(session.step);

    if (!inFixFlow) {
      const directCat = FIX_CATEGORIES.find((c) => {
        const lower = input.toLowerCase();
        return (
          (c.id === 'electrician' && /\b(umeme|wiring|switch|taa|socket)\b/i.test(lower)) ||
          (c.id === 'plumbing' && /\b(bomba|pipe|choo|sink|maji)\b/i.test(lower)) ||
          (c.id === 'appliances' && /\b(ac|friji|fridge|machine|kiyoyozi)\b/i.test(lower)) ||
          (c.id === 'carpentry' && /\b(mbao|kitasa|lock|mlango|kabati)\b/i.test(lower)) ||
          (c.id === 'cleaning' && /\b(usafi|cleaning|wadudu|fumigation|mende)\b/i.test(lower)) ||
          (c.id === 'painting' && /\b(rangi|ujenzi|tiles|ukuta)\b/i.test(lower)) ||
          (c.id === 'electronics' && /\b(tv|solar|dishi|cctv|electronic)\b/i.test(lower))
        );
      });

      if (!directCat) {
        session.step = 'FIX_SELECT_CAT';
        await saveMetaSession(session, dbAdmin);
        let msg = `🛠️ *PapoFix — Huduma za Mafundi & Matengenezo*\n\nUnahitaji fundi wa aina gani leo?\n\n`;
        FIX_CATEGORIES.forEach((cat, idx) => {
          msg += `*${idx + 1}. ${cat.label}* (Ukaguzi kuanzia TZS ${cat.price.toLocaleString()})\n`;
        });
        msg += `\nAndika namba (*1–${FIX_CATEGORIES.length}*):`;
        return msg;
      }

      session.details.fixCategory = directCat.label;
      session.details.fixBasePrice = directCat.price;
      const pros = await fetchCatalogItemsForMeta(dbAdmin, 'handyman', directCat.label, [
        { id: 'hnd-m1', vendorId: 'papo-fix-express-team', name: 'Fundi Kassim (Master Specialist)', price: directCat.price, desc: `${directCat.label} • Anafika dk 30` },
        { id: 'hnd-m2', vendorId: 'papo-fix-express-team', name: 'PapoFix Emergency Team', price: directCat.price + 5000, desc: `Wataalamu wa ${directCat.label}` },
        { id: 'hnd-m3', vendorId: 'papo-fix-express-team', name: 'Fundi Juma & Solutions', price: directCat.price, desc: `${directCat.label} • Uhakika 100%` }
      ]);
      session.details.optionsList = pros;
      session.step = 'FIX_SELECT_VENDOR';
      await saveMetaSession(session, dbAdmin);

      let msg = `🛠️ *PapoFix — ${directCat.label}*\nChagua Fundi aliye karibu nawe:\n\n`;
      pros.forEach((p, idx) => {
        msg += `*${idx + 1}. ${p.name}*\n${p.desc ? `📌 ${p.desc}\n` : ''}💰 Ada ya Ukaguzi: *TZS ${p.price.toLocaleString()}*\n\n`;
      });
      msg += `Andika namba ya Fundi (*1–${pros.length}*):`;
      return msg;
    }

    if (session.step === 'FIX_SELECT_CAT') {
      const idx = parseInt(input, 10) - 1;
      const cat = FIX_CATEGORIES[idx];
      if (!cat) {
        return `⚠️ Tafadhali chagua namba sahihi (*1–${FIX_CATEGORIES.length}*):`;
      }
      session.details.fixCategory = cat.label;
      session.details.fixBasePrice = cat.price;
      const pros = await fetchCatalogItemsForMeta(dbAdmin, 'handyman', cat.label, [
        { id: 'hnd-m1', vendorId: 'papo-fix-express-team', name: 'Fundi Kassim (Master Specialist)', price: cat.price, desc: `${cat.label} • Anafika dk 30` },
        { id: 'hnd-m2', vendorId: 'papo-fix-express-team', name: 'PapoFix Emergency Team', price: cat.price + 5000, desc: `Wataalamu wa ${cat.label}` },
        { id: 'hnd-m3', vendorId: 'papo-fix-express-team', name: 'Fundi Juma & Solutions', price: cat.price, desc: `${cat.label} • Uhakika 100%` }
      ]);
      session.details.optionsList = pros;
      session.step = 'FIX_SELECT_VENDOR';
      await saveMetaSession(session, dbAdmin);

      appendMediaItems(
        mediaCollector,
        pros.filter((p) => p.imageUrl).map((p, i) => ({
          url: p.imageUrl,
          caption: `*${i + 1}. ${p.name}* — TZS ${p.price.toLocaleString()}`
        }))
      );

      let msg = `🛠️ *Mafundi wa ${cat.label}*:\n\n`;
      pros.forEach((p, i) => {
        msg += `*${i + 1}. ${p.name}*\n${p.desc ? `📌 ${p.desc}\n` : ''}💰 Ada ya Ukaguzi: *TZS ${p.price.toLocaleString()}*\n\n`;
      });
      msg += `Andika namba ya Fundi unayechagua (*1–${pros.length}*):`;
      return msg;
    }

    if (session.step === 'FIX_SELECT_VENDOR') {
      const idx = parseInt(input, 10) - 1;
      const selected = session.details.optionsList?.[idx];
      if (!selected) {
        return `⚠️ Chaguo si sahihi. Chagua *1–${session.details.optionsList?.length || 3}*:`;
      }
      session.details.selectedId = selected.id;
      session.details.selectedVendorId = selected.vendorId || 'papo-fix-express-team';
      session.details.selectedName = selected.name;
      session.details.selectedPrice = selected.price;
      session.step = 'FIX_DESCRIBE_PROBLEM';
      await saveMetaSession(session, dbAdmin);

      return `✅ Umechagua *${selected.name}*.\n\n📝 Tafadhali andika *maelezo mafupi ya tatizo* na *eneo ulipo* (Mfano: *Bomba la jikoni linavuja, Sinza Mori*):`;
    }

    if (session.step === 'FIX_DESCRIBE_PROBLEM') {
      const descVal = input.trim();
      if (descVal.length < 3) {
        return `⚠️ Tafadhali eleza tatizo na eneo ulipo (Mfano: *Bomba linavuja, Sinza*):`;
      }
      session.details.fixDescription = descVal;
      if (knownPhone) {
        return await finalizeHandyman(knownPhone);
      }
      session.step = 'COLLECTING_PHONE';
      await saveMetaSession(session, dbAdmin);
      return `📞 Tutumie namba gani Fundi awasiliane nawe?\nAndika namba yako ya simu (Mfano: *0712345678*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      let fixPhone = input.trim();
      if ((fixPhone === '1' || fixPhone.toUpperCase() === 'NDIO') && waDigitsFallback.length >= 9) {
        fixPhone = `+${waDigitsFallback}`;
      }
      if (fixPhone.replace(/\D/g, '').length < 9) {
        return `⚠️ Tafadhali weka namba sahihi ya simu (Mfano: *0712345678*):`;
      }
      await savePhonePref(fixPhone);
      return await finalizeHandyman(fixPhone);
    }
  }

  // PAPOMALL (ONLINE SHOPPING / E-COMMERCE FLOW)
  if (service === 'ecommerce') {
    const inMallStep = ['MALL_SELECT_ITEM', 'MALL_QUANTITY', 'MALL_DELIVERY_ADDRESS', 'SELECTING_PAYMENT_METHOD', 'COLLECTING_PHONE'].includes(session.step);
    const isMenuPick = /^\d{1,2}$/.test(input.trim()) || /^(papomall|maduka|duka|mall|shopping)$/i.test(input.trim());

    const finalizeMall = async (mallPhone: string) => {
      const mlCode = `ML-${Math.floor(1000 + Math.random() * 9000)}`;
      const qty = session.details.mallQty || 1;
      const totalAmt = session.details.mallTotal || session.details.selectedPrice || 0;
      const vendorId = session.details.selectedVendorId || 'papo-mall-official';
      const vendorName = session.details.selectedVendorName || 'PapoMall Store';
      const selectedId = session.details.selectedId;
      const selectedName = session.details.selectedName || 'Bidhaa';
      const selectedPrice = session.details.selectedPrice || 0;
      const deliveryAddr = session.details.deliveryAddress || '';
      const payMethod = session.details.paymentMethod || 'cash';
      const payMethodLabel = session.details.paymentMethodLabel || 'Cash';
      const custName = session.details.customerName || 'Meta PapoMall Client';

      session.step = 'START';
      delete session.service;
      session.details = preserveCustomerFields(session.details, lang);
      await saveMetaSession(session, dbAdmin);

      await triggerAutomatedOrder(
        dbAdmin,
        vendorId,
        'ecommerce',
        [{ id: selectedId, name: selectedName, price: selectedPrice, quantity: qty }],
        totalAmt,
        mallPhone,
        custName,
        `PapoMall #${mlCode} | To: ${deliveryAddr}`,
        session.channel,
        {
          bookingCode: mlCode,
          vendorName,
          deliveryAddress: deliveryAddr,
          paymentMethod: payMethod,
          paymentMethodLabel: payMethodLabel,
          orderType: 'delivery'
        }
      );

      return (
        `🎉 *ODA YA PAPOMALL IMEPOKELEWA!* 🛒\n` +
        `🔖 Namba ya Oda: *#${mlCode}*\n\n` +
        `- Bidhaa: *${selectedName}* x${qty}\n` +
        `- Jumla: *TZS ${totalAmt.toLocaleString()}*\n` +
        `- Malipo: *${payMethodLabel}*\n` +
        `- Eneo: *${deliveryAddr}*\n` +
        `- Simu: *${mallPhone}*\n\n` +
        `🔗 *Fuatilia oda yako & oda zako zote:*\n${buildOrdersTrackingUrl(mallPhone, mlCode)}\n\n` +
        `Duka limepokea oda yako na linaandaa usafirishaji sasa! 🙏`
      );
    };

    if (!inMallStep) {
      const searchQ = isMenuPick ? undefined : cleaned;
      const products = await fetchCatalogItemsForMeta(dbAdmin, 'ecommerce', searchQ, [
        {
          id: 'mall-m1',
          vendorId: 'papo-mall-official',
          name: 'Sneakers Classic Sports (Original)',
          price: 45000,
          desc: 'Size 39–44 • Rangi Mbalimbali',
          imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'mall-m2',
          vendorId: 'papo-mall-official',
          name: 'Smart Watch Ultra Pro (Calls & Fitness)',
          price: 65000,
          desc: 'Bluetooth • Water Resistant',
          imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'mall-m3',
          vendorId: 'papo-mall-official',
          name: 'Wireless Earbuds Bass Pro',
          price: 35000,
          desc: 'Betri Saa 24 • Noise Canceling',
          imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80'
        }
      ]);
      session.details.optionsList = products;
      session.step = 'MALL_SELECT_ITEM';
      await saveMetaSession(session, dbAdmin);

      appendMediaItems(
        mediaCollector,
        products.map((p, idx) => ({
          url: p.imageUrl,
          caption: `*${idx + 1}. ${p.name}* — *TZS ${p.price.toLocaleString()}*${p.desc ? `\n${p.desc}` : ''}`
        }))
      );

      let msg = `🛒 *PapoMall — Maduka & Soko la Mtandaoni*\n\n`;
      if (searchQ) msg += `Matokeo kwa: *"${searchQ}"*\n\n`;
      products.forEach((p, idx) => {
        msg += `*${idx + 1}. ${p.name}*\n${p.desc ? `📌 ${p.desc}\n` : ''}💰 Bei: *TZS ${p.price.toLocaleString()}*\n\n`;
      });
      msg += `Andika namba ya bidhaa unayotaka kununua (*1–${products.length}*):`;
      return msg;
    }

    if (session.step === 'MALL_SELECT_ITEM') {
      const idx = parseInt(input, 10) - 1;
      const selected = session.details.optionsList?.[idx];
      if (!selected) {
        return `⚠️ Tafadhali chagua namba sahihi (*1–${session.details.optionsList?.length || 3}*):`;
      }
      session.details.selectedId = selected.id;
      session.details.selectedVendorId = selected.vendorId || 'papo-mall-official';
      session.details.selectedVendorName = selected.vendorName || 'PapoMall Store';
      session.details.selectedName = selected.name;
      session.details.selectedPrice = selected.price;
      session.step = 'MALL_QUANTITY';
      await saveMetaSession(session, dbAdmin);
      return `🛍️ Umechagua: *${selected.name}* (*TZS ${selected.price.toLocaleString()}*)\n\nUnahitaji idadi ngapi? (Andika mfano: *1*, *2*, *3*):`;
    }

    if (session.step === 'MALL_QUANTITY') {
      const qty = Math.max(1, parseInt(input.replace(/\D/g, ''), 10) || 1);
      session.details.mallQty = qty;
      session.details.mallTotal = (session.details.selectedPrice || 0) * qty;
      session.step = 'MALL_DELIVERY_ADDRESS';
      await saveMetaSession(session, dbAdmin);
      if (savedLoc?.name) {
        return `✅ Idadi: *${qty}* — Jumla: *TZS ${session.details.mallTotal.toLocaleString()}*\n\n📍 Tukuletée *eneo gani*?\n1. 📍 Tumia *${savedLoc.name}*\n_Au andika eneo jingine / tuma 📍 Location:_`;
      }
      return `✅ Idadi: *${qty}* — Jumla: *TZS ${session.details.mallTotal.toLocaleString()}*\n\n📍 Tafadhali andika *eneo/mtaa wa kuletewa* mzigo (Mfano: *Sinza Kumekucha* au tuma 📍 *Location*):`;
    }

    if (session.step === 'MALL_DELIVERY_ADDRESS') {
      let addr = input.trim();
      if (addr === '1' && savedLoc?.name) {
        addr = savedLoc.name;
      } else if (addr.length >= 2) {
        await saveLocPref({ name: addr, address: addr });
      }
      session.details.deliveryAddress = addr;
      session.step = 'SELECTING_PAYMENT_METHOD';
      await saveMetaSession(session, dbAdmin);
      return `📍 Eneo la kuletewa: *${addr}*\nJumla: *TZS ${(session.details.mallTotal || session.details.selectedPrice || 0).toLocaleString()}*\n\n💳 *CHAGUA NJIA YA MALIPO:*\n1. 💵 *Cash* (Lipa ukipokea)\n2. 📱 *M-Pesa*\n3. 📱 *Tigo Pesa (Mixx by Yas)*\n4. 📱 *Airtel Money*`;
    }

    if (session.step === 'SELECTING_PAYMENT_METHOD') {
      const pChoice = input.trim();
      let payLabel = 'Cash (Pesa Taslimu) 💵';
      let payMethod = 'cash';
      if (pChoice === '2' || pChoice.toLowerCase().includes('mpesa')) { payLabel = 'M-Pesa 📱'; payMethod = 'mpesa'; }
      else if (pChoice === '3' || pChoice.toLowerCase().includes('tigo') || pChoice.toLowerCase().includes('yas')) { payLabel = 'Tigo Pesa (Mixx by Yas) 📱'; payMethod = 'tigopesa'; }
      else if (pChoice === '4' || pChoice.toLowerCase().includes('airtel')) { payLabel = 'Airtel Money 📱'; payMethod = 'airtel'; }
      session.details.paymentMethod = payMethod;
      session.details.paymentMethodLabel = payLabel;
      if (knownPhone) {
        return await finalizeMall(knownPhone);
      }
      session.step = 'COLLECTING_PHONE';
      await saveMetaSession(session, dbAdmin);
      return `💳 Malipo: *${payLabel}*\n\n📞 Andika *namba yako ya simu* kwa uthibitisho (Mfano: *0712345678*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      let mallPhone = input.trim();
      if ((mallPhone === '1' || mallPhone.toUpperCase() === 'NDIO') && waDigitsFallback.length >= 9) {
        mallPhone = `+${waDigitsFallback}`;
      }
      if (mallPhone.replace(/\D/g, '').length < 9) {
        return `⚠️ Tafadhali weka namba sahihi ya simu (Mfano: *0712345678*):`;
      }
      await savePhonePref(mallPhone);
      return await finalizeMall(mallPhone);
    }
  }

  // PAPOTICKET (EVENTS, SPORTS & CONCERTS TICKETS FLOW)
  if (service === 'events') {
    const FEATURED_EVENTS = [
      {
        id: 'simba-vs-yanga-2026',
        title: 'Kariakoo Derby: Simba SC vs Yanga SC',
        venue: 'Uwanja wa Benjamin Mkapa, Dar',
        date: 'Jumamosi • 17:00 EAT',
        imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop',
        tiers: [
          { name: 'Mzunguko (Regular)', price: 10000 },
          { name: 'VIP B & C', price: 30000 },
          { name: 'VIP A & Lounge', price: 100000 }
        ]
      },
      {
        id: 'bongo-flava-mega-fest-2026',
        title: 'Dar Mega Bongo Flava Live Concert',
        venue: 'Mlimani City Arena, Dar',
        date: 'Ijumaa • 20:00 EAT',
        imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop',
        tiers: [
          { name: 'Regular Pass', price: 20000 },
          { name: 'VIP Ticket', price: 60000 },
          { name: 'VVIP Table (Watu 6)', price: 600000 }
        ]
      },
      {
        id: 'swahili-comedy-night',
        title: 'Usiku wa Vichekesho (Standup Laugh Fest)',
        venue: 'JNICC, Posta Dar',
        date: 'Jumapili • 19:00 EAT',
        imageUrl: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800&auto=format&fit=crop',
        tiers: [
          { name: 'Kiti cha Kawaida', price: 25000 },
          { name: 'VIP Front Row', price: 75000 }
        ]
      }
    ];

    const finalizeEventTicket = async (tkPhone: string) => {
      const tkCode = `TK-${Math.floor(1000 + Math.random() * 9000)}`;
      const ev = session.details.selectedEvent || {};
      const tier = session.details.selectedTier || {};
      const count = session.details.ticketCount || 1;
      const total = session.details.ticketTotal || Number(tier.price || 10000) * count;
      const custName = session.details.customerName || 'Meta PapoTicket Client';

      session.step = 'START';
      delete session.service;
      session.details = preserveCustomerFields(session.details, lang);
      await saveMetaSession(session, dbAdmin);

      await triggerAutomatedOrder(
        dbAdmin,
        'papo-ticket-events',
        'events',
        [{ name: `${ev.title || 'Event'} (${tier.name || 'Pass'})`, price: Number(tier.price || total), quantity: count }],
        total,
        tkPhone,
        custName,
        `PapoTicket #${tkCode} | ${ev.title} | ${ev.venue}`,
        session.channel,
        {
          bookingCode: tkCode,
          vendorName: 'PapoTicket Events',
          service: 'PapoTicket',
          deliveryAddress: ev.venue || 'Venue',
          orderType: 'booking'
        }
      );

      return (
        `🎟️ *TIKETI YAKO YA PAPOTICKET IMETOLEWA!*\n` +
        `🔖 Namba ya Tiketi: *#${tkCode}*\n\n` +
        `- Tukio: *${ev.title}*\n` +
        `- Ukumbi: *${ev.venue}* (${ev.date || ''})\n` +
        `- Daraja: *${tier.name}* x${count}\n` +
        `- Jumla: *TZS ${total.toLocaleString()}*\n` +
        `- Simu: *${tkPhone}*\n\n` +
        `🔗 *Pakua / Fuatilia Tiketi & Oda Zako Zote:*\n${buildOrdersTrackingUrl(tkPhone, tkCode)}\n\n` +
        `Tumetuma ombi la malipo kwenye simu yako *${tkPhone}*. Ukithibitisha, tiketi yako ya QR itafunguka papo hapo! 🎉`
      );
    };

    const inEventStep = ['EVENT_SELECT', 'EVENT_SELECT_TIER', 'EVENT_QUANTITY', 'COLLECTING_PHONE'].includes(session.step);
    if (!inEventStep) {
      let eventsList = [...FEATURED_EVENTS];
      if (dbAdmin) {
        try {
          const evSnap = await dbAdmin.collection('events').limit(6).get();
          if (!evSnap.empty) {
            const dbEvents: any[] = [];
            evSnap.docs.forEach((d: any) => {
              const ev = d.data() || {};
              dbEvents.push({
                id: d.id,
                title: ev.title || ev.name || 'Tukio Maalum',
                venue: ev.venue || ev.location || 'Tanzania',
                date: ev.date || 'Hivi Karibuni',
                imageUrl: resolvePublicImageUrl(ev.banner || ev.imageUrl || ''),
                tiers: Array.isArray(ev.tiers) && ev.tiers.length > 0
                  ? ev.tiers
                  : [{ name: 'Regular Pass', price: Number(ev.price || 15000) }]
              });
            });
            if (dbEvents.length > 0) eventsList = dbEvents;
          }
        } catch {}
      }
      session.details.eventOptions = eventsList;
      session.step = 'EVENT_SELECT';
      await saveMetaSession(session, dbAdmin);

      appendMediaItems(
        mediaCollector,
        eventsList.filter((e) => e.imageUrl).map((e, i) => ({
          url: e.imageUrl,
          caption: `*${i + 1}. ${e.title}*\n📍 ${e.venue} • 🗓️ ${e.date}`
        }))
      );

      let msg = `🎟️ *PapoTicket — Tiketi za Mechi & Matamasha*\n\nChagua tukio unalotaka kukata tiketi:\n\n`;
      eventsList.forEach((ev, idx) => {
        const minP = Math.min(...ev.tiers.map((t: any) => Number(t.price) || 10000));
        msg += `*${idx + 1}. ${ev.title}*\n📍 ${ev.venue} • 🗓️ ${ev.date}\n💰 Kuanzia *TZS ${minP.toLocaleString()}*\n\n`;
      });
      msg += `Andika namba ya tukio (*1–${eventsList.length}*):`;
      return msg;
    }

    if (session.step === 'EVENT_SELECT') {
      const idx = parseInt(input, 10) - 1;
      const ev = session.details.eventOptions?.[idx];
      if (!ev) {
        return `⚠️ Tafadhali chagua namba sahihi (*1–${session.details.eventOptions?.length || 3}*):`;
      }
      session.details.selectedEvent = ev;
      session.step = 'EVENT_SELECT_TIER';
      await saveMetaSession(session, dbAdmin);

      let msg = `🎟️ *${ev.title}*\n📍 ${ev.venue}\n\nChagua daraja la tiketi:\n\n`;
      (ev.tiers || []).forEach((tier: any, tIdx: number) => {
        msg += `*${tIdx + 1}. ${tier.name}* — *TZS ${Number(tier.price).toLocaleString()}*\n`;
      });
      msg += `\nAndika namba ya daraja (*1–${ev.tiers?.length || 1}*):`;
      return msg;
    }

    if (session.step === 'EVENT_SELECT_TIER') {
      const ev = session.details.selectedEvent;
      const idx = parseInt(input, 10) - 1;
      const tier = ev?.tiers?.[idx];
      if (!tier) {
        return `⚠️ Tafadhali chagua namba ya daraja (*1–${ev?.tiers?.length || 1}*):`;
      }
      session.details.selectedTier = tier;
      session.step = 'EVENT_QUANTITY';
      await saveMetaSession(session, dbAdmin);
      return `✅ Umechagua: *${tier.name}* (*TZS ${Number(tier.price).toLocaleString()}* kwa tiketi 1)\n\nUnahitaji tiketi ngapi? (Andika mfano: *1*, *2*, *4*):`;
    }

    if (session.step === 'EVENT_QUANTITY') {
      const count = Math.max(1, parseInt(input.replace(/\D/g, ''), 10) || 1);
      const unitPrice = Number(session.details.selectedTier?.price || 10000);
      session.details.ticketCount = count;
      session.details.ticketTotal = count * unitPrice;
      if (knownPhone) {
        return await finalizeEventTicket(knownPhone);
      }
      session.step = 'COLLECTING_PHONE';
      await saveMetaSession(session, dbAdmin);
      return `🎟️ Tiketi *${count}* x *${session.details.selectedTier?.name}*\nJumla: *TZS ${session.details.ticketTotal.toLocaleString()}*\n\n📞 Andika *namba yako ya simu* kwa malipo & kutuma tiketi (Mfano: *0712345678*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      let tkPhone = input.trim();
      if ((tkPhone === '1' || tkPhone.toUpperCase() === 'NDIO') && waDigitsFallback.length >= 9) {
        tkPhone = `+${waDigitsFallback}`;
      }
      if (tkPhone.replace(/\D/g, '').length < 9) {
        return `⚠️ Tafadhali weka namba sahihi ya simu (Mfano: *0712345678*):`;
      }
      await savePhonePref(tkPhone);
      return await finalizeEventTicket(tkPhone);
    }
  }

  // PAPOPAY (WALLET, LIPA PAPO & WAKALA FLOW)
  if (service === 'papopay') {
    const publicBaseUrl = (process.env.APP_PUBLIC_URL || 'https://dereva-tz.onrender.com').replace(/\/+$/, '');
    const inPayStep = ['PAPOPAY_MENU', 'PAPOPAY_PAY_TARGET', 'PAPOPAY_PAY_AMOUNT', 'COLLECTING_PHONE'].includes(session.step);

    const finalizePapoPay = async (payPhone: string) => {
      const ppCode = `PP-${Math.floor(1000 + Math.random() * 9000)}`;
      const amt = session.details.payAmount || 5000;
      const target = session.details.payTarget || 'PapoPay Merchant';
      const custName = session.details.customerName || 'Meta PapoPay Client';

      session.step = 'START';
      delete session.service;
      session.details = preserveCustomerFields(session.details, lang);
      await saveMetaSession(session, dbAdmin);

      await triggerAutomatedOrder(
        dbAdmin,
        'papopay-express',
        'papopay',
        [{ name: `PapoPay Payment: ${target}`, price: amt, quantity: 1 }],
        amt,
        payPhone,
        custName,
        `PapoPay #${ppCode} | Target: ${target}`,
        session.channel,
        {
          bookingCode: ppCode,
          vendorName: 'PapoPay Express',
          service: 'PapoPay',
          deliveryAddress: target,
          orderType: 'payment'
        }
      );

      return (
        `📲 *OMBI LA MALIPO LA PAPOPAY LIMETUMWA!*\n` +
        `🔖 Rejea: *#${ppCode}*\n\n` +
        `- Mpokeaji / Bili: *${target}*\n` +
        `- Kiasi: *TZS ${amt.toLocaleString()}*\n` +
        `- Simu ya Malipo: *${payPhone}*\n\n` +
        `🔗 *Fuatilia Muamala & Risiti Zako:*\n${buildOrdersTrackingUrl(payPhone, ppCode)}\n\n` +
        `Ingiza PIN yako kwenye ujumbe uliotumwa kwenye simu yako *${payPhone}* kukamilisha malipo. 🔐`
      );
    };

    if (!inPayStep) {
      session.step = 'PAPOPAY_MENU';
      await saveMetaSession(session, dbAdmin);
      return (
        `💳 *PapoPay — Lipa Papo & PapoWallet*\n\nChagua huduma ya malipo unayohitaji:\n\n` +
        `1. 💰 *Angalia Salio la PapoWallet & Pointi*\n` +
        `2. 📲 *Lipa Dereva / Mgahawa / Bili (PapoPay)*\n` +
        `3. 🏪 *Tafuta Wakala wa PapoPay Karibu*\n` +
        `4. 🔗 *Fungua PapoPay Kwenye Mtandao*\n\n` +
        `Andika namba (*1–4*):`
      );
    }

    if (session.step === 'PAPOPAY_MENU') {
      const choice = input.trim();
      if (choice === '1') {
        const lookupPhone = knownPhone || session.details.phone || (waDigitsFallback.length >= 9 ? `+${waDigitsFallback}` : '');
        let walletBalance = 0;
        let points = 0;
        let foundUser = false;
        if (dbAdmin && lookupPhone) {
          const { phoneVariants } = buildPhoneVariants(lookupPhone);
          for (const field of ['phone', 'phoneNumber']) {
            if (foundUser || phoneVariants.length === 0) break;
            try {
              const uSnap = await dbAdmin.collection('users').where(field, 'in', phoneVariants).limit(1).get();
              if (!uSnap.empty) {
                const u = uSnap.docs[0].data() || {};
                walletBalance = Number(u.walletBalance || 0);
                points = Number(u.points || 0);
                foundUser = true;
              }
            } catch {}
          }
        }
        session.step = 'START';
        delete session.service;
        session.details = preserveCustomerFields(session.details, lang);
        await saveMetaSession(session, dbAdmin);

        return (
          `💰 *SALIO LA PAPOWALLET*\n\n` +
          `- Simu: *${lookupPhone || 'Bila namba'}*\n` +
          `- Salio la PapoWallet: *TZS ${walletBalance.toLocaleString()}*\n` +
          `- PapoPoints: *${points.toLocaleString()} pts*\n` +
          `${!foundUser ? `\n_Kumbuka: Unaweza kuweka pesa kupitia Wakala wa PapoPay au app kuongeza salio lako._\n` : ''}` +
          `\n🔗 *Dhibiti Wallet yako:* ${publicBaseUrl}/papopay\n\n_(Andika *00* au *Hi* kurudi kwenye Menu)_`
        );
      }

      if (choice === '2') {
        session.step = 'PAPOPAY_PAY_TARGET';
        await saveMetaSession(session, dbAdmin);
        return `📲 *Lipa Kupitia PapoPay*\n\nTafadhali andika *Jina/Namba ya Biashara, Dereva au Bili* unayolipia (Mfano: *LUKU 142536*, *Mgahawa Kisinia*, au *0712345678*):`;
      }

      if (choice === '3') {
        let wakalaMsg = `🏪 *MAWAKALA WA PAPOPAY KARIBU NAWE*\n\n`;
        let foundAny = false;
        if (dbAdmin) {
          try {
            const wSnap = await dbAdmin.collection('users').where('role', '==', 'wakala').limit(5).get();
            if (!wSnap.empty) {
              foundAny = true;
              wSnap.docs.forEach((d: any, i: number) => {
                const w = d.data() || {};
                wakalaMsg += `*${i + 1}. ${w.businessName || w.displayName || w.name || 'Wakala wa PapoPay'}*\n📍 ${w.address || 'Dar es Salaam'} ${w.phone ? `• 📞 ${w.phone}` : ''}\n\n`;
              });
            }
          } catch {}
        }
        if (!foundAny) {
          wakalaMsg += `Unaweza kuweka au kutoa pesa kwa Wakala yeyote mwenye alama ya *PapoPay Wakala*.\n\n`;
        }
        session.step = 'START';
        delete session.service;
        session.details = preserveCustomerFields(session.details, lang);
        await saveMetaSession(session, dbAdmin);
        return `${wakalaMsg}🔗 *Tafuta Wakala & Lipa Mtandaoni:* ${publicBaseUrl}/papopay`;
      }

      if (choice === '4') {
        session.step = 'START';
        delete session.service;
        session.details = preserveCustomerFields(session.details, lang);
        await saveMetaSession(session, dbAdmin);
        return `💳 *PapoPay Digital Wallet & Lipa Papo*\n\nFungua ukurasa wako wa PapoPay kufanya malipo ya QR, kadi ya mwanafunzi, LUKU/DAWASCO na kuhamisha pesa:\n👉 ${publicBaseUrl}/papopay`;
      }

      return `⚠️ Tafadhali chagua *1*, *2*, *3* au *4*:`;
    }

    if (session.step === 'PAPOPAY_PAY_TARGET') {
      session.details.payTarget = input.trim();
      session.step = 'PAPOPAY_PAY_AMOUNT';
      await saveMetaSession(session, dbAdmin);
      return `✅ Unalipia: *${session.details.payTarget}*\n\n💰 Andika *kiasi cha TZS* unacholipa (Mfano: *5000* au *25000*):`;
    }

    if (session.step === 'PAPOPAY_PAY_AMOUNT') {
      const amt = parseInt(input.replace(/\D/g, ''), 10);
      if (!amt || amt < 100) {
        return `⚠️ Tafadhali weka kiasi sahihi kwa tarakimu (Mfano: *5000*):`;
      }
      session.details.payAmount = amt;
      if (knownPhone) {
        return await finalizePapoPay(knownPhone);
      }
      session.step = 'COLLECTING_PHONE';
      await saveMetaSession(session, dbAdmin);
      return `💳 Kiasi: *TZS ${amt.toLocaleString()}* kwenda *${session.details.payTarget}*\n\n📞 Andika *namba yako ya simu* kupokea ombi la malipo (Mfano: *0712345678*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      let payPhone = input.trim();
      if ((payPhone === '1' || payPhone.toUpperCase() === 'NDIO') && waDigitsFallback.length >= 9) {
        payPhone = `+${waDigitsFallback}`;
      }
      if (payPhone.replace(/\D/g, '').length < 9) {
        return `⚠️ Tafadhali weka namba sahihi ya simu (Mfano: *0712345678*):`;
      }
      await savePhonePref(payPhone);
      return await finalizePapoPay(payPhone);
    }
  }

  // Reset to default
  session.step = 'START';
  delete session.service;
  session.details = preserveCustomerFields(session.details, lang);
  await saveMetaSession(session, dbAdmin);

  let servicesConfig: any = {};
  if (dbAdmin) {
    try {
      const bizSnap = await dbAdmin.collection('config').doc('business').get();
      if (bizSnap.exists) {
        servicesConfig = bizSnap.data().services || {};
      }
    } catch (bizErr) {
      console.warn('[Meta Bot] Failed to fetch services config in routeToServiceFlow:', bizErr);
    }
  }
  const chSymbol = channel === 'whatsapp' ? '🟢 WhatsApp' : channel === 'instagram' ? '📸 Instagram' : '🔵 Messenger';
  return generateDynamicWelcomeMessage(servicesConfig, chSymbol, undefined, session.details.customerName, lang);
}

/**
 * Sends a real outbound reply (optional image cards + text) via Meta Graph API
 * (WhatsApp Cloud API / Messenger / Instagram)
 */
export async function sendMetaOutboundMessage(params: {
  channel: 'whatsapp' | 'messenger' | 'instagram';
  recipientId: string;
  text: string;
  phoneNumberId?: string;
  media?: MetaMediaAttachment[];
}): Promise<{ sent: boolean; reason?: string }> {
  const { channel, recipientId, text, phoneNumberId, media } = params;
  if (!recipientId || !text) {
    return { sent: false, reason: 'Missing recipientId or text' };
  }

  try {
    if (channel === 'whatsapp') {
      const accessToken = (
        process.env.META_WHATSAPP_ACCESS_TOKEN ||
        process.env.WHATSAPP_ACCESS_TOKEN ||
        process.env.META_ACCESS_TOKEN ||
        ''
      ).trim();

      const resolvedPhoneId = (
        phoneNumberId ||
        process.env.META_WHATSAPP_PHONE_NUMBER_ID ||
        process.env.WHATSAPP_PHONE_NUMBER_ID ||
        ''
      ).trim();

      if (!accessToken || !resolvedPhoneId) {
        console.warn('[Meta Outbound] Skipping WhatsApp send: missing META_WHATSAPP_ACCESS_TOKEN or phoneNumberId');
        return { sent: false, reason: 'Missing META_WHATSAPP_ACCESS_TOKEN or phoneNumberId' };
      }

      // Send up to 4 image cards first so the customer sees real food/product/room photos above the numbered prompt
      if (Array.isArray(media) && media.length > 0) {
        for (const item of media.slice(0, 4)) {
          try {
            let imagePayload: Record<string, any> | null = null;
            if (item.url.startsWith('data:image/')) {
              const match = item.url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
              if (match) {
                const mimeType = match[1];
                const buffer = Buffer.from(match[2], 'base64');
                const ext = mimeType.split('/')[1] || 'jpg';
                const form = new FormData();
                form.append('messaging_product', 'whatsapp');
                form.append('type', mimeType);
                form.append('file', new Blob([buffer], { type: mimeType }), `item.${ext}`);
                const uploadResp = await fetch(`https://graph.facebook.com/v21.0/${resolvedPhoneId}/media`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${accessToken}` },
                  body: form,
                });
                const uploadData = await uploadResp.json().catch(() => ({}));
                if (uploadResp.ok && uploadData?.id) {
                  imagePayload = {
                    id: uploadData.id,
                    ...(item.caption ? { caption: item.caption.slice(0, 1024) } : {}),
                  };
                }
              }
            } else if (item.url.startsWith('https://') || item.url.startsWith('http://')) {
              imagePayload = {
                link: item.url,
                ...(item.caption ? { caption: item.caption.slice(0, 1024) } : {}),
              };
            }

            if (imagePayload) {
              const imgResp = await fetch(`https://graph.facebook.com/v21.0/${resolvedPhoneId}/messages`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  to: recipientId,
                  type: 'image',
                  image: imagePayload,
                }),
              });
              if (!imgResp.ok) {
                const imgErr = await imgResp.json().catch(() => ({}));
                console.warn('[Meta Outbound] WhatsApp image send skipped:', imgResp.status, JSON.stringify(imgErr));
              }
            }
          } catch (mediaErr: any) {
            console.warn('[Meta Outbound] Non-fatal error sending WhatsApp image:', mediaErr?.message || mediaErr);
          }
        }
      }

      const resp = await fetch(`https://graph.facebook.com/v21.0/${resolvedPhoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientId,
          type: 'text',
          text: {
            preview_url: false,
            body: text.slice(0, 4096),
          },
        }),
      });

      const respData = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.error('[Meta Outbound] WhatsApp Cloud API error:', resp.status, JSON.stringify(respData));
        return { sent: false, reason: respData?.error?.message || `HTTP ${resp.status}` };
      }

      console.log(`[Meta Outbound] WhatsApp reply sent to ${recipientId} via phoneNumberId=${resolvedPhoneId}`);
      return { sent: true };
    }

    if (channel === 'instagram') {
      const igToken = (process.env.META_INSTAGRAM_ACCESS_TOKEN || '').trim();
      const pageToken = (process.env.META_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || '').trim();
      const token = igToken || pageToken;

      if (!token) {
        return { sent: false, reason: 'Missing META_INSTAGRAM_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN' };
      }

      const endpoint = igToken
        ? `https://graph.instagram.com/v21.0/me/messages`
        : `https://graph.facebook.com/v21.0/me/messages`;

      if (Array.isArray(media) && media.length > 0) {
        for (const item of media.slice(0, 4)) {
          if (!item.url.startsWith('http')) continue;
          try {
            await fetch(endpoint, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                recipient: { id: recipientId },
                message: {
                  attachment: {
                    type: 'image',
                    payload: { url: item.url, is_reusable: true },
                  },
                },
              }),
            });
          } catch {}
        }
      }

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: text.slice(0, 1000) },
        }),
      });

      const respData = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.error(`[Meta Outbound] instagram API error:`, resp.status, JSON.stringify(respData));
        return { sent: false, reason: respData?.error?.message || `HTTP ${resp.status}` };
      }

      console.log(`[Meta Outbound] instagram reply sent to ${recipientId}`);
      return { sent: true };
    }

    const pageToken = (process.env.META_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || '').trim();
    if (!pageToken) {
      return { sent: false, reason: 'Missing META_PAGE_ACCESS_TOKEN' };
    }

    if (Array.isArray(media) && media.length > 0) {
      for (const item of media.slice(0, 4)) {
        if (!item.url.startsWith('http')) continue;
        try {
          await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(pageToken)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { id: recipientId },
              messaging_type: 'RESPONSE',
              message: {
                attachment: {
                  type: 'image',
                  payload: { url: item.url, is_reusable: true },
                },
              },
            }),
          });
        } catch {}
      }
    }

    const resp = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(pageToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: 'RESPONSE',
        message: { text: text.slice(0, 2000) },
      }),
    });

    const respData = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error(`[Meta Outbound] ${channel} API error:`, resp.status, JSON.stringify(respData));
      return { sent: false, reason: respData?.error?.message || `HTTP ${resp.status}` };
    }

    console.log(`[Meta Outbound] ${channel} reply sent to ${recipientId}`);
    return { sent: true };
  } catch (err: any) {
    console.error('[Meta Outbound] Network error:', err?.message || err);
    return { sent: false, reason: err?.message || String(err) };
  }
}

/**
 * Sends real-time Trip Status, Driver Profile, Driver ETA, Live Tracking Map link,
 * and Post-Trip Rating prompt to Meta customers (WhatsApp / Messenger / Instagram).
 */
const notifiedRideStatuses = new Set<string>();

export async function notifyRideStatusToMeta(
  params: {
    rideId: string;
    status: string;
    driverInfo?: any;
    driverLocation?: { lat: number; lng: number };
    rideData?: any;
  },
  dbAdmin: any
): Promise<{ notified: boolean; reason?: string }> {
  const { rideId, status, driverInfo: incomingDriver, driverLocation: incomingLoc, rideData: incomingRide } = params;
  if (!rideId || !status) {
    return { notified: false, reason: 'Missing rideId or status' };
  }

  const dedupKey = `${rideId}:${status}`;
  if (notifiedRideStatuses.has(dedupKey)) {
    return { notified: false, reason: 'Status already notified' };
  }

  try {
    let ride: any = incomingRide || null;
    if (!ride && dbAdmin) {
      const snap = await dbAdmin.collection('rides').doc(rideId).get();
      if (snap.exists) {
        ride = snap.data();
      }
    }

    if (!ride) {
      return { notified: false, reason: 'Ride not found' };
    }

    if (ride.lastMetaNotifiedStatus === status) {
      notifiedRideStatuses.add(dedupKey);
      return { notified: false, reason: 'Status already notified in Firestore' };
    }

    const channel = (ride.metaChannel || ride.channel) as 'whatsapp' | 'messenger' | 'instagram' | undefined;
    const recipientId: string =
      ride.metaSenderId ||
      (typeof ride.customerId === 'string' && ride.customerId.startsWith('meta-client-')
        ? ride.customerId.slice('meta-client-'.length)
        : '');

    if (!channel || !recipientId || !['whatsapp', 'messenger', 'instagram'].includes(channel)) {
      return { notified: false, reason: 'Ride did not originate from a Meta channel' };
    }

    const driver = incomingDriver || ride.driverInfo || {};
    const driverLoc = incomingLoc || ride.driverLocation || null;
    const pickup = ride.pickup || {};
    const dest = ride.destination || {};
    const driverName = driver.name || 'Dereva wa Papo Hapo';
    const driverPhone = driver.phone || '';
    const vehicleModel = driver.vehicle?.model || driver.vehicleModel || 'Gari';
    const vehiclePlate = driver.vehicle?.plate || driver.vehiclePlate || 'Namba ya Gari';
    const vehicleColor = driver.vehicle?.color || '';
    const driverRating = driver.rating ? `${driver.rating} ⭐` : '4.9 ⭐';

    let etaMinutes = 5;
    let distKmText = '';
    if (
      driverLoc &&
      typeof driverLoc.lat === 'number' &&
      typeof driverLoc.lng === 'number' &&
      typeof pickup.lat === 'number' &&
      typeof pickup.lng === 'number'
    ) {
      const km = calculateDistanceKm(driverLoc.lat, driverLoc.lng, pickup.lat, pickup.lng);
      etaMinutes = Math.max(1, Math.round((km / 25) * 60));
      distKmText = ` (umbali *${km.toFixed(1)} km*)`;
    }

    const publicBaseUrl = (process.env.APP_PUBLIC_URL || 'https://dereva-tz.onrender.com').replace(/\/+$/, '');
    const trackUrl = `${publicBaseUrl}/track/${rideId}`;
    const bookingRef = ride.bookingId || rideId;
    const fareText = ride.fare ? `TZS ${Number(ride.fare).toLocaleString()}/=` : '';
    const paymentLabel = ride.paymentMethodLabel || ride.paymentMethod || 'Cash';

    let customerLang: 'sw' | 'en' = 'sw';
    try {
      const custProf = await getMetaCustomerProfile(recipientId, channel, dbAdmin);
      const sess = await getMetaSession(recipientId, channel, dbAdmin);
      customerLang = sess?.details?.lang || custProf?.lang || 'sw';
    } catch {}
    const isEn = customerLang === 'en';

    let message = '';

    if (status === 'accepted' || status === 'driver_arriving') {
      message = isEn
        ? `🎉 *Driver Accepted!* (${bookingRef})\n\n` +
          `👤 *Driver:* ${driverName} (${driverRating})\n` +
          (driverPhone ? `📞 *Phone:* ${driverPhone}\n` : '') +
          `🚘 *Vehicle:* ${vehicleModel}${vehicleColor ? ` (${vehicleColor})` : ''} • *${vehiclePlate}*\n` +
          `⏱️ *ETA:* ~*${etaMinutes} min*\n\n` +
          `📍 Heading to *${pickup.name || 'your pickup'}*.\n` +
          `🗺️ Live Map: ${trackUrl}`
        : `🎉 *Dereva Amekubali Oda Yako!* (${bookingRef})\n\n` +
          `👤 *Dereva:* ${driverName} (${driverRating})\n` +
          (driverPhone ? `📞 *Simu:* ${driverPhone}\n` : '') +
          `🚘 *Gari:* ${vehicleModel}${vehicleColor ? ` (${vehicleColor})` : ''}\n` +
          `🔢 *Namba ya Gari:* *${vehiclePlate}*\n` +
          `⏱️ *Muda wa Kufika (ETA):* ~Dakika *${etaMinutes}*${distKmText}\n\n` +
          `📍 Dereva yuko njiani kuelekea *${pickup.name || 'mahali ulipo'}*.\n` +
          `🗺️ *Fuatilia dereva mubashara:*\n${trackUrl}`;
    } else if (status === 'driver_arrived') {
      message = isEn
        ? `📍 *Driver Has Arrived!* (${bookingRef})\n\n` +
          `*${driverName}* (*${vehicleModel}* • *${vehiclePlate}*) is waiting at *${pickup.name || 'pickup'}*.\n` +
          (driverPhone ? `📞 Call: ${driverPhone}\n` : '') +
          `🗺️ ${trackUrl}`
        : `📍 *Dereva Amefika!* (${bookingRef})\n\n` +
          `Dereva *${driverName}* akiwa na gari *${vehicleModel}* (*${vehiclePlate}*) ameshafika eneo la *${pickup.name || 'kukuchukua'}*.\n` +
          (driverPhone ? `📞 Mpige simu: ${driverPhone}\n` : '') +
          `🗺️ ${trackUrl}`;
    } else if (status === 'on_trip') {
      message = isEn
        ? `🚕 *Trip Started!* (${bookingRef})\n\n` +
          `On your way to *${dest.name || 'destination'}* with *${driverName}* (*${vehiclePlate}*).\n` +
          `🗺️ Live Map: ${trackUrl}`
        : `🚕 *Safari Imeanza!* (${bookingRef})\n\n` +
          `Upo safarini na dereva *${driverName}* (*${vehiclePlate}*) kuelekea *${dest.name || 'unapoenda'}*.\n` +
          `🗺️ *Fuatilia safari mubashara:*\n${trackUrl}`;
    } else if (status === 'completed') {
      message = isEn
        ? `🏁 *Trip Completed!* (${bookingRef})\n\n` +
          `Thanks for riding with *${driverName}* (*${vehiclePlate}*).\n` +
          (fareText ? `💵 *Fare:* *${fareText}* (${paymentLabel})\n\n` : '\n') +
          `⭐ *Rate your driver (reply 1–5):*\n5 ⭐⭐⭐⭐⭐ | 4 ⭐⭐⭐⭐ | 3 ⭐⭐⭐ | 2 ⭐⭐ | 1 ⭐`
        : `🏁 *Safari Imekamilika!* (${bookingRef})\n\n` +
          `Asante kwa kusafiri na *${driverName}* (*${vehiclePlate}*).\n` +
          (fareText ? `💵 *Nauli ya Kulipa:* *${fareText}* (${paymentLabel})\n\n` : '\n') +
          `⭐ *Tafadhali mpe tathmini dereva wako (tuma namba 1 hadi 5):*\n` +
          `5 - Bora kabisa ⭐⭐⭐⭐⭐\n` +
          `4 - Nzuri sana ⭐⭐⭐⭐\n` +
          `3 - Wastani ⭐⭐⭐\n` +
          `2 - Hairidhishi ⭐⭐\n` +
          `1 - Mbaya ⭐`;

      const session = await getMetaSession(recipientId, channel, dbAdmin);
      session.details.ratingRideId = rideId;
      session.details.ratingDriverId = ride.driverId || driver.id || '';
      session.details.ratingDriverName = driverName;
      await saveMetaSession(session, dbAdmin);
    } else if (status === 'cancelled') {
      message = isEn
        ? `❌ *Ride Cancelled* (${bookingRef})\n\nReply *Menu* or *1* to book another ride.`
        : `❌ *Safari Imesitishwa* (${bookingRef})\n\nOda yako imeghairiwa. Andika *Menu* au *1* kuagiza usafiri mwingine papo hapo.`;
    }

    if (!message) {
      return { notified: false, reason: `No template for status: ${status}` };
    }

    notifiedRideStatuses.add(dedupKey);

    const res = await sendMetaOutboundMessage({
      channel,
      recipientId,
      text: message,
    });

    if (dbAdmin) {
      try {
        await dbAdmin.collection('rides').doc(rideId).update({
          lastMetaNotifiedStatus: status,
          lastMetaNotifiedAt: new Date(),
        });
      } catch {
        // ignore non-critical Firestore tracking update failure
      }
    }

    return { notified: res.sent, reason: res.reason };
  } catch (err: any) {
    console.error('[Meta Ride Notify] Error:', err?.message || err);
    return { notified: false, reason: err?.message || String(err) };
  }
}

export interface ExtractedMetaWebhookMessage {
  channel: 'whatsapp' | 'messenger' | 'instagram';
  senderId: string;
  textBody: string;
  phoneNumberId: string;
  messageId: string;
}

const processedMetaMessageIds = new Map<string, number>();
const META_DEDUP_TTL_MS = 24 * 60 * 60 * 1000;
const metaSenderQueues = new Map<string, Promise<void>>();

/**
 * Extracts all actionable incoming messages from a Meta webhook payload
 * (WhatsApp Cloud API, Facebook Messenger, Instagram Messaging), skipping
 * status callbacks, delivery receipts, and echo events.
 */
export function extractMetaWebhookMessages(body: any): ExtractedMetaWebhookMessage[] {
  const results: ExtractedMetaWebhookMessage[] = [];
  if (!body || typeof body !== 'object') return results;

  const entries = Array.isArray(body.entry) ? body.entry : [];

  if (body.object === 'whatsapp_business_account') {
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value;
        if (!value || !Array.isArray(value.messages) || value.messages.length === 0) {
          continue;
        }
        const phoneNumberId = String(value?.metadata?.phone_number_id || '');
        for (const message of value.messages) {
          const senderId = String(message?.from || '').trim();
          const messageId = String(message?.id || '').trim();
          const textBody = String(
            message?.text?.body ||
              message?.interactive?.button_reply?.title ||
              message?.interactive?.list_reply?.title ||
              message?.button?.text ||
              (message?.location
                ? `__GPS_PIN__:${message.location.latitude},${message.location.longitude}|${message.location.name || ''}|${message.location.address || ''}`
                : '') ||
              ''
          ).trim();

          if (senderId && textBody) {
            results.push({
              channel: 'whatsapp',
              senderId,
              textBody,
              phoneNumberId,
              messageId,
            });
          }
        }
      }
    }
  } else if (body.object === 'page' || body.object === 'instagram') {
    const channel: 'messenger' | 'instagram' = body.object === 'instagram' ? 'instagram' : 'messenger';
    for (const entry of entries) {
      const messagingEvents = Array.isArray(entry?.messaging) ? entry.messaging : [];
      for (const messaging of messagingEvents) {
        const isEcho = Boolean(messaging?.message?.is_echo);
        if (!messaging || isEcho) continue;
        const senderId = String(messaging?.sender?.id || '').trim();
        const messageId = String(messaging?.message?.mid || '').trim();
        const textBody = String(
          messaging?.message?.text ||
            messaging?.message?.quick_reply?.payload ||
            messaging?.postback?.title ||
            messaging?.postback?.payload ||
            ''
        ).trim();

        if (senderId && textBody) {
          results.push({
            channel,
            senderId,
            textBody,
            phoneNumberId: '',
            messageId,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Claims a Meta webhook message ID synchronously in-memory and persistently in
 * Firestore (`meta_sessions/dedup_*`) so webhook retries or duplicate deliveries
 * never send a double reply. Returns `true` only the first time a message ID is seen.
 */
export async function claimMetaWebhookMessage(
  messageId: string | undefined,
  dbAdmin: any
): Promise<boolean> {
  const key = (messageId || '').trim();
  if (!key) return true;

  const now = Date.now();
  if (processedMetaMessageIds.size > 5000) {
    for (const [k, ts] of processedMetaMessageIds.entries()) {
      if (now - ts > META_DEDUP_TTL_MS) {
        processedMetaMessageIds.delete(k);
      }
    }
  }

  const prevTs = processedMetaMessageIds.get(key);
  if (prevTs && now - prevTs < META_DEDUP_TTL_MS) {
    return false;
  }

  // Synchronously claim BEFORE any await to stop concurrent duplicate deliveries
  processedMetaMessageIds.set(key, now);

  if (dbAdmin) {
    const safeId = `dedup_${key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 110)}`;
    try {
      const docRef = dbAdmin.collection('meta_sessions').doc(safeId);
      const existing = await docRef.get();
      if (existing?.exists) {
        return false;
      }
      await docRef.set({
        type: 'webhook_dedup',
        messageId: key,
        processedAt: now,
      });
    } catch (err) {
      console.warn('[Meta Dedup] Firestore dedup check warning (continuing via memory lock):', err);
    }
  }

  return true;
}

/**
 * Runs async webhook tasks for the same sender strictly sequentially so
 * session reads/writes never race when messages arrive close together.
 */
export function enqueueMetaSenderTask(senderKey: string, task: () => Promise<void>): void {
  const previous = metaSenderQueues.get(senderKey) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(task)
    .catch((err) => {
      console.error(`[Meta Queue] Error processing task for ${senderKey}:`, err);
    })
    .finally(() => {
      if (metaSenderQueues.get(senderKey) === next) {
        metaSenderQueues.delete(senderKey);
      }
    });
  metaSenderQueues.set(senderKey, next);
}


