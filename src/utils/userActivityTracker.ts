import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

export type ActivityCategory =
  | 'auth'
  | 'navigation'
  | 'order'
  | 'ride'
  | 'payment'
  | 'profile'
  | 'admin'
  | 'system';

export interface LogUserActivityInput {
  uid: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  role?: string;
  action: string;
  title: string;
  details?: string;
  path?: string;
  pageLabel?: string;
  category?: ActivityCategory;
  lat?: number | null;
  lng?: number | null;
  device?: string;
  metadata?: Record<string, any>;
}

const PATH_LABELS: Array<{ match: (p: string) => boolean; label: string }> = [
  { match: (p) => p === '/' || p === '/dashboard', label: 'Nyumbani (Homepage)' },
  { match: (p) => p.startsWith('/login'), label: 'Ukurasa wa Kuingia (Login)' },
  { match: (p) => p.startsWith('/register'), label: 'Ukurasa wa Kujisajili' },
  { match: (p) => p.startsWith('/staff/login'), label: 'Login ya Wafanyakazi' },
  { match: (p) => p.startsWith('/wakala'), label: 'Dashibodi ya Wakala' },
  { match: (p) => p.startsWith('/merchant') || p.startsWith('/pos'), label: 'Dashibodi ya Merchant POS' },
  { match: (p) => p.startsWith('/admin'), label: 'Admin Control Center' },
  { match: (p) => p.startsWith('/taxi/history'), label: 'Historia ya Safari (Taxi)' },
  { match: (p) => p.startsWith('/taxi/track') || p.startsWith('/track') || p.startsWith('/safari/track'), label: 'Ufuatiliaji wa Safari Live' },
  { match: (p) => p.startsWith('/taxi'), label: 'Huduma ya Usafiri (PapoRide)' },
  { match: (p) => p.startsWith('/daladala') || p.startsWith('/service/daladala'), label: 'Daladala & Mwendokasi' },
  { match: (p) => p.startsWith('/papopay') || p.startsWith('/pay') || p.startsWith('/service/papopay'), label: 'PapoPay & Malipo' },
  { match: (p) => p.startsWith('/car-rental'), label: 'Kukodisha Gari' },
  { match: (p) => p.startsWith('/print') || p.startsWith('/service/print'), label: 'Huduma ya Kuchapisha (Print)' },
  { match: (p) => p.startsWith('/events') || p.startsWith('/service/matukio'), label: 'Matukio & Tiketi' },
  { match: (p) => p.startsWith('/service/vifurushi') || p.startsWith('/parcel'), label: 'Huduma ya Vifurushi (Parcel)' },
  { match: (p) => p.startsWith('/services'), label: 'Kituo cha Huduma Zote' },
  { match: (p) => p.startsWith('/service/'), label: 'Maelezo ya Huduma' },
  { match: (p) => p.startsWith('/vendor/'), label: 'Duka / Mgahawa' },
  { match: (p) => p.startsWith('/product/'), label: 'Maelezo ya Bidhaa' },
  { match: (p) => p.startsWith('/table/'), label: 'Oda ya Mezani (QR Table)' },
  { match: (p) => p.startsWith('/checkout'), label: 'Malipo na Kukamilisha Oda (Checkout)' },
  { match: (p) => p.startsWith('/my-orders') || p.startsWith('/orders') || p.startsWith('/track-orders'), label: 'Oda Zangu' },
  { match: (p) => p.startsWith('/profile'), label: 'Wasifu Wangu (Profile)' },
  { match: (p) => p.startsWith('/chat'), label: 'Ujumbe / Chat' },
  { match: (p) => p.startsWith('/notifications'), label: 'Arifa (Notifications)' },
  { match: (p) => p.startsWith('/role-selection'), label: 'Kuchagua Jukumu (Role)' },
  { match: (p) => p.startsWith('/instant-ride') || p.startsWith('/ride/qr'), label: 'Safari ya Haraka (QR Ride)' },
  { match: (p) => p.startsWith('/delivery-robot'), label: 'Delivery Robot Manager' },
  { match: (p) => p.startsWith('/verify-receipt'), label: 'Uhakiki wa Risiti' },
  { match: (p) => p.startsWith('/status/'), label: 'Skrini ya Hali ya Oda' },
];

export function describeAppPath(pathname: string): string {
  const clean = (pathname || '/').split('?')[0].toLowerCase();
  const found = PATH_LABELS.find((item) => item.match(clean));
  return found ? found.label : `Ukurasa (${pathname || '/'})`;
}

export function getClientDeviceSummary(): string {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'Server / Unknown';
  }
  const ua = navigator.userAgent || '';
  let os = 'Web';
  if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac os/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';

  const screenSize =
    typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '';
  return [os, browser, screenSize].filter(Boolean).join(' • ');
}

export async function logUserActivity(input: LogUserActivityInput): Promise<void> {
  if (!input.uid) return;
  const nowMs = Date.now();
  const path = input.path || (typeof window !== 'undefined' ? window.location.pathname : '/');
  const pageLabel = input.pageLabel || describeAppPath(path);
  const device = input.device || getClientDeviceSummary();

  try {
    await addDoc(collection(db, 'user_activity_logs'), {
      uid: input.uid,
      userName: input.userName || '',
      userEmail: input.userEmail || '',
      userPhone: input.userPhone || '',
      role: input.role || 'customer',
      action: input.action,
      title: input.title,
      details: input.details || '',
      path,
      pageLabel,
      category: input.category || 'system',
      lat: typeof input.lat === 'number' && Number.isFinite(input.lat) ? input.lat : null,
      lng: typeof input.lng === 'number' && Number.isFinite(input.lng) ? input.lng : null,
      device,
      metadata: input.metadata || null,
      createdAt: serverTimestamp(),
      createdAtMs: nowMs,
    });

    // Update quick summary on presence doc if it exists
    await setDoc(
      doc(db, 'user_presence', input.uid),
      {
        uid: input.uid,
        lastActionTitle: input.title,
        lastActionType: input.action,
        lastActionAtMs: nowMs,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('logUserActivity warning:', err);
  }
}

export interface UpsertPresencePayload {
  uid: string;
  displayName?: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  role?: string;
  status?: string;
  isOnline: boolean;
  currentPath: string;
  currentPageLabel?: string;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  locationSource?: 'gps' | 'profile' | 'city' | 'none';
  device?: string;
  sessionStartedAtMs?: number;
  existingTrail?: Array<{ lat: number; lng: number; atMs: number; path?: string }>;
  isAnonymous?: boolean;
}

export async function upsertUserPresence(payload: UpsertPresencePayload): Promise<void> {
  if (!payload.uid) return;
  const nowMs = Date.now();
  const pageLabel = payload.currentPageLabel || describeAppPath(payload.currentPath);
  const device = payload.device || getClientDeviceSummary();

  const hasCoords =
    typeof payload.lat === 'number' &&
    typeof payload.lng === 'number' &&
    Number.isFinite(payload.lat) &&
    Number.isFinite(payload.lng) &&
    !(payload.lat === 0 && payload.lng === 0);

  let nextTrail = Array.isArray(payload.existingTrail) ? [...payload.existingTrail] : [];
  if (hasCoords && payload.lat !== null && payload.lng !== null) {
    const last = nextTrail[nextTrail.length - 1];
    const movedEnough =
      !last ||
      Math.abs(last.lat - payload.lat!) > 0.00025 ||
      Math.abs(last.lng - payload.lng!) > 0.00025 ||
      nowMs - last.atMs > 120000;
    if (movedEnough) {
      nextTrail.push({
        lat: Number(payload.lat!.toFixed(6)),
        lng: Number(payload.lng!.toFixed(6)),
        atMs: nowMs,
        path: payload.currentPath,
      });
      if (nextTrail.length > 15) {
        nextTrail = nextTrail.slice(-15);
      }
    }
  }

  const presenceDoc: Record<string, any> = {
    uid: payload.uid,
    displayName: payload.displayName || 'Mtumiaji',
    email: payload.email || '',
    phone: payload.phone || '',
    photoURL: payload.photoURL || '',
    role: payload.role || 'customer',
    status: payload.status || 'active',
    isOnline: payload.isOnline,
    isAnonymous: Boolean(payload.isAnonymous),
    currentPath: payload.currentPath || '/',
    currentPageLabel: pageLabel,
    device,
    lastSeenAt: serverTimestamp(),
    lastSeenAtMs: nowMs,
    updatedAt: serverTimestamp(),
  };

  if (payload.sessionStartedAtMs) {
    presenceDoc.sessionStartedAtMs = payload.sessionStartedAtMs;
  }

  if (hasCoords && payload.lat !== null && payload.lng !== null) {
    presenceDoc.location = {
      lat: Number(payload.lat!.toFixed(6)),
      lng: Number(payload.lng!.toFixed(6)),
    };
    presenceDoc.accuracy = payload.accuracy ?? null;
    presenceDoc.locationSource = payload.locationSource || 'gps';
    presenceDoc.locationTrail = nextTrail;
  } else if (payload.locationSource) {
    presenceDoc.locationSource = payload.locationSource;
  }

  try {
    await setDoc(doc(db, 'user_presence', payload.uid), presenceDoc, { merge: true });
    // Mirror lightweight online flags onto users/{uid} when user doc already exists
    await updateDoc(doc(db, 'users', payload.uid), {
      isOnline: payload.isOnline,
      lastSeenAt: serverTimestamp(),
      lastSeenAtMs: nowMs,
      currentPath: payload.currentPath || '/',
      ...(hasCoords && payload.lat !== null && payload.lng !== null
        ? {
            location: {
              lat: Number(payload.lat!.toFixed(6)),
              lng: Number(payload.lng!.toFixed(6)),
            },
          }
        : {}),
    }).catch(() => {});
  } catch (err) {
    console.warn('upsertUserPresence warning:', err);
  }
}

export async function markUserOffline(uid: string, reason?: string): Promise<void> {
  if (!uid) return;
  const nowMs = Date.now();
  try {
    await setDoc(
      doc(db, 'user_presence', uid),
      {
        uid,
        isOnline: false,
        lastSeenAt: serverTimestamp(),
        lastSeenAtMs: nowMs,
        lastActionTitle: reason || 'Ametoka kwenye mfumo',
        lastActionAtMs: nowMs,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await updateDoc(doc(db, 'users', uid), {
      isOnline: false,
      lastSeenAt: serverTimestamp(),
      lastSeenAtMs: nowMs,
    }).catch(() => {});
  } catch (err) {
    console.warn('markUserOffline warning:', err);
  }
}
