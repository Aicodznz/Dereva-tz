import fs from 'fs';
import path from 'path';

export interface VerifiedAdminCaller {
  uid: string;
  email: string;
}

const DEFAULT_PRIMARY_ADMIN_EMAIL = 'aicodtznation@gmail.com';

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

export async function verifyAdminRequest(
  authHeader: string | string[] | undefined,
  dbAdmin: any
): Promise<{ ok: true; admin: VerifiedAdminCaller } | { ok: false; status: number; error: string }> {
  const rawHeader = Array.isArray(authHeader) ? authHeader[0] : String(authHeader || '');
  const match = rawHeader.match(/^Bearer\s+(.+)$/i);
  const idToken = match?.[1]?.trim() || '';

  if (!idToken) {
    return {
      ok: false,
      status: 401,
      error: 'Uthibitisho wa Admin unahitajika. Tafadhali ingia tena kama Admin.',
    };
  }

  const apiKey = readFirebaseApiKey();
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      error: 'Usanidi wa uthibitisho wa seva haujakamilika.',
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
        error: 'Kikao cha Admin kimeisha muda wake. Tafadhali ingia tena.',
      };
    }

    const data = (await resp.json().catch(() => ({}))) as any;
    const fbUser = Array.isArray(data?.users) ? data.users[0] : null;
    const uid = String(fbUser?.localId || '').trim();
    const email = String(fbUser?.email || '').trim().toLowerCase();

    if (!uid) {
      return {
        ok: false,
        status: 401,
        error: 'Mtumiaji wa Admin hakutambuliwa.',
      };
    }

    let isAdmin = email === DEFAULT_PRIMARY_ADMIN_EMAIL;
    if (!isAdmin && dbAdmin) {
      const [adminSnap, userSnap] = await Promise.all([
        dbAdmin.collection('admins').doc(uid).get().catch(() => null),
        dbAdmin.collection('users').doc(uid).get().catch(() => null),
      ]);
      if (adminSnap?.exists) {
        isAdmin = true;
      } else if (userSnap?.exists && String(userSnap.data()?.role || '').toLowerCase() === 'admin') {
        isAdmin = true;
      }
    }

    if (!isAdmin) {
      return {
        ok: false,
        status: 403,
        error: 'Huna ruhusa ya Admin kuthibitisha malipo haya.',
      };
    }

    return { ok: true, admin: { uid, email } };
  } catch {
    return {
      ok: false,
      status: 500,
      error: 'Imeshindikana kuhakiki utambulisho wa Admin.',
    };
  }
}
