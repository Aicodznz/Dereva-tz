import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  extractFaceBiometrics,
  matchFaceDescriptor,
  normalizeTzPhone,
  FaceMatchResult
} from './faceBiometrics';

export interface RegisteredFaceCustomer {
  id: string;
  uid?: string;
  name: string;
  phone: string;
  normalizedPhone: string;
  walletBalance: number;
  faceEmbeddingId: string;
  faceDescriptor?: number[];
  photoUrl: string;
  isRegistered: boolean;
  hasAccountButNoFace?: boolean;
  nidaNumber?: string;
  pin?: string;
  dailyLimit?: number;
  enrolledAt?: string;
  source?: 'firestore' | 'local' | 'demo';
}

export interface SaveFaceCustomerInput {
  uid?: string;
  name: string;
  phone: string;
  embeddingId: string;
  photoUrl: string;
  faceDescriptor: number[];
  dailyLimit?: number;
  nidaNumber?: string;
  pin?: string;
  walletBalance?: number;
  setAsCurrentDeviceProfile?: boolean;
}

const LOCAL_FACES_KEY = 'papopay_registered_faces';
const LOCAL_REGISTRY_KEY = 'papopay_customers_registry';
const LOCAL_PRIMARY_FACE_KEY = 'papopay_registered_face';
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

function safeParseArray(raw: string | null): any[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Hydrate any enrolled record that has a real image (data URL or local asset) but lacks a 128-D descriptor yet.
 * Modifies records in-memory and writes back extracted descriptor cleanly.
 */
async function hydrateMissingDescriptors(list: RegisteredFaceCustomer[]): Promise<RegisteredFaceCustomer[]> {
  const updated = [...list];
  let changed = false;

  for (let i = 0; i < updated.length; i++) {
    const cust = updated[i];
    if (
      cust.isRegistered &&
      (!Array.isArray(cust.faceDescriptor) || cust.faceDescriptor.length !== 128) &&
      cust.photoUrl &&
      cust.photoUrl.startsWith('data:')
    ) {
      const res = await extractFaceBiometrics(cust.photoUrl);
      if (res.ok) {
        updated[i] = { ...cust, faceDescriptor: res.descriptor };
        changed = true;
      }
    }
  }

  if (changed) {
    try {
      const existingLocal = safeParseArray(localStorage.getItem(LOCAL_FACES_KEY));
      if (existingLocal.length > 0) {
        const mergedLocal = existingLocal.map((item: any) => {
          const norm = normalizeTzPhone(item.phone || item.normalizedPhone);
          const match = updated.find((u) => u.normalizedPhone === norm && Array.isArray(u.faceDescriptor));
          return match ? { ...item, faceDescriptor: match.faceDescriptor } : item;
        });
        localStorage.setItem(LOCAL_FACES_KEY, JSON.stringify(mergedLocal));
      }
    } catch {}
  }

  return updated;
}

export function readLocalRegisteredCustomers(): RegisteredFaceCustomer[] {
  const map = new Map<string, RegisteredFaceCustomer>();

  const upsert = (raw: any, fallbackSource: 'local' = 'local') => {
    if (!raw || typeof raw !== 'object') return;
    const norm = normalizeTzPhone(raw.normalizedPhone || raw.phone || raw.phoneNumber);
    const key = norm || raw.uid || raw.id;
    if (!key) return;

    const isEnrolled = Boolean(raw.isEnrolled ?? raw.hasFaceEnrolled ?? raw.isRegistered);
    const hasDesc = Array.isArray(raw.faceDescriptor) && raw.faceDescriptor.length === 128;
    const prev = map.get(key);

    // Prefer records that are enrolled and have descriptor vectors
    const candidate: RegisteredFaceCustomer = {
      id: raw.uid || raw.id || `face_${key}`,
      uid: raw.uid,
      name: raw.name || raw.fullName || raw.displayName || 'Mteja wa PapoPay',
      phone: raw.phone || raw.phoneNumber || norm,
      normalizedPhone: norm,
      walletBalance: typeof raw.walletBalance === 'number' ? raw.walletBalance : prev?.walletBalance ?? 0,
      faceEmbeddingId: isEnrolled ? (raw.embeddingId || raw.faceEmbeddingId || `EMB-TZ-${key.slice(-4)}`) : 'NOT_ENROLLED',
      faceDescriptor: hasDesc ? raw.faceDescriptor : prev?.faceDescriptor,
      photoUrl: raw.photoUrl || raw.facePhotoUrl || prev?.photoUrl || DEFAULT_AVATAR,
      isRegistered: isEnrolled,
      hasAccountButNoFace: !isEnrolled,
      nidaNumber: raw.nidaNumber || prev?.nidaNumber,
      pin: raw.pin || prev?.pin,
      dailyLimit: raw.dailyLimit || raw.faceDailyLimit || prev?.dailyLimit || 500000,
      enrolledAt: raw.enrolledAt || raw.faceRegisteredAt || prev?.enrolledAt,
      source: fallbackSource
    };

    if (!prev || (candidate.faceDescriptor && !prev.faceDescriptor) || (candidate.isRegistered && !prev.isRegistered)) {
      map.set(key, candidate);
    }
  };

  try {
    safeParseArray(localStorage.getItem(LOCAL_FACES_KEY)).forEach((r) => upsert(r));
    safeParseArray(localStorage.getItem(LOCAL_REGISTRY_KEY)).forEach((r) => upsert(r));
    const primary = localStorage.getItem(LOCAL_PRIMARY_FACE_KEY);
    if (primary) {
      upsert(JSON.parse(primary));
    }
  } catch {}

  return Array.from(map.values());
}

/**
 * Load all face-registered & account-holding customers from Firestore `users` merged with localStorage.
 */
export async function loadRegisteredFaceCustomers(): Promise<RegisteredFaceCustomer[]> {
  const byKey = new Map<string, RegisteredFaceCustomer>();

  const put = (cust: RegisteredFaceCustomer) => {
    const key = cust.normalizedPhone || cust.uid || cust.id;
    if (!key) return;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, cust);
      return;
    }
    byKey.set(key, {
      ...prev,
      ...cust,
      // Keep descriptor/photo/pin if newer entry missed it
      faceDescriptor:
        Array.isArray(cust.faceDescriptor) && cust.faceDescriptor.length === 128
          ? cust.faceDescriptor
          : prev.faceDescriptor,
      photoUrl: cust.photoUrl && cust.photoUrl !== DEFAULT_AVATAR ? cust.photoUrl : prev.photoUrl,
      pin: cust.pin || prev.pin,
      walletBalance:
        cust.source === 'firestore'
          ? cust.walletBalance
          : Math.max(prev.walletBalance, cust.walletBalance),
      isRegistered: cust.isRegistered || prev.isRegistered,
      hasAccountButNoFace: !(cust.isRegistered || prev.isRegistered)
    });
  };

  readLocalRegisteredCustomers().forEach(put);

  try {
    // Query customers & face-enrolled users from Firestore
    const faceQ = query(collection(db, 'users'), where('hasFaceEnrolled', '==', true), limit(150));
    const snap = await getDocs(faceQ);
    snap.forEach((d) => {
      const data = d.data() as any;
      const phone = data.phone || data.phoneNumber || '';
      const norm = normalizeTzPhone(data.normalizedPhone || phone);
      put({
        id: d.id,
        uid: d.id,
        name: data.fullName || data.displayName || 'Mteja wa PapoPay',
        phone,
        normalizedPhone: norm,
        walletBalance: typeof data.walletBalance === 'number' ? data.walletBalance : 0,
        faceEmbeddingId: data.faceEmbeddingId || `EMB-FS-${d.id.slice(0, 6)}`,
        faceDescriptor: Array.isArray(data.faceDescriptor) ? data.faceDescriptor : undefined,
        photoUrl: data.facePhotoUrl || data.photoURL || DEFAULT_AVATAR,
        isRegistered: Boolean(data.hasFaceEnrolled),
        hasAccountButNoFace: !data.hasFaceEnrolled,
        nidaNumber: data.nidaNumber,
        pin: data.pin,
        dailyLimit: data.faceDailyLimit || 500000,
        enrolledAt: data.faceRegisteredAt,
        source: 'firestore'
      });
    });

    // Also load customer accounts that have NOT enrolled a face yet so Wakala sees "Akaunti Ipo, Bado Uso"
    const custQ = query(collection(db, 'users'), where('role', '==', 'customer'), limit(100));
    const custSnap = await getDocs(custQ);
    custSnap.forEach((d) => {
      const data = d.data() as any;
      const phone = data.phone || data.phoneNumber || '';
      const norm = normalizeTzPhone(data.normalizedPhone || phone);
      if (!phone && !data.fullName && !data.displayName) return;
      put({
        id: d.id,
        uid: d.id,
        name: data.fullName || data.displayName || 'Mteja wa PapoPay',
        phone,
        normalizedPhone: norm,
        walletBalance: typeof data.walletBalance === 'number' ? data.walletBalance : 0,
        faceEmbeddingId: data.hasFaceEnrolled ? (data.faceEmbeddingId || `EMB-FS-${d.id.slice(0, 6)}`) : 'NOT_ENROLLED',
        faceDescriptor: Array.isArray(data.faceDescriptor) ? data.faceDescriptor : undefined,
        photoUrl: data.facePhotoUrl || data.photoURL || DEFAULT_AVATAR,
        isRegistered: Boolean(data.hasFaceEnrolled),
        hasAccountButNoFace: !data.hasFaceEnrolled,
        nidaNumber: data.nidaNumber,
        pin: data.pin,
        dailyLimit: data.faceDailyLimit || 500000,
        enrolledAt: data.faceRegisteredAt,
        source: 'firestore'
      });
    });
  } catch (err) {
    console.warn('[FaceRegistry] Firestore read warning (using local cache):', err);
  }

  return hydrateMissingDescriptors(Array.from(byKey.values()));
}

/**
 * Subscribe in real time to Firestore enrolled users so Wakala terminals stay synced across tabs/devices.
 */
export function subscribeEnrolledFaceCustomers(
  onUpdate: (customers: RegisteredFaceCustomer[]) => void
): () => void {
  let active = true;
  loadRegisteredFaceCustomers().then((initial) => {
    if (active) onUpdate(initial);
  });

  const q = query(collection(db, 'users'), where('hasFaceEnrolled', '==', true), limit(150));
  const unsub = onSnapshot(
    q,
    async () => {
      const merged = await loadRegisteredFaceCustomers();
      if (active) onUpdate(merged);
    },
    (err) => {
      console.warn('[FaceRegistry] Live snapshot warning:', err);
    }
  );

  return () => {
    active = false;
    unsub();
  };
}

/**
 * Save a newly registered (or updated) face customer to BOTH Firestore `users` AND localStorage registry.
 * Never overwrites other registered customers in the multi-user registry!
 */
export async function saveEnrolledFaceCustomer(
  input: SaveFaceCustomerInput
): Promise<RegisteredFaceCustomer> {
  const normPhone = normalizeTzPhone(input.phone);
  const cleanName = input.name.trim();
  const cleanPhone = input.phone.trim();
  const nowIso = new Date().toISOString();

  // Check if a Firestore user already exists for this uid or phone
  let docId = input.uid || '';
  let existingBalance: number | undefined;
  let existingPin: string | undefined;

  try {
    if (!docId && normPhone) {
      const variations = Array.from(
        new Set([cleanPhone, normPhone, `+255${normPhone.slice(1)}`, `255${normPhone.slice(1)}`])
      );
      const qNorm = query(collection(db, 'users'), where('normalizedPhone', '==', normPhone), limit(1));
      const snapNorm = await getDocs(qNorm);
      if (!snapNorm.empty) {
        docId = snapNorm.docs[0].id;
        const d = snapNorm.docs[0].data() as any;
        if (typeof d.walletBalance === 'number') existingBalance = d.walletBalance;
        if (d.pin) existingPin = d.pin;
      } else {
        const qPhone = query(collection(db, 'users'), where('phone', 'in', variations), limit(1));
        const snapPhone = await getDocs(qPhone);
        if (!snapPhone.empty) {
          docId = snapPhone.docs[0].id;
          const d = snapPhone.docs[0].data() as any;
          if (typeof d.walletBalance === 'number') existingBalance = d.walletBalance;
          if (d.pin) existingPin = d.pin;
        }
      }
    }
  } catch (err) {
    console.warn('[FaceRegistry] Lookup existing user warning:', err);
  }

  if (!docId) {
    docId = normPhone ? `face_${normPhone}` : `face_${Date.now()}`;
  }

  const finalBalance =
    typeof input.walletBalance === 'number'
      ? input.walletBalance
      : typeof existingBalance === 'number'
      ? existingBalance
      : 0;

  const finalPin = input.pin || existingPin || '1234';

  const record: RegisteredFaceCustomer = {
    id: docId,
    uid: docId,
    name: cleanName,
    phone: cleanPhone,
    normalizedPhone: normPhone,
    walletBalance: finalBalance,
    faceEmbeddingId: input.embeddingId,
    faceDescriptor: input.faceDescriptor,
    photoUrl: input.photoUrl,
    isRegistered: true,
    hasAccountButNoFace: false,
    nidaNumber: input.nidaNumber,
    pin: finalPin,
    dailyLimit: input.dailyLimit || 500000,
    enrolledAt: nowIso,
    source: 'firestore'
  };

  // 1. Persist to Firestore `users/{docId}`
  try {
    const userRef = doc(db, 'users', docId);
    const firestorePayload: any = {
      uid: docId,
      fullName: cleanName,
      displayName: cleanName,
      phone: cleanPhone,
      phoneNumber: cleanPhone,
      normalizedPhone: normPhone,
      hasFaceEnrolled: true,
      facePhotoUrl: input.photoUrl,
      faceEmbeddingId: input.embeddingId,
      faceDescriptor: input.faceDescriptor,
      faceDailyLimit: input.dailyLimit || 500000,
      faceRegisteredAt: nowIso,
      pin: finalPin,
      walletBalance: finalBalance,
      updatedAt: serverTimestamp()
    };
    if (input.nidaNumber) firestorePayload.nidaNumber = input.nidaNumber;
    if (!input.uid) {
      firestorePayload.role = 'customer';
      firestorePayload.createdAt = serverTimestamp();
    }
    await setDoc(userRef, firestorePayload, { merge: true });
  } catch (err) {
    console.error('[FaceRegistry] Failed persisting enrolled face to Firestore:', err);
  }

  // 2. Persist into multi-user localStorage registries (preserving other customers!)
  try {
    const localRecord = {
      id: docId,
      uid: docId,
      isEnrolled: true,
      name: cleanName,
      phone: cleanPhone,
      normalizedPhone: normPhone,
      embeddingId: input.embeddingId,
      faceDescriptor: input.faceDescriptor,
      photoUrl: input.photoUrl,
      walletBalance: finalBalance,
      dailyLimit: input.dailyLimit || 500000,
      nidaNumber: input.nidaNumber,
      pin: finalPin,
      enrolledAt: nowIso
    };

    const existingList = safeParseArray(localStorage.getItem(LOCAL_FACES_KEY));
    const filteredList = existingList.filter(
      (f: any) => normalizeTzPhone(f.normalizedPhone || f.phone) !== normPhone && f.uid !== docId
    );
    filteredList.unshift(localRecord);
    localStorage.setItem(LOCAL_FACES_KEY, JSON.stringify(filteredList));

    const existingReg = safeParseArray(localStorage.getItem(LOCAL_REGISTRY_KEY));
    const filteredReg = existingReg.filter(
      (f: any) => normalizeTzPhone(f.normalizedPhone || f.phone) !== normPhone && f.uid !== docId
    );
    filteredReg.unshift(localRecord);
    localStorage.setItem(LOCAL_REGISTRY_KEY, JSON.stringify(filteredReg));

    if (input.setAsCurrentDeviceProfile !== false) {
      localStorage.setItem(LOCAL_PRIMARY_FACE_KEY, JSON.stringify(localRecord));
    }
  } catch {}

  return record;
}

/**
 * Perform real 1:N biometric identification from a live video or image snapshot against ALL registered customers.
 */
export async function identifyCustomerFromCamera(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | string,
  candidates: RegisteredFaceCustomer[],
  options?: { mirrored?: boolean; maxDistance?: number }
): Promise<{
  status: 'matched' | 'unregistered' | 'no_face';
  customer?: RegisteredFaceCustomer;
  match?: FaceMatchResult<RegisteredFaceCustomer>;
  probePhotoUrl?: string;
  probeDescriptor?: number[];
  message?: string;
}> {
  const probe = await extractFaceBiometrics(source, { mirrored: options?.mirrored ?? true });
  if (!probe.ok) {
    return {
      status: 'no_face',
      message: probe.message
    };
  }

  const hydratedCandidates = await hydrateMissingDescriptors(candidates);
  const match = matchFaceDescriptor(probe.descriptor, hydratedCandidates, options?.maxDistance ?? 0.50);

  if (match.matched && match.candidate) {
    return {
      status: 'matched',
      customer: match.candidate,
      match,
      probePhotoUrl: probe.photoUrl,
      probeDescriptor: probe.descriptor
    };
  }

  return {
    status: 'unregistered',
    match,
    probePhotoUrl: probe.photoUrl,
    probeDescriptor: probe.descriptor,
    message:
      match.reason === 'ambiguous_match'
        ? 'Utambuzi haujawa wazi kabisa. Sogea karibu kwenye mwanga mzuri na skani tena.'
        : 'Sura hii haijasajiliwa kwenye mfumo wa PapoPay.'
  };
}

/**
 * Update a matched customer's real wallet balance in Firestore + localStorage and record audit log in `payments`.
 */
export async function recordWakalaFaceTransaction(params: {
  customer: RegisteredFaceCustomer;
  txId: string;
  type: 'deposit' | 'withdraw' | 'airtime' | 'bill' | 'merchant_pos';
  typeLabel: string;
  amount: number;
  commission: number;
  newBalance: number;
  wakalaId: string;
  wakalaName: string;
  securityMethod: string;
  faceConfidence?: number;
  extraNote?: string;
}): Promise<void> {
  const { customer, txId, type, typeLabel, amount, commission, newBalance, wakalaId, wakalaName, securityMethod, faceConfidence, extraNote } =
    params;
  const normPhone = customer.normalizedPhone || normalizeTzPhone(customer.phone);

  // 1. Update customer's Firestore user balance + write payment receipt doc
  try {
    if (customer.id && !customer.id.startsWith('cust_unreg_') && customer.source !== 'demo') {
      await updateDoc(doc(db, 'users', customer.id), {
        walletBalance: newBalance,
        updatedAt: serverTimestamp()
      });
    }
    await setDoc(doc(db, 'payments', txId), {
      txId,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      normalizedPhone: normPhone,
      operation: type,
      typeLabel,
      amount,
      commission,
      balanceAfter: newBalance,
      wakalaId,
      wakalaName,
      securityMethod,
      faceConfidence: faceConfidence || null,
      extraNote: extraNote || null,
      status: 'completed',
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('[FaceRegistry] Firestore transaction persistence warning:', err);
  }

  // 2. Sync localStorage registries for offline consistency
  try {
    const updateEntry = (f: any) => {
      const fNorm = normalizeTzPhone(f.normalizedPhone || f.phone);
      if ((normPhone && fNorm === normPhone) || f.uid === customer.id || f.id === customer.id) {
        return { ...f, walletBalance: newBalance };
      }
      return f;
    };

    const list1 = safeParseArray(localStorage.getItem(LOCAL_FACES_KEY));
    if (list1.length > 0) localStorage.setItem(LOCAL_FACES_KEY, JSON.stringify(list1.map(updateEntry)));

    const list2 = safeParseArray(localStorage.getItem(LOCAL_REGISTRY_KEY));
    if (list2.length > 0) localStorage.setItem(LOCAL_REGISTRY_KEY, JSON.stringify(list2.map(updateEntry)));

    const primary = localStorage.getItem(LOCAL_PRIMARY_FACE_KEY);
    if (primary) {
      const parsed = JSON.parse(primary);
      const pNorm = normalizeTzPhone(parsed.normalizedPhone || parsed.phone);
      if ((normPhone && pNorm === normPhone) || parsed.uid === customer.id) {
        parsed.walletBalance = newBalance;
        localStorage.setItem(LOCAL_PRIMARY_FACE_KEY, JSON.stringify(parsed));
        localStorage.setItem('papopay_wallet_balance', String(newBalance));
      }
    }
  } catch {}
}
