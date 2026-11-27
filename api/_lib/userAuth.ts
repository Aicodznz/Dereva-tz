import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
  phoneNumber?: string;
}

function readFirebaseApiKey(): string {
  try {
    const envKey = String(process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY || '').trim();
    if (envKey) return envKey;
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return String(cfg?.apiKey || '').trim();
    }
  } catch {}
  return '';
}

export async function verifyUserBearerToken(
  authHeader: string | string[] | undefined
): Promise<{ ok: true; user: VerifiedFirebaseUser } | { ok: false; status: number; error: string }> {
  const rawHeader = Array.isArray(authHeader) ? authHeader[0] : String(authHeader || '');
  const match = rawHeader.match(/^Bearer\s+(.+)$/i);
  const idToken = match?.[1]?.trim() || '';

  if (!idToken) {
    return {
      ok: false,
      status: 401,
      error: 'Authentication token is missing.',
    };
  }

  const apiKey = readFirebaseApiKey();
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      error: 'Authentication service is not configured.',
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let resp: Response;
    try {
      resp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timer);
    }

    if (!resp.ok) {
      return {
        ok: false,
        status: 401,
        error: 'Session expired. Please sign in again.',
      };
    }

    const data = (await resp.json().catch(() => ({}))) as any;
    const fbUser = Array.isArray(data?.users) ? data.users[0] : null;
    const uid = String(fbUser?.localId || '').trim();
    if (!uid) {
      return {
        ok: false,
        status: 401,
        error: 'Unable to identify authenticated account.',
      };
    }

    return {
      ok: true,
      user: {
        uid,
        email: fbUser?.email ? String(fbUser.email).toLowerCase() : undefined,
        phoneNumber: fbUser?.phoneNumber ? String(fbUser.phoneNumber) : undefined,
      },
    };
  } catch {
    return {
      ok: false,
      status: 500,
      error: 'Failed to verify authentication token.',
    };
  }
}

export function validatePinFormat(rawPin: string): { valid: boolean; clean: string; reason?: string } {
  const clean = String(rawPin || '').trim();
  if (!/^\d{4,6}$/.test(clean)) {
    return { valid: false, clean: '', reason: 'Transaction PIN must be 4 to 6 digits.' };
  }
  return { valid: true, clean };
}

export function hashTransactionPin(pin: string): { hash: string; salt: string } {
  const check = validatePinFormat(pin);
  if (!check.valid) {
    throw new Error(check.reason || 'Invalid PIN format');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(check.clean, salt, 64).toString('hex');
  return { hash: derived, salt };
}

export function verifyTransactionPinRecord(
  userData: any,
  suppliedPin: string
): {
  ok: boolean;
  code: 'OK' | 'PIN_NOT_SET' | 'LOCKED' | 'INVALID_PIN' | 'INVALID_FORMAT';
  reason?: string;
  needsHashUpgrade?: boolean;
  lockedUntilMs?: number;
} {
  const nowMs = Date.now();
  const lockedUntilMs = Number(userData?.pinLockedUntilMs || 0);
  if (lockedUntilMs > nowMs) {
    const minsLeft = Math.max(1, Math.ceil((lockedUntilMs - nowMs) / 60000));
    return {
      ok: false,
      code: 'LOCKED',
      lockedUntilMs,
      reason: `PIN imefungwa kwa muda kutokana na majaribio mengi yasiyo sahihi. Jaribu tena baada ya dakika ${minsLeft}.`,
    };
  }

  const storedHash = String(userData?.walletPinHash || '').trim();
  const storedSalt = String(userData?.walletPinSalt || '').trim();
  const legacyPlainPin = String(userData?.walletPin || userData?.pin || '').trim();

  if (!storedHash && !legacyPlainPin) {
    return {
      ok: false,
      code: 'PIN_NOT_SET',
      reason: 'Hujasajili PIN ya miamala bado. Tafadhali weka PIN ya tarakimu 4 kwenye wasifu wa PapoPay.',
    };
  }

  const format = validatePinFormat(suppliedPin);
  if (!format.valid) {
    return {
      ok: false,
      code: 'INVALID_FORMAT',
      reason: 'Weka PIN sahihi ya tarakimu 4 hadi 6.',
    };
  }

  if (storedHash && storedSalt) {
    const candidateHex = crypto.scryptSync(format.clean, storedSalt, 64).toString('hex');
    const a = Buffer.from(candidateHex, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return { ok: true, code: 'OK' };
    }
    return {
      ok: false,
      code: 'INVALID_PIN',
      reason: 'PIN ya muamala si sahihi. Tafadhali jaribu tena.',
    };
  }

  // Backward compatibility for legacy plaintext PIN records — triggers upgrade on success
  if (legacyPlainPin && legacyPlainPin === format.clean) {
    return { ok: true, code: 'OK', needsHashUpgrade: true };
  }

  return {
    ok: false,
    code: 'INVALID_PIN',
    reason: 'PIN ya muamala si sahihi. Tafadhali jaribu tena.',
  };
}

export function normalizeUsername(raw: string): {
  valid: boolean;
  lower: string;
  handle: string;
  reason?: string;
} {
  const stripped = String(raw || '').trim().replace(/^@+/, '');
  if (!stripped) {
    return { valid: false, lower: '', handle: '', reason: 'Username haiwezi kuwa tupu.' };
  }
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(stripped)) {
    return {
      valid: false,
      lower: '',
      handle: '',
      reason: 'Username lazima iwe na herufi, namba au "_" kati ya 3 na 24.',
    };
  }
  const lower = stripped.toLowerCase();
  const reserved = new Set(['admin', 'papopay', 'papohapo', 'support', 'system', 'root', 'wallet', 'dalipay']);
  if (reserved.has(lower)) {
    return {
      valid: false,
      lower: '',
      handle: '',
      reason: 'Username hii imehifadhiwa na mfumo. Chagua jina jingine.',
    };
  }
  return {
    valid: true,
    lower,
    handle: `@${lower}`,
  };
}

export function maskWalletId(walletId?: string | null): string {
  const clean = String(walletId || '').trim().toUpperCase();
  if (!clean) return 'PP***';
  if (clean.length <= 5) return `${clean.slice(0, 2)}***`;
  return `${clean.slice(0, 2)}***${clean.slice(-4)}`;
}
