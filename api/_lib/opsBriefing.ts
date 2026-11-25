import crypto from 'node:crypto';
import { verifyAdminRequest } from './adminAuth.js';

export interface LipaPendingItem {
  id: string;
  amount: number;
  customerPhone: string;
  lipaNambaRef: string;
  paymentPurpose?: string;
  createdAt?: string;
}

export interface AdminOpsBriefing {
  generatedAt: string;
  lipaNamba: string;
  lipaNambaPendingCount: number;
  lipaNambaPendingTotalTzs: number;
  lipaNambaPendingItems: LipaPendingItem[];
  dalipay: {
    completedCount: number;
    pendingCount: number;
    failedCount: number;
    collectedTzs: number;
    disbursedTzs: number;
  };
  partnersPending: {
    vendors: number;
    drivers: number;
    fundis: number;
    total: number;
  };
  liveOps: {
    activeRides: number;
    openOrders: number;
    unresolvedSos: number;
  };
  automation: {
    hasAutomationKey: boolean;
    hasOpsWebhookUrl: boolean;
    hasAdminPhone: boolean;
  };
  whatsappSummaryText: string;
}

function cleanEnv(val?: string): string {
  return String(val || '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .trim();
}

export function getOpsConfigStatus() {
  const automationKey = cleanEnv(process.env.OPS_AUTOMATION_KEY);
  const webhookUrl = cleanEnv(process.env.OPS_WEBHOOK_URL);
  const adminPhone = cleanEnv(process.env.ADMIN_WHATSAPP_PHONE);
  return {
    hasAutomationKey: automationKey.length >= 12,
    hasOpsWebhookUrl: /^https?:\/\//i.test(webhookUrl),
    hasAdminPhone: adminPhone.replace(/\D/g, '').length >= 9,
  };
}

function safeTimingEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/**
 * Allows either authenticated Admin (Firebase ID Token) or external Ops Agent (Nod / n8n)
 * presenting a valid OPS_AUTOMATION_KEY via `X-Ops-Key` or `Authorization: Bearer ...`.
 */
export async function verifyOpsOrAdminRequest(
  req: any,
  dbAdmin?: any
): Promise<{ authorized: boolean; actor: 'admin' | 'ops_key'; uid?: string; error?: string }> {
  const configuredKey = cleanEnv(process.env.OPS_AUTOMATION_KEY);
  const rawOpsHeader = Array.isArray(req?.headers?.['x-ops-key'])
    ? String(req.headers['x-ops-key'][0] || '')
    : String(req?.headers?.['x-ops-key'] || '');
  const authHeader = Array.isArray(req?.headers?.authorization)
    ? String(req.headers.authorization[0] || '')
    : String(req?.headers?.authorization || '');
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (configuredKey.length >= 12) {
    const candidate = rawOpsHeader.trim() || bearerToken;
    if (candidate && safeTimingEqual(candidate, configuredKey)) {
      return { authorized: true, actor: 'ops_key' };
    }
  }

  const adminCheck = await verifyAdminRequest(req?.headers?.authorization, dbAdmin);
  if (adminCheck.ok) {
    return { authorized: true, actor: 'admin', uid: adminCheck.admin.uid };
  }
  return {
    authorized: false,
    actor: 'admin',
    error: ('error' in adminCheck ? adminCheck.error : '') || 'Ruhusa ya Admin au X-Ops-Key inahitajika.',
  };
}

export async function dispatchOpsWebhookEvent(
  eventName: string,
  payload: Record<string, any>
): Promise<boolean> {
  const webhookUrl = cleanEnv(process.env.OPS_WEBHOOK_URL);
  if (!/^https?:\/\//i.test(webhookUrl)) return false;

  const opsKey = cleanEnv(process.env.OPS_AUTOMATION_KEY);
  const body = JSON.stringify({
    event: eventName,
    timestamp: new Date().toISOString(),
    source: 'papo-hapo-super-app',
    data: payload,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Papo-Event': eventName,
  };
  if (opsKey) {
    headers['X-Signature'] = crypto
      .createHmac('sha256', opsKey)
      .update(body, 'utf8')
      .digest('hex');
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      return res.ok;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

export async function buildAdminOpsBriefing(dbAdmin: any): Promise<AdminOpsBriefing> {
  const nowIso = new Date().toISOString();
  const lipaPendingItems: LipaPendingItem[] = [];
  let lipaTotalTzs = 0;

  let completedCount = 0;
  let pendingCount = 0;
  let failedCount = 0;
  let collectedTzs = 0;
  let disbursedTzs = 0;

  let pendingVendors = 0;
  let pendingDrivers = 0;
  let pendingFundis = 0;

  let activeRides = 0;
  let openOrders = 0;
  let unresolvedSos = 0;

  if (dbAdmin) {
    const [
      ordersSnap,
      callbacksSnap,
      vendorsSnap,
      usersSnap,
      ridesSnap,
      sosSnap,
    ] = await Promise.all([
      dbAdmin.collection('orders').limit(250).get().catch(() => null),
      dbAdmin.collection('payment_callbacks').limit(200).get().catch(() => null),
      dbAdmin.collection('vendors').limit(200).get().catch(() => null),
      dbAdmin.collection('users').limit(300).get().catch(() => null),
      dbAdmin.collection('rides').limit(200).get().catch(() => null),
      dbAdmin.collection('sos_alerts').limit(100).get().catch(() => null),
    ]);

    for (const docSnap of ordersSnap?.docs || []) {
      const o = docSnap.data() || {};
      const status = String(o.status || '').toLowerCase();
      const payStatus = String(o.paymentStatus || '').toLowerCase();
      const payMethod = String(o.paymentMethod || '').toLowerCase();

      if (!['completed', 'cancelled', 'rejected'].includes(status)) {
        openOrders += 1;
      }

      const isLipaPending =
        payStatus !== 'paid' &&
        (payMethod === 'lipanamba' ||
          payMethod === 'lipa_namba' ||
          o.paymentPushStatus === 'awaiting_manual_confirmation' ||
          Boolean(o.lipaNambaRef));

      if (isLipaPending) {
        const amt = Math.max(0, Number(o.totalAmount || o.total || o.amount || 0));
        lipaTotalTzs += amt;
        lipaPendingItems.push({
          id: docSnap.id,
          amount: amt,
          customerPhone: String(o.customerPhone || o.phone || o.metaSenderId || '-'),
          lipaNambaRef: String(o.lipaNambaRef || '-'),
          paymentPurpose: o.paymentPurpose ? String(o.paymentPurpose) : undefined,
          createdAt: String(o.updatedAt || o.createdAt || ''),
        });
      }
    }

    lipaPendingItems.sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0));

    for (const cbDoc of callbacksSnap?.docs || []) {
      const cb = cbDoc.data() || {};
      const prov = String(cb.provider || '').toLowerCase();
      if (prov && prov !== 'dalipay') continue;
      const st = String(cb.status || '').toUpperCase();
      const amt = Math.max(0, Number(cb.amount || 0));
      const kind = String(cb.kind || 'collection').toLowerCase();
      if (['COMPLETED', 'SUCCESS', 'PAID', 'SETTLED', 'SUCCESSFUL'].includes(st)) {
        completedCount += 1;
        if (kind === 'disbursement') disbursedTzs += amt;
        else collectedTzs += amt;
      } else if (['FAILED', 'ERROR', 'CANCELLED', 'EXPIRED', 'REJECTED'].includes(st)) {
        failedCount += 1;
      } else {
        pendingCount += 1;
      }
    }

    for (const vDoc of vendorsSnap?.docs || []) {
      const v = vDoc.data() || {};
      const st = String(v.status || '').toLowerCase();
      if (st === 'pending' || st === 'awaiting_approval') pendingVendors += 1;
    }

    for (const uDoc of usersSnap?.docs || []) {
      const u = uDoc.data() || {};
      const role = String(u.role || '').toLowerCase();
      const approval = String(u.approvalStatus || '').toLowerCase();
      if (approval === 'pending' || u.status === 'pending') {
        if (role === 'rider' || role === 'driver') pendingDrivers += 1;
        else if (role === 'fundi' || role === 'handyman') pendingFundis += 1;
      }
    }

    for (const rDoc of ridesSnap?.docs || []) {
      const r = rDoc.data() || {};
      const st = String(r.status || '').toLowerCase();
      if (!['completed', 'cancelled', 'rejected'].includes(st)) activeRides += 1;
    }

    for (const sDoc of sosSnap?.docs || []) {
      const s = sDoc.data() || {};
      if (String(s.status || '').toLowerCase() !== 'resolved') unresolvedSos += 1;
    }
  }

  const totalPartnersPending = pendingVendors + pendingDrivers + pendingFundis;
  const topPendingLines = lipaPendingItems.slice(0, 5).map(
    (item, idx) =>
      `${idx + 1}. #${item.id} • TZS ${item.amount.toLocaleString()} • ${item.customerPhone}${
        item.lipaNambaRef && item.lipaNambaRef !== '-' ? ` (Ref: ${item.lipaNambaRef})` : ''
      }`
  );

  const summaryLines = [
    `📊 *PAPO HAPO — MUHTASARI WA SHUGHULI*`,
    `🕒 ${new Date().toLocaleString('sw-TZ', { timeZone: 'Africa/Dar_es_Salaam' })}`,
    ``,
    `🏪 *Lipa Namba 5656565 (Zinasubiri Uthibitisho):*`,
    `• Idadi: *${lipaPendingItems.length}* (Jumla: *TZS ${lipaTotalTzs.toLocaleString()}/=*)`,
    ...(topPendingLines.length > 0 ? topPendingLines : ['• Hakuna malipo yanayosubiri kwa sasa ✅']),
    ``,
    `💳 *DaliPay Gateway:*`,
    `• Zilizokamilika: *${completedCount}* (Makusanyo: TZS ${collectedTzs.toLocaleString()}/= | Malipo Nje: TZS ${disbursedTzs.toLocaleString()}/=)`,
    `• Zinazochakatwa: *${pendingCount}* | Zilizoshindwa: *${failedCount}*`,
    ``,
    `🚦 *Uendeshaji & Washirika:*`,
    `• Safari Hai: *${activeRides}* | Oda Wazi: *${openOrders}* | SOS Hai: *${unresolvedSos}*`,
    `• Maombi ya Uidhinishaji: *${totalPartnersPending}* (Wachuuzi ${pendingVendors}, Madereva ${pendingDrivers}, Mafundi ${pendingFundis})`,
  ];

  return {
    generatedAt: nowIso,
    lipaNamba: '5656565',
    lipaNambaPendingCount: lipaPendingItems.length,
    lipaNambaPendingTotalTzs: lipaTotalTzs,
    lipaNambaPendingItems: lipaPendingItems.slice(0, 10),
    dalipay: {
      completedCount,
      pendingCount,
      failedCount,
      collectedTzs,
      disbursedTzs,
    },
    partnersPending: {
      vendors: pendingVendors,
      drivers: pendingDrivers,
      fundis: pendingFundis,
      total: totalPartnersPending,
    },
    liveOps: {
      activeRides,
      openOrders,
      unresolvedSos,
    },
    automation: getOpsConfigStatus(),
    whatsappSummaryText: summaryLines.join('\n'),
  };
}
