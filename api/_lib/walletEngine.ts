import crypto from 'node:crypto';
import { cleanUndefined } from './getFirestoreDb.js';
import {
  hashTransactionPin,
  maskWalletId,
  normalizeUsername,
  validatePinFormat,
  verifyTransactionPinRecord,
} from './userAuth.js';
import {
  computeTransferFee,
  computeWithdrawalFee,
  dispatchModularMobileMoneyPayout,
  getMobileMoneyNetworkLabel,
  getPapoPayTreasurySettings,
  MobileMoneyNetwork,
  normalizeMobileMoneyNetwork,
  PapoPayTreasurySettings,
} from './payoutProviders.js';
import { normalizePhoneForDaliPay } from './dalipay.js';
import { buildSettlementPhoneVariants, findOrEnsureWalletUser } from './papoWalletSettlement.js';

export type WalletTransactionType =
  | 'MONEY_RECEIVED'
  | 'MONEY_SENT'
  | 'MOBILE_MONEY_WITHDRAWAL'
  | 'WALLET_DEPOSIT'
  | 'TRANSACTION_FEE'
  | 'REVERSAL'
  | 'PENDING_WITHDRAWAL'
  | 'FAILED_WITHDRAWAL';

export const WALLET_TX_TYPE_LABELS: Record<WalletTransactionType, string> = {
  MONEY_RECEIVED: 'Money Received',
  MONEY_SENT: 'Money Sent',
  MOBILE_MONEY_WITHDRAWAL: 'Mobile Money Withdrawal',
  WALLET_DEPOSIT: 'Wallet Deposit',
  TRANSACTION_FEE: 'Transaction Fee',
  REVERSAL: 'Reversal',
  PENDING_WITHDRAWAL: 'Pending Withdrawal',
  FAILED_WITHDRAWAL: 'Failed Withdrawal',
};

const TZ_MOBILE_PREFIXES = ['61', '62', '65', '67', '68', '69', '71', '73', '74', '75', '76', '77', '78', '79'];

function generateUniqueRef(prefix: string): string {
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${num}-${rand}`;
}

export function deriveCanonicalWalletId(userData: any, uid: string): string {
  const existing = String(userData?.walletId || '').trim().toUpperCase();
  if (existing && existing.length >= 6) return existing;
  const phoneDigits = String(
    userData?.phoneNumber || userData?.phone || userData?.normalizedPhone || ''
  ).replace(/\D/g, '');
  if (phoneDigits.length >= 9) {
    return `PP${phoneDigits.slice(-7)}`;
  }
  const cleanUid = String(uid || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `PP${cleanUid.slice(-7).padStart(7, '0')}`;
}

export interface VerifiedRecipientProfile {
  found: boolean;
  uid: string | null;
  displayName: string;
  username: string | null;
  photoURL: string | null;
  walletId: string | null;
  maskedWalletId: string | null;
  phone: string | null;
  verified: boolean;
  matchedBy?: 'username' | 'walletId' | 'phone';
}

function buildVerifiedRecipientPayload(
  uid: string,
  data: any,
  matchedBy: 'username' | 'walletId' | 'phone'
): VerifiedRecipientProfile {
  const rawWalletId = deriveCanonicalWalletId(data, uid);
  const uname = data?.username ? `@${String(data.username).replace(/^@+/, '')}` : data?.usernameLower ? `@${data.usernameLower}` : null;
  const isVerified =
    data?.kycVerified === true ||
    data?.approvalStatus === 'approved' ||
    data?.status === 'active' ||
    Boolean(data?.walletPinHash || data?.email || data?.phoneNumber || data?.phone);

  return {
    found: true,
    uid,
    displayName: String(data?.displayName || data?.fullName || data?.name || uname || `PapoPay ${rawWalletId}`),
    username: uname,
    photoURL: data?.photoURL || data?.avatarUrl || null,
    walletId: rawWalletId,
    maskedWalletId: maskWalletId(rawWalletId),
    phone: data?.phoneNumber || data?.phone || null,
    verified: Boolean(isVerified),
    matchedBy,
  };
}

/**
 * Strictly resolves an existing PapoPay user by @username, Wallet ID (PP... or digits),
 * or exact Tanzanian phone number. Never fabricates phantom users for unknown usernames or Wallet IDs.
 */
export async function lookupP2PRecipientVerified(
  dbAdmin: any,
  rawQuery: string
): Promise<VerifiedRecipientProfile> {
  const clean = String(rawQuery || '').trim();
  if (!dbAdmin || !clean) {
    return {
      found: false,
      uid: null,
      displayName: '',
      username: null,
      photoURL: null,
      walletId: null,
      maskedWalletId: null,
      phone: null,
      verified: false,
    };
  }

  const compact = clean.replace(/\s+/g, '');

  // 1. Lookup by @username (or alphanumeric username containing letters/_ that is not a PP Wallet ID)
  const looksLikeWalletId = /^PP\d{6,}$/i.test(compact);
  const looksLikeDigitsWallet = /^\d{6,16}$/.test(compact) && !compact.startsWith('0') && !compact.startsWith('255');
  const looksLikePhone = /^\+?\d[\d\s-]{7,}$/.test(clean) && !compact.startsWith('@');

  if (
    compact.startsWith('@') ||
    (!looksLikeWalletId && !looksLikePhone && !/^\d+$/.test(compact) && /^[a-zA-Z0-9_]{3,24}$/.test(compact))
  ) {
    const norm = normalizeUsername(compact);
    if (norm.valid) {
      // 1a. Fast index doc usernames/{usernameLower}
      try {
        const idxSnap = await dbAdmin.collection('usernames').doc(norm.lower).get();
        if (idxSnap?.exists && idxSnap.data()?.uid) {
          const targetUid = String(idxSnap.data().uid);
          const uSnap = await dbAdmin.collection('users').doc(targetUid).get();
          if (uSnap?.exists) {
            return buildVerifiedRecipientPayload(uSnap.id, uSnap.data() || {}, 'username');
          }
        }
      } catch {}

      // 1b. Query users.usernameLower
      try {
        const qSnap = await dbAdmin
          .collection('users')
          .where('usernameLower', '==', norm.lower)
          .limit(2)
          .get();
        if (!qSnap.empty) {
          const docSnap = qSnap.docs[0];
          const d = docSnap.data() || {};
          // Heal username index lazily
          await dbAdmin
            .collection('usernames')
            .doc(norm.lower)
            .set({ uid: docSnap.id, usernameLower: norm.lower, updatedAt: new Date().toISOString() }, { merge: true })
            .catch(() => {});
          return buildVerifiedRecipientPayload(docSnap.id, d, 'username');
        }
      } catch {}

      // Explicit username query that didn't match must fail cleanly (never fall through to phone creation)
      if (compact.startsWith('@') || /[a-zA-Z_]/.test(compact)) {
        return {
          found: false,
          uid: null,
          displayName: '',
          username: null,
          photoURL: null,
          walletId: null,
          maskedWalletId: null,
          phone: null,
          verified: false,
        };
      }
    } else if (compact.startsWith('@')) {
      return {
        found: false,
        uid: null,
        displayName: '',
        username: null,
        photoURL: null,
        walletId: null,
        maskedWalletId: null,
        phone: null,
        verified: false,
      };
    }
  }

  // 2. Lookup by Wallet ID (e.g. PP4225358, pp4225358, 4225358, or numeric web Wallet ID 118504625)
  const upperWallet = compact.toUpperCase();
  if (looksLikeWalletId || looksLikeDigitsWallet || (!looksLikePhone && /^[A-Z0-9]{6,16}$/i.test(compact))) {
    const candidateWalletKeys = Array.from(
      new Set([
        upperWallet,
        compact,
        upperWallet.toLowerCase(),
        ...(/^\d{7}$/.test(upperWallet) ? [`PP${upperWallet}`] : []),
      ])
    );

    // 2a. Check fast wallet_ids index
    for (const wKey of candidateWalletKeys) {
      try {
        const widSnap = await dbAdmin.collection('wallet_ids').doc(wKey).get();
        if (widSnap?.exists && widSnap.data()?.uid) {
          const targetUid = String(widSnap.data().uid);
          const uSnap = await dbAdmin.collection('users').doc(targetUid).get();
          if (uSnap?.exists) {
            return buildVerifiedRecipientPayload(uSnap.id, uSnap.data() || {}, 'walletId');
          }
        }
      } catch {}
    }

    // 2b. Query users.walletId case-variants & PP-prefixed variant
    try {
      const wSnap = await dbAdmin.collection('users').where('walletId', 'in', candidateWalletKeys).limit(3).get();
      if (!wSnap.empty) {
        const ranked = [...(wSnap.docs || [])].sort(
          (a, b) => Number(b.data()?.walletBalance || 0) - Number(a.data()?.walletBalance || 0)
        );
        const docSnap = ranked[0];
        const d = docSnap.data() || {};
        const canonicalWId = String(d.walletId || upperWallet);
        await dbAdmin
          .collection('wallet_ids')
          .doc(canonicalWId)
          .set({ uid: docSnap.id, walletId: canonicalWId, updatedAt: new Date().toISOString() }, { merge: true })
          .catch(() => {});
        return buildVerifiedRecipientPayload(docSnap.id, d, 'walletId');
      }
    } catch {}

    // 2c. Legacy PPxxxxxxx fallback: older users may have PP + last 7 digits of phone without persisted walletId
    const ppMatch = upperWallet.match(/^PP(\d{7})$/) || (/^\d{7}$/.test(upperWallet) ? [upperWallet, upperWallet] : null);
    if (ppMatch) {
      const last7 = ppMatch[1];
      const normPhones255 = TZ_MOBILE_PREFIXES.map((p) => `255${p}${last7}`);
      const plusPhones255 = TZ_MOBILE_PREFIXES.map((p) => `+255${p}${last7}`);
      const localPhones0 = TZ_MOBILE_PREFIXES.map((p) => `0${p}${last7}`);

      const matchedMap = new Map<string, any>();
      const queryChunks: Array<{ field: string; values: string[] }> = [
        { field: 'normalizedPhone', values: normPhones255.slice(0, 10) },
        { field: 'normalizedPhone', values: normPhones255.slice(10) },
        { field: 'phoneNumber', values: plusPhones255.slice(0, 10) },
        { field: 'phoneNumber', values: plusPhones255.slice(10) },
        { field: 'phone', values: localPhones0.slice(0, 10) },
        { field: 'phone', values: localPhones0.slice(10) },
      ];

      for (const chunk of queryChunks) {
        if (chunk.values.length === 0) continue;
        try {
          const snap = await dbAdmin
            .collection('users')
            .where(chunk.field, 'in', chunk.values)
            .limit(5)
            .get();
          for (const d of snap.docs || []) {
            if (!matchedMap.has(d.id)) {
              matchedMap.set(d.id, d.data() || {});
            }
          }
        } catch {}
      }

      if (matchedMap.size === 0) {
        const candidateDocIds: string[] = [];
        for (const prefix of TZ_MOBILE_PREFIXES) {
          candidateDocIds.push(`meta-whatsapp-255${prefix}${last7}`);
          candidateDocIds.push(`meta-whatsapp-0${prefix}${last7}`);
        }
        await Promise.all(
          candidateDocIds.map(async (docId) => {
            try {
              const s = await dbAdmin.collection('users').doc(docId).get();
              if (s?.exists) {
                matchedMap.set(s.id, s.data() || {});
              }
            } catch {}
          })
        );
      }

      if (matchedMap.size > 0) {
        const best = Array.from(matchedMap.entries()).sort((a, b) => {
          const balDiff = Number(b[1]?.walletBalance || 0) - Number(a[1]?.walletBalance || 0);
          if (balDiff !== 0) return balDiff;
          return a[0].startsWith('meta-whatsapp-') ? 1 : -1;
        })[0];
        const [foundUid, foundData] = best;
        // Persist canonical walletId & index lazily so subsequent lookups are instant
        await Promise.allSettled([
          dbAdmin.collection('users').doc(foundUid).set({ walletId: upperWallet }, { merge: true }),
          dbAdmin
            .collection('wallet_ids')
            .doc(upperWallet)
            .set({ uid: foundUid, walletId: upperWallet, updatedAt: new Date().toISOString() }, { merge: true }),
        ]);
        return buildVerifiedRecipientPayload(foundUid, { ...foundData, walletId: upperWallet }, 'walletId');
      }
    }

    // Explicit PP Wallet ID that wasn't found must fail cleanly
    if (looksLikeWalletId) {
      return {
        found: false,
        uid: null,
        displayName: '',
        username: null,
        photoURL: null,
        walletId: null,
        maskedWalletId: null,
        phone: null,
        verified: false,
      };
    }
  }

  // 3. Lookup by strict phone match (exact last 9 digits against primary phoneNumber/phone/normalizedPhone)
  const { digits, phoneVariants } = buildSettlementPhoneVariants(clean);
  if (digits.length >= 9 && phoneVariants.length > 0) {
    const queryLast9 = digits.slice(-9);
    const matches = new Map<string, any>();

    for (const field of ['phoneNumber', 'phone', 'normalizedPhone']) {
      try {
        const snap = await dbAdmin
          .collection('users')
          .where(field, 'in', phoneVariants.slice(0, 10))
          .limit(5)
          .get();
        for (const d of snap.docs || []) {
          const data = d.data() || {};
          // Strictly validate the stored user phone actually matches queryLast9 (prevents cross-user leakage!)
          const candidates9 = [data.phoneNumber, data.phone, data.normalizedPhone]
            .filter(Boolean)
            .map((p) => String(p).replace(/\D/g, '').slice(-9));
          const primary9 = String(data.phoneNumber || data.phone || '').replace(/\D/g, '').slice(-9);
          if ((primary9 && primary9 === queryLast9) || (!primary9 && candidates9.includes(queryLast9))) {
            matches.set(d.id, data);
          }
        }
      } catch {}
    }

    if (matches.size === 0) {
      for (const docId of [`meta-whatsapp-255${queryLast9}`, `meta-whatsapp-0${queryLast9}`]) {
        try {
          const snap = await dbAdmin.collection('users').doc(docId).get();
          if (snap?.exists) {
            matches.set(snap.id, snap.data() || {});
          }
        } catch {}
      }
    }

    if (matches.size > 0) {
      const best = Array.from(matches.entries()).sort((a, b) => {
        const balDiff = Number(b[1]?.walletBalance || 0) - Number(a[1]?.walletBalance || 0);
        if (balDiff !== 0) return balDiff;
        const stubA = a[0].startsWith('meta-whatsapp-') || a[0].startsWith('web-');
        const stubB = b[0].startsWith('meta-whatsapp-') || b[0].startsWith('web-');
        if (stubA !== stubB) return stubA ? 1 : -1;
        return Number(b[1]?.points || 0) - Number(a[1]?.points || 0);
      })[0];
      return buildVerifiedRecipientPayload(best[0], best[1], 'phone');
    }
  }

  return {
    found: false,
    uid: null,
    displayName: '',
    username: null,
    photoURL: null,
    walletId: null,
    maskedWalletId: null,
    phone: null,
    verified: false,
  };
}

/**
 * Updates user @username (uniquely reserved via atomic transaction) and/or 4-6 digit hashed PIN.
 */
export async function updateWalletSecurityProfile(
  dbAdmin: any,
  params: {
    uid?: string;
    phone?: string;
    displayName?: string;
    username?: string;
    newPin?: string;
    currentPin?: string;
  }
): Promise<{
  ok: boolean;
  error?: string;
  uid?: string;
  username?: string | null;
  walletId?: string;
  hasPinSet?: boolean;
}> {
  if (!dbAdmin) return { ok: false, error: 'Database unavailable.' };

  const userRec = await findOrEnsureWalletUser(dbAdmin, {
    uid: params.uid,
    phone: params.phone,
    displayName: params.displayName,
    createIfMissing: Boolean(params.uid || (params.phone && params.phone.replace(/\D/g, '').length >= 9)),
  });
  if (!userRec) {
    return { ok: false, error: 'Akaunti ya PapoPay haikupatikana.' };
  }

  const nowIso = new Date().toISOString();
  let nextUsernameObj: { lower: string; handle: string } | null = null;
  if (typeof params.username === 'string' && params.username.trim().length > 0) {
    const parsedU = normalizeUsername(params.username);
    if (!parsedU.valid) {
      return { ok: false, error: parsedU.reason };
    }
    nextUsernameObj = { lower: parsedU.lower, handle: parsedU.handle };
  }

  let nextPinData: { hash: string; salt: string } | null = null;
  if (typeof params.newPin === 'string' && params.newPin.trim().length > 0) {
    const pinFmt = validatePinFormat(params.newPin);
    if (!pinFmt.valid) {
      return { ok: false, error: pinFmt.reason };
    }
    const alreadyHasPin = Boolean(
      userRec.data?.walletPinHash || userRec.data?.walletPin || userRec.data?.pin
    );
    if (alreadyHasPin) {
      const curCheck = verifyTransactionPinRecord(userRec.data, String(params.currentPin || ''));
      if (!curCheck.ok) {
        return {
          ok: false,
          error:
            curCheck.code === 'LOCKED'
              ? curCheck.reason
              : 'Weka PIN ya sasa iliyo sahihi kabla ya kubadilisha PIN.',
        };
      }
    }
    nextPinData = hashTransactionPin(pinFmt.clean);
  }

  const canonicalWalletId = deriveCanonicalWalletId(userRec.data, userRec.uid);

  try {
    const outcome = await dbAdmin.runTransaction(async (tx: any) => {
      const userRef = dbAdmin.collection('users').doc(userRec.uid);
      const userSnap = await tx.get(userRef);
      const currentData = userSnap?.data() || userRec.data || {};
      const oldUsernameLower = String(currentData.usernameLower || '').trim().toLowerCase();

      if (nextUsernameObj && nextUsernameObj.lower !== oldUsernameLower) {
        const newUnameRef = dbAdmin.collection('usernames').doc(nextUsernameObj.lower);
        const newUnameSnap = await tx.get(newUnameRef);
        if (newUnameSnap?.exists && newUnameSnap.data()?.uid && newUnameSnap.data().uid !== userRec.uid) {
          throw new Error('USERNAME_TAKEN');
        }
        tx.set(newUnameRef, {
          uid: userRec.uid,
          usernameLower: nextUsernameObj.lower,
          username: nextUsernameObj.lower,
          updatedAt: nowIso,
        });
        if (oldUsernameLower) {
          tx.delete(dbAdmin.collection('usernames').doc(oldUsernameLower));
        }
      }

      const widRef = dbAdmin.collection('wallet_ids').doc(canonicalWalletId);
      tx.set(widRef, { uid: userRec.uid, walletId: canonicalWalletId, updatedAt: nowIso }, { merge: true });

      const updates: Record<string, any> = {
        walletId: canonicalWalletId,
        updatedAt: nowIso,
      };
      if (params.displayName && params.displayName.trim()) {
        updates.displayName = params.displayName.trim();
      }
      if (nextUsernameObj) {
        updates.username = nextUsernameObj.lower;
        updates.usernameLower = nextUsernameObj.lower;
      }
      if (nextPinData) {
        updates.walletPinHash = nextPinData.hash;
        updates.walletPinSalt = nextPinData.salt;
        updates.pinFailedAttempts = 0;
        updates.pinLockedUntilMs = 0;
        updates.walletPin = null;
        updates.pin = null;
        updates.pinUpdatedAt = nowIso;
      }

      tx.set(userRef, cleanUndefined(updates), { merge: true });

      const finalUsername = nextUsernameObj
        ? nextUsernameObj.handle
        : currentData.username
        ? `@${String(currentData.username).replace(/^@+/, '')}`
        : null;
      const hasPinSet = Boolean(nextPinData || currentData.walletPinHash || currentData.walletPin || currentData.pin);

      return {
        username: finalUsername,
        walletId: canonicalWalletId,
        hasPinSet,
      };
    });

    return {
      ok: true,
      uid: userRec.uid,
      ...outcome,
    };
  } catch (err: any) {
    if (String(err?.message || '') === 'USERNAME_TAKEN') {
      return { ok: false, error: 'Username hii tayari inatumiwa na mtu mwingine. Chagua nyingine.' };
    }
    return { ok: false, error: 'Imeshindikana kusasisha wasifu wa PapoPay.' };
  }
}

async function verifyAndConsumePinAttempt(
  dbAdmin: any,
  userUid: string,
  suppliedPin: string
): Promise<{ ok: boolean; code?: string; error?: string }> {
  const userSnap = await dbAdmin.collection('users').doc(userUid).get();
  if (!userSnap?.exists) {
    return { ok: false, code: 'USER_NOT_FOUND', error: 'Akaunti ya mtumiaji haikupatikana.' };
  }
  const userData = userSnap.data() || {};
  const check = verifyTransactionPinRecord(userData, suppliedPin);

  if (!check.ok) {
    if (check.code === 'INVALID_PIN') {
      const nextFails = Number(userData.pinFailedAttempts || 0) + 1;
      const shouldLock = nextFails >= 5;
      await dbAdmin
        .collection('users')
        .doc(userUid)
        .set(
          cleanUndefined({
            pinFailedAttempts: nextFails,
            ...(shouldLock ? { pinLockedUntilMs: Date.now() + 15 * 60 * 1000 } : {}),
            updatedAt: new Date().toISOString(),
          }),
          { merge: true }
        )
        .catch(() => {});
      if (shouldLock) {
        return {
          ok: false,
          code: 'LOCKED',
          error: 'PIN imekosewa mara 5. Akaunti imefungwa kwa dakika 15 kwa usalama.',
        };
      }
    }
    return { ok: false, code: check.code, error: check.reason };
  }

  // Reset failure counters and upgrade legacy plaintext PIN cleanly
  const patch: Record<string, any> = {};
  if (Number(userData.pinFailedAttempts || 0) > 0 || Number(userData.pinLockedUntilMs || 0) > 0) {
    patch.pinFailedAttempts = 0;
    patch.pinLockedUntilMs = 0;
  }
  if (check.needsHashUpgrade) {
    const upgraded = hashTransactionPin(suppliedPin);
    patch.walletPinHash = upgraded.hash;
    patch.walletPinSalt = upgraded.salt;
    patch.walletPin = null;
    patch.pin = null;
  }
  if (Object.keys(patch).length > 0) {
    await dbAdmin.collection('users').doc(userUid).set(patch, { merge: true }).catch(() => {});
  }

  return { ok: true };
}

export interface SecureTransferResult {
  ok: boolean;
  code?: string;
  reason?: string;
  duplicate?: boolean;
  transactionId?: string;
  refCode?: string;
  amount?: number;
  fee?: number;
  totalDebit?: number;
  newSenderBalance?: number;
  sender?: {
    uid: string;
    displayName: string;
    username: string | null;
    walletId: string;
    phone: string | null;
  };
  recipient?: VerifiedRecipientProfile;
  createdAt?: string;
}

/**
 * Atomic, Idempotent, PIN-Verified PapoPay-to-PapoPay Transfer via @username, Wallet ID, or Phone.
 */
export async function executeSecureP2PTransfer(
  dbAdmin: any,
  params: {
    senderUid?: string;
    senderPhone?: string;
    recipientQuery: string;
    amount: number;
    pin: string;
    idempotencyKey?: string;
    note?: string;
    channel?: 'web' | 'whatsapp' | 'api';
  }
): Promise<SecureTransferResult> {
  if (!dbAdmin) {
    return { ok: false, code: 'DB_UNAVAILABLE', reason: 'Database service is unavailable.' };
  }

  const rawAmt = Number(params.amount);
  const amount = Math.round(rawAmt);
  if (!Number.isFinite(rawAmt) || !Number.isInteger(amount) || amount < 100) {
    return {
      ok: false,
      code: 'INVALID_AMOUNT',
      reason: 'Kiasi cha chini cha kutuma ni TZS 100.',
    };
  }

  const sender = await findOrEnsureWalletUser(dbAdmin, {
    uid: params.senderUid,
    phone: params.senderPhone,
    createIfMissing: false,
  });
  if (!sender) {
    return {
      ok: false,
      code: 'SENDER_NOT_FOUND',
      reason: 'Akaunti yako ya PapoPay haijapatikana au haijawekwa salio bado.',
    };
  }

  // Check recipient BEFORE or alongside PIN so clear validation errors surface immediately
  const recipient = await lookupP2PRecipientVerified(dbAdmin, params.recipientQuery);
  if (!recipient.found || !recipient.uid) {
    return {
      ok: false,
      code: 'RECIPIENT_NOT_FOUND',
      reason: 'Mpokeaji hakupatikana. Hakikisha @username au Wallet ID ya PapoPay ni sahihi.',
    };
  }

  const senderWalletId = deriveCanonicalWalletId(sender.data, sender.uid);
  const senderLast9 = String(sender.data?.phoneNumber || sender.data?.phone || params.senderPhone || '')
    .replace(/\D/g, '')
    .slice(-9);
  const recLast9 = String(recipient.phone || '').replace(/\D/g, '').slice(-9);

  if (
    recipient.uid === sender.uid ||
    (recipient.walletId && recipient.walletId.toUpperCase() === senderWalletId.toUpperCase()) ||
    (senderLast9 && recLast9 && senderLast9 === recLast9)
  ) {
    return {
      ok: false,
      code: 'SELF_TRANSFER',
      reason: 'Huwezi kujitumia pesa kwako mwenyewe.',
    };
  }

  const pinCheck = await verifyAndConsumePinAttempt(dbAdmin, sender.uid, params.pin);
  if (!pinCheck.ok) {
    return {
      ok: false,
      code: pinCheck.code || 'INVALID_PIN',
      reason: pinCheck.error,
    };
  }

  const settings = await getPapoPayTreasurySettings(dbAdmin);
  const fee = computeTransferFee(amount, settings);
  const totalDebit = amount + fee;
  const noteText = String(params.note || 'PapoPay Transfer').trim().slice(0, 120);
  const cleanIdem = String(params.idempotencyKey || '').trim().replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 96);
  const idemDocId = cleanIdem ? `trf_${sender.uid}_${cleanIdem}` : '';

  const txRefCode = generateUniqueRef('PAPO-TRF');
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const senderDisplayName = String(sender.data?.displayName || sender.data?.fullName || 'PapoPay User');
  const senderUsername = sender.data?.username
    ? `@${String(sender.data.username).replace(/^@+/, '')}`
    : sender.data?.usernameLower
    ? `@${sender.data.usernameLower}`
    : null;
  const senderPhone = String(sender.data?.phoneNumber || sender.data?.phone || params.senderPhone || '');

  try {
    const txOutcome = await dbAdmin.runTransaction(async (tx: any) => {
      let existingIdemSnap: any = null;
      const idemRef = idemDocId ? dbAdmin.collection('idempotency_keys').doc(idemDocId) : null;
      if (idemRef) {
        existingIdemSnap = await tx.get(idemRef);
        if (existingIdemSnap?.exists && existingIdemSnap.data()?.status === 'completed' && existingIdemSnap.data()?.result) {
          return { duplicate: true, cachedResult: existingIdemSnap.data().result };
        }
      }

      const senderRef = dbAdmin.collection('users').doc(sender.uid);
      const recipientRef = dbAdmin.collection('users').doc(recipient.uid!);
      const [senderSnap, recipientSnap] = await Promise.all([tx.get(senderRef), tx.get(recipientRef)]);

      if (!senderSnap?.exists) throw new Error('SENDER_NOT_FOUND');
      if (!recipientSnap?.exists) throw new Error('RECIPIENT_NOT_FOUND');

      const sData = senderSnap.data() || {};
      const rData = recipientSnap.data() || {};
      const curSenderBal = Number(sData.walletBalance || 0);
      const curRecipientBal = Number(rData.walletBalance || 0);

      if (curSenderBal < totalDebit || curSenderBal - totalDebit < 0) {
        throw new Error(`INSUFFICIENT:${curSenderBal}`);
      }

      const newSenderBalance = curSenderBal - totalDebit;
      const newRecipientBalance = curRecipientBal + amount;

      tx.set(
        senderRef,
        {
          walletBalance: newSenderBalance,
          walletId: senderWalletId,
          updatedAt: nowIso,
        },
        { merge: true }
      );
      tx.set(
        recipientRef,
        {
          walletBalance: newRecipientBalance,
          walletId: recipient.walletId || deriveCanonicalWalletId(rData, recipient.uid!),
          updatedAt: nowIso,
        },
        { merge: true }
      );

      const senderLedgerId = `${txRefCode}-SND`;
      const recipientLedgerId = `${txRefCode}-RCV`;
      const feeLedgerId = `${txRefCode}-FEE`;

      const sharedMeta = {
        transactionId: txRefCode,
        refCode: txRefCode,
        senderUid: sender.uid,
        senderName: senderDisplayName,
        senderUsername: senderUsername || undefined,
        senderWalletId,
        senderPhone: senderPhone || undefined,
        recipientUid: recipient.uid,
        recipientName: recipient.displayName,
        recipientUsername: recipient.username || undefined,
        recipientWalletId: recipient.walletId || undefined,
        recipientPhone: recipient.phone || undefined,
        paymentMethod: 'PapoPay Wallet',
        channel: params.channel || 'web',
        note: noteText,
        currency: 'TZS',
        createdAt: nowIso,
        createdAtMs: nowMs,
      };

      tx.set(
        dbAdmin.collection('wallet_transactions').doc(senderLedgerId),
        cleanUndefined({
          ...sharedMeta,
          id: senderLedgerId,
          ownerUid: sender.uid,
          type: 'MONEY_SENT' as WalletTransactionType,
          typeLabel: WALLET_TX_TYPE_LABELS.MONEY_SENT,
          direction: 'debit',
          amount,
          fee,
          totalAmount: totalDebit,
          status: 'completed',
          title: `Sent to ${recipient.displayName}${recipient.username ? ` (${recipient.username})` : ''}`,
          subtitle: `${txRefCode} • PapoPay Wallet`,
        })
      );

      tx.set(
        dbAdmin.collection('wallet_transactions').doc(recipientLedgerId),
        cleanUndefined({
          ...sharedMeta,
          id: recipientLedgerId,
          ownerUid: recipient.uid,
          type: 'MONEY_RECEIVED' as WalletTransactionType,
          typeLabel: WALLET_TX_TYPE_LABELS.MONEY_RECEIVED,
          direction: 'credit',
          amount,
          fee: 0,
          totalAmount: amount,
          status: 'completed',
          title: `Received from ${senderDisplayName}${senderUsername ? ` (${senderUsername})` : ''}`,
          subtitle: `${txRefCode} • PapoPay Wallet`,
        })
      );

      if (fee > 0) {
        tx.set(
          dbAdmin.collection('wallet_transactions').doc(feeLedgerId),
          cleanUndefined({
            ...sharedMeta,
            id: feeLedgerId,
            ownerUid: sender.uid,
            type: 'TRANSACTION_FEE' as WalletTransactionType,
            typeLabel: WALLET_TX_TYPE_LABELS.TRANSACTION_FEE,
            direction: 'debit',
            amount: fee,
            fee,
            totalAmount: fee,
            status: 'completed',
            title: `Transfer Fee (${txRefCode})`,
            subtitle: `PapoPay Wallet Transfer Fee`,
          })
        );
      }

      // Synced legacy payments rows for existing real-time UI listeners
      tx.set(
        dbAdmin.collection('payments').doc(senderLedgerId),
        cleanUndefined({
          uid: sender.uid,
          phone: senderPhone,
          title: `Tuma Pesa kwa ${recipient.displayName}${recipient.username ? ` (${recipient.username})` : ''}`,
          subtitle: `PAPO-TO-PAPO${fee > 0 ? ` • Ada TZS ${fee.toLocaleString()}` : ' (0% ADA)'} • ${noteText}`,
          amount: totalDebit,
          fee,
          type: 'debit',
          txType: 'MONEY_SENT',
          category: 'transfer',
          status: 'completed',
          refCode: txRefCode,
          senderName: senderDisplayName,
          recipientName: recipient.displayName,
          paymentMethod: 'PapoPay Wallet',
          createdAt: nowIso,
          createdAtMs: nowMs,
        })
      );

      tx.set(
        dbAdmin.collection('payments').doc(recipientLedgerId),
        cleanUndefined({
          uid: recipient.uid,
          phone: recipient.phone || '',
          title: `Umepokea Pesa kutoka ${senderDisplayName}${senderUsername ? ` (${senderUsername})` : ''}`,
          subtitle: `PAPO-TO-PAPO (0% ADA) • ${noteText}`,
          amount,
          fee: 0,
          type: 'credit',
          txType: 'MONEY_RECEIVED',
          category: 'transfer',
          status: 'completed',
          refCode: txRefCode,
          senderName: senderDisplayName,
          recipientName: recipient.displayName,
          paymentMethod: 'PapoPay Wallet',
          createdAt: nowIso,
          createdAtMs: nowMs,
        })
      );

      // Notifications for both sender and recipient
      tx.set(
        dbAdmin.collection('notifications').doc(`${txRefCode}-NS`),
        cleanUndefined({
          uid: sender.uid,
          type: 'wallet_transfer_sent',
          title: `Money Sent: TZS ${amount.toLocaleString()}`,
          message: `You sent TZS ${amount.toLocaleString()} to ${recipient.displayName}${recipient.username ? ` (${recipient.username})` : ''}. Ref: ${txRefCode}`,
          refCode: txRefCode,
          read: false,
          createdAt: nowIso,
        })
      );

      tx.set(
        dbAdmin.collection('notifications').doc(`${txRefCode}-NR`),
        cleanUndefined({
          uid: recipient.uid,
          type: 'wallet_transfer_received',
          title: `Money Received: +TZS ${amount.toLocaleString()}`,
          message: `You received TZS ${amount.toLocaleString()} from ${senderDisplayName}${senderUsername ? ` (${senderUsername})` : ''}. Ref: ${txRefCode}`,
          refCode: txRefCode,
          read: false,
          createdAt: nowIso,
        })
      );

      const finalResult: SecureTransferResult = {
        ok: true,
        duplicate: false,
        transactionId: txRefCode,
        refCode: txRefCode,
        amount,
        fee,
        totalDebit,
        newSenderBalance,
        sender: {
          uid: sender.uid,
          displayName: senderDisplayName,
          username: senderUsername,
          walletId: senderWalletId,
          phone: senderPhone || null,
        },
        recipient,
        createdAt: nowIso,
      };

      if (idemRef) {
        tx.set(idemRef, {
          key: cleanIdem,
          scope: 'transfer',
          uid: sender.uid,
          status: 'completed',
          refCode: txRefCode,
          result: finalResult,
          createdAt: nowIso,
        });
      }

      return { duplicate: false, finalResult };
    });

    if (txOutcome.duplicate && txOutcome.cachedResult) {
      return {
        ...txOutcome.cachedResult,
        duplicate: true,
      };
    }

    return txOutcome.finalResult!;
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.startsWith('INSUFFICIENT:')) {
      const bal = Number(msg.split(':')[1] || 0);
      return {
        ok: false,
        code: 'INSUFFICIENT_BALANCE',
        reason: `Salio halitoshi (Una TZS ${bal.toLocaleString()}, unahitaji TZS ${totalDebit.toLocaleString()}).`,
      };
    }
    if (msg === 'RECIPIENT_NOT_FOUND') {
      return {
        ok: false,
        code: 'RECIPIENT_NOT_FOUND',
        reason: 'Mpokeaji hakupatikana kwenye PapoPay.',
      };
    }
    return {
      ok: false,
      code: 'TRANSACTION_FAILED',
      reason: 'Muamala umeshindikana kutokana na hitilafu ya mfumo. Hakuna pesa iliyokatwa.',
    };
  }
}

export interface SecureWithdrawalResult {
  ok: boolean;
  code?: string;
  reason?: string;
  duplicate?: boolean;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  transactionId?: string;
  refCode?: string;
  gatewayRef?: string;
  network?: MobileMoneyNetwork;
  networkLabel?: string;
  recipientPhone?: string;
  amount?: number;
  fee?: number;
  totalDebit?: number;
  newAvailableBalance?: number;
  newReservedBalance?: number;
  provider?: string;
  message?: string;
  createdAt?: string;
}

/**
 * Atomic, Idempotent, PIN-Verified Mobile Money Withdrawal with Safe Fund Reservation (walletBalance -> reservedBalance).
 * Never fakes completions and never permanently destroys funds when an external API is disabled or pending.
 */
export async function executeSecureMobileWithdrawal(
  dbAdmin: any,
  params: {
    senderUid?: string;
    senderPhone?: string;
    network: string;
    recipientPhone: string;
    amount: number;
    pin: string;
    idempotencyKey?: string;
    note?: string;
    channel?: 'web' | 'whatsapp' | 'api';
  }
): Promise<SecureWithdrawalResult> {
  if (!dbAdmin) {
    return { ok: false, code: 'DB_UNAVAILABLE', reason: 'Database service is unavailable.' };
  }

  const settings = await getPapoPayTreasurySettings(dbAdmin);
  const cleanRecipientMsisdn = normalizePhoneForDaliPay(params.recipientPhone);
  const cleanNetwork = normalizeMobileMoneyNetwork(params.network, cleanRecipientMsisdn);
  if (!cleanNetwork) {
    return {
      ok: false,
      code: 'UNSUPPORTED_NETWORK',
      reason: 'Chagua mtandao halali: M-Pesa, Tigo Pesa, Airtel Money, au HaloPesa.',
    };
  }

  if (settings.enabledNetworks[cleanNetwork] === false) {
    return {
      ok: false,
      code: 'NETWORK_DISABLED',
      reason: `Huduma ya kutoa pesa kwenda ${getMobileMoneyNetworkLabel(cleanNetwork)} imezimwa kwa muda na Admin.`,
    };
  }

  if (cleanRecipientMsisdn.replace(/\D/g, '').length < 9) {
    return {
      ok: false,
      code: 'INVALID_RECIPIENT_PHONE',
      reason: 'Weka namba sahihi ya simu ya mpokeaji wa Tanzania (mf. 0712345678).',
    };
  }

  const rawAmt = Number(params.amount);
  const amount = Math.round(rawAmt);
  if (!Number.isFinite(rawAmt) || !Number.isInteger(amount) || amount < settings.withdrawalMinAmount) {
    return {
      ok: false,
      code: 'INVALID_AMOUNT',
      reason: `Kiasi cha chini cha kutoa kwenda mitandao ya simu ni TZS ${settings.withdrawalMinAmount.toLocaleString()}.`,
    };
  }
  if (amount > settings.withdrawalMaxAmount) {
    return {
      ok: false,
      code: 'AMOUNT_ABOVE_LIMIT',
      reason: `Kiasi cha juu kwa muamala mmoja ni TZS ${settings.withdrawalMaxAmount.toLocaleString()}.`,
    };
  }

  const sender = await findOrEnsureWalletUser(dbAdmin, {
    uid: params.senderUid,
    phone: params.senderPhone,
    createIfMissing: false,
  });
  if (!sender) {
    return {
      ok: false,
      code: 'SENDER_NOT_FOUND',
      reason: 'Akaunti yako ya PapoPay haikupatikana au haina salio.',
    };
  }

  const pinCheck = await verifyAndConsumePinAttempt(dbAdmin, sender.uid, params.pin);
  if (!pinCheck.ok) {
    return {
      ok: false,
      code: pinCheck.code || 'INVALID_PIN',
      reason: pinCheck.error,
    };
  }

  const fee = computeWithdrawalFee(amount, settings);
  const totalDebit = amount + fee;
  const networkLabel = getMobileMoneyNetworkLabel(cleanNetwork);
  const formattedPhone = `+${cleanRecipientMsisdn}`;
  const noteText = String(params.note || `${networkLabel} Withdrawal`).trim().slice(0, 120);
  const cleanIdem = String(params.idempotencyKey || '').trim().replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 96);
  const idemDocId = cleanIdem ? `wth_${sender.uid}_${cleanIdem}` : '';

  const refCode = generateUniqueRef('MMW');
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const senderDisplayName = String(sender.data?.displayName || sender.data?.fullName || 'PapoPay User');
  const senderWalletId = deriveCanonicalWalletId(sender.data, sender.uid);
  const senderPhoneStr = String(sender.data?.phoneNumber || sender.data?.phone || params.senderPhone || '');

  let reservation: {
    duplicate: boolean;
    cachedResult?: SecureWithdrawalResult;
    newAvailableBalance: number;
    newReservedBalance: number;
  };

  try {
    reservation = await dbAdmin.runTransaction(async (tx: any) => {
      const idemRef = idemDocId ? dbAdmin.collection('idempotency_keys').doc(idemDocId) : null;
      if (idemRef) {
        const idemSnap = await tx.get(idemRef);
        if (idemSnap?.exists && idemSnap.data()?.result) {
          return {
            duplicate: true,
            cachedResult: idemSnap.data().result,
            newAvailableBalance: 0,
            newReservedBalance: 0,
          };
        }
      }

      const senderRef = dbAdmin.collection('users').doc(sender.uid);
      const senderSnap = await tx.get(senderRef);
      if (!senderSnap?.exists) throw new Error('SENDER_NOT_FOUND');

      const sData = senderSnap.data() || {};
      const curBal = Number(sData.walletBalance || 0);
      const curReserved = Number(sData.reservedBalance || 0);

      if (curBal < totalDebit || curBal - totalDebit < 0) {
        throw new Error(`INSUFFICIENT:${curBal}`);
      }

      const nextBal = curBal - totalDebit;
      const nextReserved = curReserved + totalDebit;

      tx.set(
        senderRef,
        {
          walletBalance: nextBal,
          reservedBalance: nextReserved,
          walletId: senderWalletId,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      tx.set(
        dbAdmin.collection('disbursements').doc(refCode),
        cleanUndefined({
          reference: refCode,
          transactionId: refCode,
          provider: settings.b2cProvider,
          channel: 'mobile_money',
          network: cleanNetwork,
          networkLabel,
          recipientPhone: formattedPhone,
          recipientName: senderDisplayName,
          payerUid: sender.uid,
          payerName: senderDisplayName,
          payerPhone: senderPhoneStr || formattedPhone,
          payerWalletId: senderWalletId,
          amount,
          fee,
          totalDebit,
          holdAmount: totalDebit,
          status: 'pending_admin_settlement',
          refundedOnFailure: false,
          settledOnCompletion: false,
          note: noteText,
          idempotencyKey: cleanIdem || undefined,
          createdAt: nowIso,
          createdAtMs: nowMs,
          updatedAt: nowIso,
        })
      );

      const pendingTxId = `${refCode}-PND`;
      tx.set(
        dbAdmin.collection('wallet_transactions').doc(pendingTxId),
        cleanUndefined({
          id: pendingTxId,
          transactionId: refCode,
          refCode,
          ownerUid: sender.uid,
          type: 'PENDING_WITHDRAWAL' as WalletTransactionType,
          typeLabel: WALLET_TX_TYPE_LABELS.PENDING_WITHDRAWAL,
          direction: 'debit',
          amount,
          fee,
          totalAmount: totalDebit,
          status: 'pending',
          paymentMethod: networkLabel,
          network: cleanNetwork,
          senderUid: sender.uid,
          senderName: senderDisplayName,
          senderWalletId,
          senderPhone: senderPhoneStr || undefined,
          recipientUid: null,
          recipientName: `${networkLabel} (${formattedPhone})`,
          recipientPhone: formattedPhone,
          title: `Pending Withdrawal: ${networkLabel} (${formattedPhone})`,
          subtitle: `${refCode} • Funds reserved awaiting settlement`,
          note: noteText,
          currency: 'TZS',
          createdAt: nowIso,
          createdAtMs: nowMs,
        })
      );

      tx.set(
        dbAdmin.collection('payments').doc(pendingTxId),
        cleanUndefined({
          uid: sender.uid,
          phone: senderPhoneStr || formattedPhone,
          recipientPhone: formattedPhone,
          recipientName: `${networkLabel} (${formattedPhone})`,
          title: `Toa Pesa kwenda ${networkLabel} (${formattedPhone})`,
          subtitle: `${refCode} • Fedha zimezuiliwa • Ada TZS ${fee.toLocaleString()}`,
          amount: totalDebit,
          fee,
          type: 'debit',
          txType: 'PENDING_WITHDRAWAL',
          category: 'withdraw',
          status: 'pending',
          refCode,
          paymentMethod: networkLabel,
          createdAt: nowIso,
          createdAtMs: nowMs,
        })
      );

      tx.set(
        dbAdmin.collection('notifications').doc(`${refCode}-USR`),
        cleanUndefined({
          uid: sender.uid,
          type: 'withdrawal_pending',
          title: `Withdrawal Pending: TZS ${amount.toLocaleString()}`,
          message: `Withdrawal request to ${networkLabel} (${formattedPhone}) recorded (#${refCode}). TZS ${totalDebit.toLocaleString()} is safely reserved.`,
          refCode,
          read: false,
          createdAt: nowIso,
        })
      );

      tx.set(
        dbAdmin.collection('notifications').doc(`${refCode}-ADM`),
        cleanUndefined({
          type: 'admin_withdrawal_pending',
          title: `New Mobile Money Payout: ${networkLabel} TZS ${amount.toLocaleString()}`,
          message: `${senderDisplayName} requested withdrawal to ${formattedPhone} (#${refCode}). Approve after settlement.`,
          refCode,
          read: false,
          createdAt: nowIso,
        })
      );

      const initialResult: SecureWithdrawalResult = {
        ok: true,
        duplicate: false,
        status: 'pending',
        transactionId: refCode,
        refCode,
        network: cleanNetwork,
        networkLabel,
        recipientPhone: formattedPhone,
        amount,
        fee,
        totalDebit,
        newAvailableBalance: nextBal,
        newReservedBalance: nextReserved,
        provider: settings.b2cProvider,
        message: `Ombi la kutoa TZS ${amount.toLocaleString()} kwenda ${networkLabel} (${formattedPhone}) limehifadhiwa (PENDING) na fedha zimezuiliwa salama.`,
        createdAt: nowIso,
      };

      if (idemRef) {
        tx.set(idemRef, {
          key: cleanIdem,
          scope: 'withdraw',
          uid: sender.uid,
          status: 'completed',
          refCode,
          result: initialResult,
          createdAt: nowIso,
        });
      }

      return {
        duplicate: false,
        newAvailableBalance: nextBal,
        newReservedBalance: nextReserved,
      };
    });
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.startsWith('INSUFFICIENT:')) {
      const bal = Number(msg.split(':')[1] || 0);
      return {
        ok: false,
        code: 'INSUFFICIENT_BALANCE',
        reason: `Salio halitoshi kutoa TZS ${amount.toLocaleString()} + Ada TZS ${fee.toLocaleString()} (Una TZS ${bal.toLocaleString()}).`,
      };
    }
    return {
      ok: false,
      code: 'WITHDRAWAL_RESERVATION_FAILED',
      reason: 'Imeshindikana kuhifadhi ombi la kutoa pesa. Hakuna pesa iliyokatwa.',
    };
  }

  if (reservation.duplicate && reservation.cachedResult) {
    return {
      ...reservation.cachedResult,
      duplicate: true,
    };
  }

  // Dispatch through modular payout provider (never hits disabled DaliPay endpoint if disabled!)
  const dispatch = await dispatchModularMobileMoneyPayout(dbAdmin, settings, {
    reference: refCode,
    amount,
    fee,
    totalDebit,
    network: cleanNetwork,
    recipientPhone: cleanRecipientMsisdn,
    recipientName: senderDisplayName,
    payerUid: sender.uid,
    reason: noteText,
  });

  if (dispatch.outcome === 'completed') {
    const settled = await finalizeCompletedPayout(dbAdmin, {
      refCode,
      externalReference: dispatch.gatewayRef || refCode,
      actorUid: 'system_b2c',
      actorEmail: dispatch.provider,
      note: dispatch.message,
    });
    return {
      ok: true,
      status: 'completed',
      transactionId: refCode,
      refCode,
      gatewayRef: dispatch.gatewayRef || refCode,
      network: cleanNetwork,
      networkLabel,
      recipientPhone: formattedPhone,
      amount,
      fee,
      totalDebit,
      newAvailableBalance: reservation.newAvailableBalance,
      newReservedBalance: settled.ok ? settled.newReservedBalance : 0,
      provider: dispatch.provider,
      message: dispatch.message,
      createdAt: nowIso,
    };
  }

  if (dispatch.outcome === 'pending_provider_webhook') {
    await dbAdmin
      .collection('disbursements')
      .doc(refCode)
      .set(
        cleanUndefined({
          status: 'processing',
          provider: dispatch.provider,
          gatewayRef: dispatch.gatewayRef,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      )
      .catch(() => {});

    return {
      ok: true,
      status: 'processing',
      transactionId: refCode,
      refCode,
      gatewayRef: dispatch.gatewayRef,
      network: cleanNetwork,
      networkLabel,
      recipientPhone: formattedPhone,
      amount,
      fee,
      totalDebit,
      newAvailableBalance: reservation.newAvailableBalance,
      newReservedBalance: reservation.newReservedBalance,
      provider: dispatch.provider,
      message: dispatch.message,
      createdAt: nowIso,
    };
  }

  if (dispatch.outcome === 'definitive_failure') {
    const release = await releaseReservedPayoutFunds(dbAdmin, {
      refCode,
      reason: dispatch.message,
      actorUid: 'system_b2c',
      actorEmail: dispatch.provider,
    });
    return {
      ok: false,
      code: 'PAYOUT_PROVIDER_FAILED',
      status: 'failed',
      transactionId: refCode,
      refCode,
      network: cleanNetwork,
      networkLabel,
      recipientPhone: formattedPhone,
      amount,
      fee,
      totalDebit,
      newAvailableBalance: release.ok ? release.newAvailableBalance : reservation.newAvailableBalance + totalDebit,
      newReservedBalance: release.ok ? release.newReservedBalance : 0,
      provider: dispatch.provider,
      reason: `${dispatch.message} (Fedha zimerudishwa kwenye PapoWallet yako kiotomatiki).`,
      createdAt: nowIso,
    };
  }

  // Default safe outcome: 'pending_admin_settlement'
  return {
    ok: true,
    status: 'pending',
    transactionId: refCode,
    refCode,
    network: cleanNetwork,
    networkLabel,
    recipientPhone: formattedPhone,
    amount,
    fee,
    totalDebit,
    newAvailableBalance: reservation.newAvailableBalance,
    newReservedBalance: reservation.newReservedBalance,
    provider: dispatch.provider,
    message: dispatch.message,
    createdAt: nowIso,
  };
}

/**
 * Atomically releases reserved payout funds back to user's available walletBalance when a payout fails or is rejected.
 */
export async function releaseReservedPayoutFunds(
  dbAdmin: any,
  params: {
    refCode: string;
    reason: string;
    actorUid: string;
    actorEmail?: string;
    externalReference?: string;
  }
): Promise<{
  ok: boolean;
  error?: string;
  alreadyResolved?: boolean;
  newAvailableBalance?: number;
  newReservedBalance?: number;
  refundedAmount?: number;
}> {
  if (!dbAdmin || !params.refCode) {
    return { ok: false, error: 'Reference code is required.' };
  }

  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const cleanReason = String(params.reason || 'Payout could not be completed').trim().slice(0, 200);

  try {
    return await dbAdmin.runTransaction(async (tx: any) => {
      const disbRef = dbAdmin.collection('disbursements').doc(params.refCode);
      const disbSnap = await tx.get(disbRef);
      if (!disbSnap?.exists) {
        throw new Error('DISBURSEMENT_NOT_FOUND');
      }
      const d = disbSnap.data() || {};
      if (d.refundedOnFailure === true || d.status === 'failed' || d.status === 'rejected') {
        return { ok: true, alreadyResolved: true, refundedAmount: Number(d.refundedAmount || 0) };
      }
      if (d.settledOnCompletion === true || d.status === 'completed') {
        throw new Error('ALREADY_COMPLETED');
      }

      const payerUid = String(d.payerUid || '').trim();
      const holdAmt = Number(d.holdAmount ?? d.totalDebit ?? d.amount ?? 0);
      if (!payerUid || holdAmt <= 0) {
        throw new Error('INVALID_PAYOUT_RECORD');
      }

      const userRef = dbAdmin.collection('users').doc(payerUid);
      const userSnap = await tx.get(userRef);
      if (!userSnap?.exists) throw new Error('USER_NOT_FOUND');

      const uData = userSnap.data() || {};
      const curBal = Number(uData.walletBalance || 0);
      const curReserved = Number(uData.reservedBalance || 0);

      // Move reserved back to available walletBalance safely
      const nextAvailable = curBal + holdAmt;
      const nextReserved = Math.max(0, curReserved - holdAmt);

      tx.set(
        userRef,
        {
          walletBalance: nextAvailable,
          reservedBalance: nextReserved,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      tx.set(
        disbRef,
        cleanUndefined({
          status: 'failed',
          refundedOnFailure: true,
          refundedAmount: holdAmt,
          failureReason: cleanReason,
          externalReference: params.externalReference || d.externalReference || undefined,
          resolvedByUid: params.actorUid,
          resolvedByEmail: params.actorEmail || undefined,
          resolvedAt: nowIso,
          updatedAt: nowIso,
        }),
        { merge: true }
      );

      const failTxId = `${params.refCode}-FAIL`;
      const revTxId = `${params.refCode}-REV`;

      tx.set(
        dbAdmin.collection('wallet_transactions').doc(failTxId),
        cleanUndefined({
          id: failTxId,
          transactionId: params.refCode,
          refCode: params.refCode,
          ownerUid: payerUid,
          type: 'FAILED_WITHDRAWAL' as WalletTransactionType,
          typeLabel: WALLET_TX_TYPE_LABELS.FAILED_WITHDRAWAL,
          direction: 'info',
          amount: Number(d.amount || holdAmt),
          fee: Number(d.fee || 0),
          totalAmount: holdAmt,
          status: 'failed',
          paymentMethod: d.networkLabel || d.network || 'Mobile Money',
          network: d.network,
          senderUid: payerUid,
          senderName: d.payerName,
          senderPhone: d.payerPhone,
          recipientName: `${d.networkLabel || d.network} (${d.recipientPhone || ''})`,
          recipientPhone: d.recipientPhone,
          title: `Failed Withdrawal: ${d.networkLabel || d.network} (${d.recipientPhone || ''})`,
          subtitle: `${params.refCode} • ${cleanReason}`,
          currency: 'TZS',
          createdAt: nowIso,
          createdAtMs: nowMs,
        })
      );

      tx.set(
        dbAdmin.collection('wallet_transactions').doc(revTxId),
        cleanUndefined({
          id: revTxId,
          transactionId: `REV-${params.refCode}`,
          refCode: `REV-${params.refCode}`,
          relatedRefCode: params.refCode,
          ownerUid: payerUid,
          type: 'REVERSAL' as WalletTransactionType,
          typeLabel: WALLET_TX_TYPE_LABELS.REVERSAL,
          direction: 'credit',
          amount: holdAmt,
          fee: 0,
          totalAmount: holdAmt,
          status: 'completed',
          paymentMethod: 'PapoPay Reversal',
          senderUid: 'papopay-reserve',
          senderName: 'PapoPay Settlement Reserve',
          recipientUid: payerUid,
          recipientName: d.payerName || 'Wallet Owner',
          title: `Reversal for ${params.refCode}`,
          subtitle: `Reserved TZS ${holdAmt.toLocaleString()} returned to wallet`,
          currency: 'TZS',
          createdAt: nowIso,
          createdAtMs: nowMs + 1,
        })
      );

      tx.set(
        dbAdmin.collection('payments').doc(`${params.refCode}-PND`),
        { status: 'failed', subtitle: `${params.refCode} • Imeshindwa (${cleanReason})`, updatedAt: nowIso },
        { merge: true }
      );
      tx.set(
        dbAdmin.collection('payments').doc(revTxId),
        cleanUndefined({
          uid: payerUid,
          phone: d.payerPhone || d.recipientPhone || '',
          title: `Rejesho la Toa Pesa (${params.refCode})`,
          subtitle: `REVERSAL • ${cleanReason}`,
          amount: holdAmt,
          type: 'credit',
          txType: 'REVERSAL',
          category: 'refund',
          status: 'completed',
          refCode: `REV-${params.refCode}`,
          createdAt: nowIso,
          createdAtMs: nowMs + 1,
        })
      );

      tx.set(
        dbAdmin.collection('notifications').doc(`${params.refCode}-FAILUSR`),
        cleanUndefined({
          uid: payerUid,
          type: 'withdrawal_failed_reversed',
          title: `Withdrawal Reversed: +TZS ${holdAmt.toLocaleString()}`,
          message: `Withdrawal #${params.refCode} could not be completed (${cleanReason}). Reserved funds (TZS ${holdAmt.toLocaleString()}) have been returned to your available balance.`,
          refCode: params.refCode,
          read: false,
          createdAt: nowIso,
        })
      );

      tx.set(
        dbAdmin.collection('admin_audit_logs').doc(`AUD-${params.refCode}-${nowMs}`),
        cleanUndefined({
          action: 'PAYOUT_FAILED_AND_RELEASED',
          refCode: params.refCode,
          actorUid: params.actorUid,
          actorEmail: params.actorEmail || null,
          targetUid: payerUid,
          amount: holdAmt,
          reason: cleanReason,
          createdAt: nowIso,
          createdAtMs: nowMs,
        })
      );

      return {
        ok: true,
        alreadyResolved: false,
        newAvailableBalance: nextAvailable,
        newReservedBalance: nextReserved,
        refundedAmount: holdAmt,
      };
    });
  } catch (err: any) {
    const code = String(err?.message || '');
    if (code === 'DISBURSEMENT_NOT_FOUND') return { ok: false, error: 'Ombi la malipo halikupatikana.' };
    if (code === 'ALREADY_COMPLETED') return { ok: false, error: 'Malipo haya tayari yamekamilishwa na hayawezi kurejeshwa.' };
    return { ok: false, error: 'Imeshindikana kurejesha fedha zilizozuiliwa.' };
  }
}

/**
 * Atomically finalizes a pending withdrawal once an external confirmation reference is verified.
 */
export async function finalizeCompletedPayout(
  dbAdmin: any,
  params: {
    refCode: string;
    externalReference: string;
    actorUid: string;
    actorEmail?: string;
    note?: string;
  }
): Promise<{
  ok: boolean;
  error?: string;
  alreadyResolved?: boolean;
  newReservedBalance?: number;
}> {
  if (!dbAdmin || !params.refCode) {
    return { ok: false, error: 'Reference code is required.' };
  }
  const cleanExtRef = String(params.externalReference || '').trim();
  if (cleanExtRef.length < 5) {
    return {
      ok: false,
      error: 'External settlement reference/receipt (minimum 5 characters) is mandatory before completing.',
    };
  }

  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  try {
    return await dbAdmin.runTransaction(async (tx: any) => {
      const disbRef = dbAdmin.collection('disbursements').doc(params.refCode);
      const disbSnap = await tx.get(disbRef);
      if (!disbSnap?.exists) throw new Error('DISBURSEMENT_NOT_FOUND');

      const d = disbSnap.data() || {};
      if (d.settledOnCompletion === true || d.status === 'completed') {
        return { ok: true, alreadyResolved: true, newReservedBalance: 0 };
      }
      if (d.refundedOnFailure === true || d.status === 'failed' || d.status === 'rejected') {
        throw new Error('ALREADY_FAILED_REVERSED');
      }

      const payerUid = String(d.payerUid || '').trim();
      const holdAmt = Number(d.holdAmount ?? d.totalDebit ?? d.amount ?? 0);
      const userRef = dbAdmin.collection('users').doc(payerUid);
      const userSnap = await tx.get(userRef);
      if (!userSnap?.exists) throw new Error('USER_NOT_FOUND');

      const curReserved = Number(userSnap.data()?.reservedBalance || 0);
      const nextReserved = Math.max(0, curReserved - holdAmt);

      tx.set(
        userRef,
        {
          reservedBalance: nextReserved,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      tx.set(
        disbRef,
        cleanUndefined({
          status: 'completed',
          settledOnCompletion: true,
          externalReference: cleanExtRef,
          settlementNote: params.note || undefined,
          resolvedByUid: params.actorUid,
          resolvedByEmail: params.actorEmail || undefined,
          completedAt: nowIso,
          updatedAt: nowIso,
        }),
        { merge: true }
      );

      const doneTxId = `${params.refCode}-DONE`;
      tx.set(
        dbAdmin.collection('wallet_transactions').doc(doneTxId),
        cleanUndefined({
          id: doneTxId,
          transactionId: params.refCode,
          refCode: params.refCode,
          externalReference: cleanExtRef,
          ownerUid: payerUid,
          type: 'MOBILE_MONEY_WITHDRAWAL' as WalletTransactionType,
          typeLabel: WALLET_TX_TYPE_LABELS.MOBILE_MONEY_WITHDRAWAL,
          direction: 'debit',
          amount: Number(d.amount || 0),
          fee: Number(d.fee || 0),
          totalAmount: holdAmt,
          status: 'completed',
          paymentMethod: d.networkLabel || d.network || 'Mobile Money',
          network: d.network,
          senderUid: payerUid,
          senderName: d.payerName,
          senderPhone: d.payerPhone,
          recipientName: `${d.networkLabel || d.network} (${d.recipientPhone || ''})`,
          recipientPhone: d.recipientPhone,
          title: `Mobile Money Withdrawal: ${d.networkLabel || d.network} (${d.recipientPhone || ''})`,
          subtitle: `${params.refCode} • Receipt: ${cleanExtRef}`,
          currency: 'TZS',
          createdAt: nowIso,
          createdAtMs: nowMs,
        })
      );

      if (Number(d.fee || 0) > 0) {
        const feeTxId = `${params.refCode}-FEE`;
        tx.set(
          dbAdmin.collection('wallet_transactions').doc(feeTxId),
          cleanUndefined({
            id: feeTxId,
            transactionId: params.refCode,
            refCode: params.refCode,
            ownerUid: payerUid,
            type: 'TRANSACTION_FEE' as WalletTransactionType,
            typeLabel: WALLET_TX_TYPE_LABELS.TRANSACTION_FEE,
            direction: 'debit',
            amount: Number(d.fee),
            fee: Number(d.fee),
            totalAmount: Number(d.fee),
            status: 'completed',
            paymentMethod: d.networkLabel || d.network || 'Mobile Money',
            senderUid: payerUid,
            senderName: d.payerName,
            recipientName: 'PapoPay Platform Fee',
            title: `Withdrawal Fee (${params.refCode})`,
            subtitle: `${d.networkLabel || d.network} payout fee`,
            currency: 'TZS',
            createdAt: nowIso,
            createdAtMs: nowMs + 1,
          })
        );
      }

      tx.set(
        dbAdmin.collection('payments').doc(`${params.refCode}-PND`),
        {
          status: 'completed',
          subtitle: `${params.refCode} • Imelipwa (${cleanExtRef})`,
          gatewayRef: cleanExtRef,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      tx.set(
        dbAdmin.collection('notifications').doc(`${params.refCode}-DONEUSR`),
        cleanUndefined({
          uid: payerUid,
          type: 'withdrawal_completed',
          title: `Withdrawal Completed: TZS ${Number(d.amount || 0).toLocaleString()}`,
          message: `Your withdrawal of TZS ${Number(d.amount || 0).toLocaleString()} to ${d.networkLabel || d.network} (${d.recipientPhone}) is complete. External Ref: ${cleanExtRef}.`,
          refCode: params.refCode,
          read: false,
          createdAt: nowIso,
        })
      );

      tx.set(
        dbAdmin.collection('admin_audit_logs').doc(`AUD-${params.refCode}-${nowMs}`),
        cleanUndefined({
          action: 'PAYOUT_APPROVED_AND_COMPLETED',
          refCode: params.refCode,
          externalReference: cleanExtRef,
          actorUid: params.actorUid,
          actorEmail: params.actorEmail || null,
          targetUid: payerUid,
          amount: Number(d.amount || 0),
          fee: Number(d.fee || 0),
          note: params.note || undefined,
          createdAt: nowIso,
          createdAtMs: nowMs,
        })
      );

      return { ok: true, alreadyResolved: false, newReservedBalance: nextReserved };
    });
  } catch (err: any) {
    const code = String(err?.message || '');
    if (code === 'DISBURSEMENT_NOT_FOUND') return { ok: false, error: 'Ombi la malipo halikupatikana.' };
    if (code === 'ALREADY_FAILED_REVERSED') return { ok: false, error: 'Malipo haya tayari yalishafutwa na fedha zikarudishwa.' };
    return { ok: false, error: 'Imeshindikana kukamilisha malipo.' };
  }
}

export async function adminProcessPayoutAction(
  dbAdmin: any,
  params: {
    refCode: string;
    action: 'mark_processing' | 'approve_complete' | 'reject_or_fail';
    externalReference?: string;
    reason?: string;
    actorUid: string;
    actorEmail?: string;
  }
) {
  if (!dbAdmin || !params.refCode) {
    return { ok: false, error: 'Reference code is required.' };
  }

  if (params.action === 'approve_complete') {
    return await finalizeCompletedPayout(dbAdmin, {
      refCode: params.refCode,
      externalReference: String(params.externalReference || ''),
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
      note: params.reason,
    });
  }

  if (params.action === 'reject_or_fail') {
    return await releaseReservedPayoutFunds(dbAdmin, {
      refCode: params.refCode,
      reason: String(params.reason || 'Rejected by treasury admin'),
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
      externalReference: params.externalReference,
    });
  }

  if (params.action === 'mark_processing') {
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    const disbRef = dbAdmin.collection('disbursements').doc(params.refCode);
    const snap = await disbRef.get().catch(() => null);
    if (!snap?.exists) return { ok: false, error: 'Ombi la malipo halikupatikana.' };
    const d = snap.data() || {};
    if (d.status === 'completed' || d.status === 'failed' || d.refundedOnFailure) {
      return { ok: false, error: 'Muamala huu tayari umeshafungwa.' };
    }
    await Promise.allSettled([
      disbRef.set(
        {
          status: 'processing',
          processingByUid: params.actorUid,
          processingByEmail: params.actorEmail || null,
          updatedAt: nowIso,
        },
        { merge: true }
      ),
      dbAdmin.collection('admin_audit_logs').doc(`AUD-${params.refCode}-PROC-${nowMs}`).set({
        action: 'PAYOUT_MARKED_PROCESSING',
        refCode: params.refCode,
        actorUid: params.actorUid,
        actorEmail: params.actorEmail || null,
        createdAt: nowIso,
        createdAtMs: nowMs,
      }),
    ]);
    return { ok: true, status: 'processing' };
  }

  return { ok: false, error: 'Unsupported action.' };
}

export async function updatePapoPayTreasuryConfig(
  dbAdmin: any,
  params: {
    actorUid: string;
    actorEmail?: string;
    transferFeePercent?: number;
    transferFeeFlat?: number;
    transferFeeMin?: number;
    withdrawalFeePercent?: number;
    withdrawalFeeMin?: number;
    withdrawalMinAmount?: number;
    withdrawalMaxAmount?: number;
    enabledNetworks?: Partial<Record<MobileMoneyNetwork, boolean>>;
    b2cProvider?: PapoPayTreasurySettings['b2cProvider'];
    daliPayDisbursementApiDisabled?: boolean;
  }
): Promise<{ ok: boolean; settings?: PapoPayTreasurySettings; error?: string }> {
  if (!dbAdmin) return { ok: false, error: 'Database unavailable.' };
  const current = await getPapoPayTreasurySettings(dbAdmin);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  const nextSettings: PapoPayTreasurySettings = {
    ...current,
    ...(typeof params.transferFeePercent === 'number'
      ? { transferFeePercent: Math.max(0, Math.min(20, Number(params.transferFeePercent))) }
      : {}),
    ...(typeof params.transferFeeFlat === 'number'
      ? { transferFeeFlat: Math.max(0, Number(params.transferFeeFlat)) }
      : {}),
    ...(typeof params.transferFeeMin === 'number'
      ? { transferFeeMin: Math.max(0, Number(params.transferFeeMin)) }
      : {}),
    ...(typeof params.withdrawalFeePercent === 'number'
      ? { withdrawalFeePercent: Math.max(0, Math.min(20, Number(params.withdrawalFeePercent))) }
      : {}),
    ...(typeof params.withdrawalFeeMin === 'number'
      ? { withdrawalFeeMin: Math.max(0, Number(params.withdrawalFeeMin)) }
      : {}),
    ...(typeof params.withdrawalMinAmount === 'number'
      ? { withdrawalMinAmount: Math.max(100, Number(params.withdrawalMinAmount)) }
      : {}),
    ...(typeof params.withdrawalMaxAmount === 'number'
      ? { withdrawalMaxAmount: Math.max(1000, Number(params.withdrawalMaxAmount)) }
      : {}),
    enabledNetworks: {
      ...current.enabledNetworks,
      ...(params.enabledNetworks || {}),
    },
    b2cProvider: params.b2cProvider || current.b2cProvider,
    daliPayDisbursementApiDisabled:
      typeof params.daliPayDisbursementApiDisabled === 'boolean'
        ? params.daliPayDisbursementApiDisabled
        : current.daliPayDisbursementApiDisabled,
    updatedAt: nowIso,
    updatedBy: params.actorEmail || params.actorUid,
  };

  await Promise.allSettled([
    dbAdmin.collection('config').doc('papopay_settings').set(cleanUndefined(nextSettings), { merge: true }),
    dbAdmin.collection('admin_audit_logs').doc(`AUD-CFG-${nowMs}`).set(
      cleanUndefined({
        action: 'TREASURY_CONFIG_UPDATED',
        actorUid: params.actorUid,
        actorEmail: params.actorEmail || null,
        changes: nextSettings,
        createdAt: nowIso,
        createdAtMs: nowMs,
      })
    ),
  ]);

  return { ok: true, settings: nextSettings };
}

/**
 * Fetches unified transaction history mapped cleanly to the 8 fintech ledger types.
 */
export async function getUserWalletTransactions(
  dbAdmin: any,
  params: { uid?: string; phone?: string; limit?: number }
): Promise<Array<any>> {
  if (!dbAdmin) return [];
  const userRec = await findOrEnsureWalletUser(dbAdmin, {
    uid: params.uid,
    phone: params.phone,
    createIfMissing: false,
  });
  if (!userRec) return [];

  const maxRows = Math.min(100, Math.max(5, Number(params.limit || 50)));
  const rows: any[] = [];
  const seenKeys = new Set<string>();

  try {
    const wtSnap = await dbAdmin
      .collection('wallet_transactions')
      .where('ownerUid', '==', userRec.uid)
      .limit(maxRows)
      .get();
    for (const d of wtSnap.docs || []) {
      const w = d.data() || {};
      const key = String(w.id || d.id);
      seenKeys.add(key);
      rows.push({
        id: d.id,
        transactionId: String(w.transactionId || w.refCode || d.id),
        type: (w.type || 'MONEY_SENT') as WalletTransactionType,
        typeLabel: w.typeLabel || WALLET_TX_TYPE_LABELS[(w.type as WalletTransactionType) || 'MONEY_SENT'] || 'Transaction',
        direction: w.direction || 'debit',
        sender: w.senderName || w.senderUsername || w.senderPhone || '-',
        recipient: w.recipientName || w.recipientUsername || w.recipientPhone || '-',
        amount: Number(w.amount || 0),
        fee: Number(w.fee || 0),
        totalAmount: Number(w.totalAmount || w.amount || 0),
        status: String(w.status || 'completed'),
        paymentMethod: String(w.paymentMethod || 'PapoPay Wallet'),
        network: w.network || null,
        externalReference: w.externalReference || null,
        title: w.title || w.typeLabel,
        subtitle: w.subtitle || '',
        createdAt: w.createdAt || new Date().toISOString(),
        createdAtMs: Number(w.createdAtMs || Date.parse(String(w.createdAt || '')) || 0),
      });
    }
  } catch {}

  try {
    const pSnap = await dbAdmin
      .collection('payments')
      .where('uid', '==', userRec.uid)
      .limit(maxRows)
      .get();
    for (const d of pSnap.docs || []) {
      if (seenKeys.has(d.id)) continue;
      const p = d.data() || {};
      const txRef = String(p.refCode || d.id);
      if (rows.some((r) => r.transactionId === txRef)) continue;

      let mappedType: WalletTransactionType = 'MONEY_SENT';
      if (p.txType && WALLET_TX_TYPE_LABELS[p.txType as WalletTransactionType]) {
        mappedType = p.txType as WalletTransactionType;
      } else if (p.category === 'topup') {
        mappedType = 'WALLET_DEPOSIT';
      } else if (p.category === 'refund') {
        mappedType = 'REVERSAL';
      } else if (p.category === 'withdraw') {
        mappedType =
          p.status === 'pending'
            ? 'PENDING_WITHDRAWAL'
            : p.status === 'failed'
            ? 'FAILED_WITHDRAWAL'
            : 'MOBILE_MONEY_WITHDRAWAL';
      } else if (p.type === 'credit') {
        mappedType = 'MONEY_RECEIVED';
      } else {
        mappedType = 'MONEY_SENT';
      }

      const ms = Number(p.createdAtMs || Date.parse(String(p.createdAt || '')) || 0);
      rows.push({
        id: d.id,
        transactionId: txRef,
        type: mappedType,
        typeLabel: WALLET_TX_TYPE_LABELS[mappedType],
        direction: p.type === 'credit' ? 'credit' : 'debit',
        sender: p.senderName || (p.type === 'debit' ? userRec.data?.displayName || 'You' : p.title || '-'),
        recipient: p.recipientName || (p.type === 'credit' ? userRec.data?.displayName || 'You' : p.title || '-'),
        amount: Number(p.amount || 0),
        fee: Number(p.fee || 0),
        totalAmount: Number(p.amount || 0),
        status: String(p.status || 'completed'),
        paymentMethod: String(p.paymentMethod || 'PapoPay Wallet'),
        network: p.network || null,
        externalReference: p.gatewayRef || null,
        title: String(p.title || WALLET_TX_TYPE_LABELS[mappedType]),
        subtitle: String(p.subtitle || ''),
        createdAt: p.createdAt || (ms ? new Date(ms).toISOString() : new Date().toISOString()),
        createdAtMs: ms,
      });
    }
  } catch {}

  return rows.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0)).slice(0, maxRows);
}
