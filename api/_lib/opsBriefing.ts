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

export type OpsIntervalPreset = '1h' | '6h' | '12h' | 'daily' | 'weekly' | 'monthly';

export interface OpsRealtimeTriggers {
  newCustomer: boolean;
  newProduct: boolean;
  newDriverOrVendor: boolean;
  newOrderOrService: boolean;
  lipaNambaPending: boolean;
}

export interface OpsAutomationSettings {
  enabled: boolean;
  adminPhone: string;
  intervalPreset: OpsIntervalPreset;
  lastSentAtMs: number;
  nextDueAtMs: number;
  updatedAt?: string;
  realtimeTriggers: OpsRealtimeTriggers;
}

export const DEFAULT_OPS_AUTOMATION_SETTINGS: OpsAutomationSettings = {
  enabled: false,
  adminPhone: '',
  intervalPreset: 'daily',
  lastSentAtMs: 0,
  nextDueAtMs: 0,
  realtimeTriggers: {
    newCustomer: false,
    newProduct: false,
    newDriverOrVendor: true,
    newOrderOrService: false,
    lipaNambaPending: true,
  },
};

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
  catalogStats?: {
    customers: number;
    products: number;
    vendors: number;
    drivers: number;
    fundis: number;
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

export function normalizeAdminPhoneForWhatsApp(rawPhone?: string): string {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('255') && digits.length >= 12) return digits.slice(0, 12);
  if (digits.startsWith('0') && digits.length >= 10) return `255${digits.slice(1, 10)}`;
  if (digits.length === 9) return `255${digits}`;
  return digits;
}

export async function resolveWhatsAppPhoneNumberId(
  dbAdmin: any,
  recipientPhone?: string
): Promise<string | undefined> {
  const envId = cleanEnv(
    process.env.META_WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID
  );
  if (envId) return envId;
  if (!dbAdmin) return undefined;

  try {
    if (recipientPhone) {
      const sessSnap = await dbAdmin
        .collection('meta_sessions')
        .doc(`whatsapp:${recipientPhone}`)
        .get()
        .catch(() => null);
      const pid = String(sessSnap?.data()?.details?.metaPhoneNumberId || '').trim();
      if (pid) return pid;
    }

    const welcomeSnap = await dbAdmin
      .collection('app_settings')
      .doc('meta_welcome')
      .get()
      .catch(() => null);
    const welcomePid = String(welcomeSnap?.data()?.phoneNumberId || '').trim();
    if (welcomePid) return welcomePid;

    const anyWaSess = await dbAdmin
      .collection('meta_sessions')
      .where('channel', '==', 'whatsapp')
      .limit(5)
      .get()
      .catch(() => null);
    for (const d of anyWaSess?.docs || []) {
      const pid = String(d.data()?.details?.metaPhoneNumberId || '').trim();
      if (pid) return pid;
    }
  } catch {}
  return undefined;
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

  let totalCustomers = 0;
  let totalProducts = 0;
  let totalVendors = 0;
  let totalDrivers = 0;
  let totalFundis = 0;

  if (dbAdmin) {
    const [
      ordersSnap,
      callbacksSnap,
      vendorsSnap,
      usersSnap,
      ridesSnap,
      sosSnap,
      productsSnap,
    ] = await Promise.all([
      dbAdmin.collection('orders').limit(250).get().catch(() => null),
      dbAdmin.collection('payment_callbacks').limit(200).get().catch(() => null),
      dbAdmin.collection('vendors').limit(200).get().catch(() => null),
      dbAdmin.collection('users').limit(400).get().catch(() => null),
      dbAdmin.collection('rides').limit(200).get().catch(() => null),
      dbAdmin.collection('sos_alerts').limit(100).get().catch(() => null),
      dbAdmin.collection('products').limit(400).get().catch(() => null),
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

    totalVendors = vendorsSnap?.docs?.length || 0;
    totalProducts = productsSnap?.docs?.length || 0;

    for (const vDoc of vendorsSnap?.docs || []) {
      const v = vDoc.data() || {};
      const st = String(v.status || '').toLowerCase();
      if (st === 'pending' || st === 'awaiting_approval') pendingVendors += 1;
    }

    for (const uDoc of usersSnap?.docs || []) {
      const u = uDoc.data() || {};
      const role = String(u.role || 'customer').toLowerCase();
      if (role === 'rider' || role === 'driver') totalDrivers += 1;
      else if (role === 'fundi' || role === 'handyman') totalFundis += 1;
      else if (role !== 'vendor' && role !== 'admin') totalCustomers += 1;

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
    `🚦 *Uendeshaji & Mtandao:*`,
    `• Safari Hai: *${activeRides}* | Oda Wazi: *${openOrders}* | SOS Hai: *${unresolvedSos}*`,
    `• Wateja: *${totalCustomers}* | Bidhaa: *${totalProducts}* | Wachuuzi: *${totalVendors}* | Madereva: *${totalDrivers}* | Mafundi: *${totalFundis}*`,
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
    catalogStats: {
      customers: totalCustomers,
      products: totalProducts,
      vendors: totalVendors,
      drivers: totalDrivers,
      fundis: totalFundis,
    },
    automation: getOpsConfigStatus(),
    whatsappSummaryText: summaryLines.join('\n'),
  };
}

const VALID_PRESETS: OpsIntervalPreset[] = ['1h', '6h', '12h', 'daily', 'weekly', 'monthly'];
const OPS_SETTINGS_DOC_COL = 'app_settings';
const OPS_SETTINGS_DOC_ID = 'ops_automation';

let cachedOpsSettings: { data: OpsAutomationSettings; expiresAt: number } | null = null;
let opsScheduleTickInFlight = false;

export function computeNextOpsRunMs(preset: OpsIntervalPreset, fromMs = Date.now()): number {
  const base = Number.isFinite(fromMs) && fromMs > 0 ? fromMs : Date.now();
  switch (preset) {
    case '1h':
      return base + 60 * 60 * 1000;
    case '6h':
      return base + 6 * 60 * 60 * 1000;
    case '12h':
      return base + 12 * 60 * 60 * 1000;
    case 'weekly':
      return base + 7 * 24 * 60 * 60 * 1000;
    case 'monthly': {
      const d = new Date(base);
      const targetMonth = d.getUTCMonth() + 1;
      const copy = new Date(d.getTime());
      copy.setUTCMonth(targetMonth);
      return copy.getTime();
    }
    case 'daily':
    default:
      return base + 24 * 60 * 60 * 1000;
  }
}

export async function getOpsAutomationSettings(
  dbAdmin: any,
  bypassCache = false
): Promise<OpsAutomationSettings> {
  const now = Date.now();
  if (!bypassCache && cachedOpsSettings && cachedOpsSettings.expiresAt > now) {
    return cachedOpsSettings.data;
  }

  const fallbackPhone = normalizeAdminPhoneForWhatsApp(process.env.ADMIN_WHATSAPP_PHONE);
  let merged: OpsAutomationSettings = {
    ...DEFAULT_OPS_AUTOMATION_SETTINGS,
    adminPhone: fallbackPhone,
    realtimeTriggers: { ...DEFAULT_OPS_AUTOMATION_SETTINGS.realtimeTriggers },
  };

  if (dbAdmin) {
    try {
      const snap = await dbAdmin
        .collection(OPS_SETTINGS_DOC_COL)
        .doc(OPS_SETTINGS_DOC_ID)
        .get();
      if (snap?.exists) {
        const raw = snap.data() || {};
        const preset: OpsIntervalPreset = VALID_PRESETS.includes(raw.intervalPreset)
          ? raw.intervalPreset
          : 'daily';
        const rt = raw.realtimeTriggers || {};
        merged = {
          enabled: Boolean(raw.enabled),
          adminPhone: normalizeAdminPhoneForWhatsApp(raw.adminPhone || fallbackPhone),
          intervalPreset: preset,
          lastSentAtMs: Number(raw.lastSentAtMs || 0),
          nextDueAtMs: Number(raw.nextDueAtMs || 0),
          updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
          realtimeTriggers: {
            newCustomer: Boolean(rt.newCustomer),
            newProduct: Boolean(rt.newProduct),
            newDriverOrVendor:
              typeof rt.newDriverOrVendor === 'boolean' ? rt.newDriverOrVendor : true,
            newOrderOrService: Boolean(rt.newOrderOrService),
            lipaNambaPending:
              typeof rt.lipaNambaPending === 'boolean' ? rt.lipaNambaPending : true,
          },
        };
      }
    } catch {}
  }

  cachedOpsSettings = { data: merged, expiresAt: now + 30_000 };
  return merged;
}

export async function saveOpsAutomationSettings(
  dbAdmin: any,
  patch: Partial<OpsAutomationSettings> & { resetScheduleFromNow?: boolean }
): Promise<OpsAutomationSettings> {
  const current = await getOpsAutomationSettings(dbAdmin, true);
  const preset: OpsIntervalPreset = VALID_PRESETS.includes(patch.intervalPreset as OpsIntervalPreset)
    ? (patch.intervalPreset as OpsIntervalPreset)
    : current.intervalPreset;
  const enabled = typeof patch.enabled === 'boolean' ? patch.enabled : current.enabled;
  const adminPhone =
    typeof patch.adminPhone === 'string'
      ? normalizeAdminPhoneForWhatsApp(patch.adminPhone)
      : current.adminPhone;
  const rtPatch: Partial<OpsRealtimeTriggers> = patch.realtimeTriggers || {};
  const realtimeTriggers: OpsRealtimeTriggers = {
    newCustomer:
      typeof rtPatch.newCustomer === 'boolean'
        ? rtPatch.newCustomer
        : current.realtimeTriggers.newCustomer,
    newProduct:
      typeof rtPatch.newProduct === 'boolean'
        ? rtPatch.newProduct
        : current.realtimeTriggers.newProduct,
    newDriverOrVendor:
      typeof rtPatch.newDriverOrVendor === 'boolean'
        ? rtPatch.newDriverOrVendor
        : current.realtimeTriggers.newDriverOrVendor,
    newOrderOrService:
      typeof rtPatch.newOrderOrService === 'boolean'
        ? rtPatch.newOrderOrService
        : current.realtimeTriggers.newOrderOrService,
    lipaNambaPending:
      typeof rtPatch.lipaNambaPending === 'boolean'
        ? rtPatch.lipaNambaPending
        : current.realtimeTriggers.lipaNambaPending,
  };

  const nowMs = Date.now();
  let nextDueAtMs = current.nextDueAtMs;
  if (enabled) {
    if (
      patch.resetScheduleFromNow ||
      !nextDueAtMs ||
      preset !== current.intervalPreset ||
      !current.enabled
    ) {
      nextDueAtMs = computeNextOpsRunMs(preset, nowMs);
    }
  } else {
    nextDueAtMs = 0;
  }

  const nextSettings: OpsAutomationSettings = {
    enabled,
    adminPhone,
    intervalPreset: preset,
    lastSentAtMs: current.lastSentAtMs || 0,
    nextDueAtMs,
    updatedAt: new Date(nowMs).toISOString(),
    realtimeTriggers,
  };

  if (dbAdmin) {
    await dbAdmin
      .collection(OPS_SETTINGS_DOC_COL)
      .doc(OPS_SETTINGS_DOC_ID)
      .set(nextSettings, { merge: true });
  }
  cachedOpsSettings = { data: nextSettings, expiresAt: nowMs + 30_000 };
  return nextSettings;
}

export async function processScheduledOpsBriefing(
  dbAdmin: any,
  sendMetaOutboundMessage: (params: {
    channel: 'whatsapp' | 'messenger' | 'instagram';
    recipientId: string;
    text: string;
    phoneNumberId?: string;
    templateFallback?: { category?: 'utility' | 'marketing' | 'safety'; bodyParams?: string[] };
  }) => Promise<{ sent: boolean; reason?: string }>
): Promise<{ ran: boolean; sent: boolean }> {
  if (!dbAdmin || opsScheduleTickInFlight) return { ran: false, sent: false };
  opsScheduleTickInFlight = true;
  try {
    const settings = await getOpsAutomationSettings(dbAdmin, true);
    if (!settings.enabled) return { ran: false, sent: false };

    const nowMs = Date.now();
    const dueAt = settings.nextDueAtMs || computeNextOpsRunMs(settings.intervalPreset, settings.lastSentAtMs || nowMs);
    if (nowMs < dueAt) return { ran: false, sent: false };

    const botPublicDigits = normalizeAdminPhoneForWhatsApp(
      process.env.META_WHATSAPP_PUBLIC_NUMBER || '255775985358'
    );
    const targetPhone = settings.adminPhone;
    const nextDueAtMs = computeNextOpsRunMs(settings.intervalPreset, nowMs);

    // Claim slot first to prevent duplicate sends across restarts/concurrent ticks
    await dbAdmin
      .collection(OPS_SETTINGS_DOC_COL)
      .doc(OPS_SETTINGS_DOC_ID)
      .set(
        {
          lastSentAtMs: nowMs,
          nextDueAtMs,
          updatedAt: new Date(nowMs).toISOString(),
        },
        { merge: true }
      );
    cachedOpsSettings = {
      data: { ...settings, lastSentAtMs: nowMs, nextDueAtMs },
      expiresAt: nowMs + 30_000,
    };

    const briefing = await buildAdminOpsBriefing(dbAdmin);
    let sent = false;
    if (targetPhone.length >= 11 && targetPhone !== botPublicDigits) {
      const phoneNumberId = await resolveWhatsAppPhoneNumberId(dbAdmin, targetPhone);
      const res = await sendMetaOutboundMessage({
        channel: 'whatsapp',
        recipientId: targetPhone,
        phoneNumberId,
        text: briefing.whatsappSummaryText,
        templateFallback: {
          category: 'utility',
          bodyParams: [
            `Lipa Namba: ${briefing.lipaNambaPendingCount} pending (TZS ${briefing.lipaNambaPendingTotalTzs.toLocaleString()}) • DaliPay OK: ${briefing.dalipay.completedCount}`,
          ],
        },
      });
      sent = Boolean(res?.sent);
    }

    await dispatchOpsWebhookEvent('ops.scheduled_briefing', {
      preset: settings.intervalPreset,
      briefing,
    });

    return { ran: true, sent };
  } catch (err) {
    console.warn('[Ops Scheduler] Tick warning:', err);
    return { ran: false, sent: false };
  } finally {
    opsScheduleTickInFlight = false;
  }
}

export async function notifyAdminRealtimeOpsEvent(
  dbAdmin: any,
  sendMetaOutboundMessage: (params: {
    channel: 'whatsapp' | 'messenger' | 'instagram';
    recipientId: string;
    text: string;
    phoneNumberId?: string;
    templateFallback?: { category?: 'utility' | 'marketing' | 'safety'; bodyParams?: string[] };
  }) => Promise<{ sent: boolean; reason?: string }>,
  triggerKey: keyof OpsRealtimeTriggers,
  messageText: string,
  eventPayload: Record<string, any>
): Promise<boolean> {
  if (!dbAdmin || !messageText) return false;
  try {
    const settings = await getOpsAutomationSettings(dbAdmin);
    if (!settings.enabled || !settings.realtimeTriggers?.[triggerKey]) return false;

    const botPublicDigits = normalizeAdminPhoneForWhatsApp(
      process.env.META_WHATSAPP_PUBLIC_NUMBER || '255775985358'
    );
    const targetPhone = settings.adminPhone;

    let sent = false;
    if (targetPhone.length >= 11 && targetPhone !== botPublicDigits) {
      const phoneNumberId = await resolveWhatsAppPhoneNumberId(dbAdmin, targetPhone);
      const res = await sendMetaOutboundMessage({
        channel: 'whatsapp',
        recipientId: targetPhone,
        phoneNumberId,
        text: messageText,
        templateFallback: {
          category: 'utility',
          bodyParams: [messageText.replace(/\*/g, '').slice(0, 220)],
        },
      });
      sent = Boolean(res?.sent);
    }

    await dispatchOpsWebhookEvent(`ops.event.${triggerKey}`, eventPayload);
    return sent;
  } catch {
    return false;
  }
}

function parseTimestampMs(raw: any): number {
  if (!raw) return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw?.toMillis === 'function') {
    try {
      return Number(raw.toMillis()) || 0;
    } catch {
      return 0;
    }
  }
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

const realtimeBootMs = Date.now();
const seenRealtimeEventKeys = new Set<string>();
let realtimePollInFlight = false;

export async function pollRealtimeOpsEvents(
  dbAdmin: any,
  sendMetaOutboundMessage: (params: {
    channel: 'whatsapp' | 'messenger' | 'instagram';
    recipientId: string;
    text: string;
    phoneNumberId?: string;
    templateFallback?: { category?: 'utility' | 'marketing' | 'safety'; bodyParams?: string[] };
  }) => Promise<{ sent: boolean; reason?: string }>
): Promise<number> {
  if (!dbAdmin || realtimePollInFlight) return 0;
  realtimePollInFlight = true;
  let dispatched = 0;

  try {
    const settings = await getOpsAutomationSettings(dbAdmin);
    if (!settings.enabled) return 0;
    const rt = settings.realtimeTriggers;
    const anyTriggerOn =
      rt.newCustomer ||
      rt.newProduct ||
      rt.newDriverOrVendor ||
      rt.newOrderOrService ||
      rt.lipaNambaPending;
    if (!anyTriggerOn) return 0;

    if (seenRealtimeEventKeys.size > 1000) {
      seenRealtimeEventKeys.clear();
    }

    const markAndCheck = (key: string, createdMs: number) => {
      if (!createdMs || createdMs <= realtimeBootMs) return false;
      if (seenRealtimeEventKeys.has(key)) return false;
      seenRealtimeEventKeys.add(key);
      return true;
    };

    const tasks: Promise<void>[] = [];

    if (rt.newCustomer || rt.newDriverOrVendor) {
      tasks.push(
        dbAdmin
          .collection('users')
          .limit(300)
          .get()
          .then(async (snap: any) => {
            for (const docSnap of snap?.docs || []) {
              const u = docSnap.data() || {};
              const ts = parseTimestampMs(u.createdAtMs || u.createdAt || u.updatedAt);
              const role = String(u.role || 'customer').toLowerCase();
              const isPartner = ['rider', 'driver', 'fundi', 'handyman', 'vendor'].includes(role);

              if (isPartner && rt.newDriverOrVendor) {
                const key = `user_partner:${docSnap.id}`;
                if (markAndCheck(key, ts)) {
                  const label =
                    role === 'fundi' || role === 'handyman'
                      ? 'Fundi Mpya'
                      : role === 'vendor'
                      ? 'Mchuuzi Mpya'
                      : 'Dereva Mpya';
                  await notifyAdminRealtimeOpsEvent(
                    dbAdmin,
                    sendMetaOutboundMessage,
                    'newDriverOrVendor',
                    `🆕 *${label} Amejisajili!*\n• Jina: *${u.displayName || u.name || 'Mtumiaji'}*\n• Simu: *${u.phone || '-'}*\n• Huduma/Aina: *${role}*`,
                    { id: docSnap.id, role, name: u.displayName || u.name, phone: u.phone }
                  );
                  dispatched += 1;
                }
              } else if (!isPartner && role !== 'admin' && rt.newCustomer) {
                const key = `user_customer:${docSnap.id}`;
                if (markAndCheck(key, ts)) {
                  await notifyAdminRealtimeOpsEvent(
                    dbAdmin,
                    sendMetaOutboundMessage,
                    'newCustomer',
                    `👤 *Mteja Mpya Amejiunga Papo Hapo!*\n• Jina: *${u.displayName || u.name || 'Mteja'}*\n• Simu: *${u.phone || '-'}*`,
                    { id: docSnap.id, name: u.displayName || u.name, phone: u.phone }
                  );
                  dispatched += 1;
                }
              }
            }
          })
          .catch(() => {})
      );
    }

    if (rt.newDriverOrVendor) {
      tasks.push(
        dbAdmin
          .collection('vendors')
          .limit(200)
          .get()
          .then(async (snap: any) => {
            for (const docSnap of snap?.docs || []) {
              const v = docSnap.data() || {};
              const ts = parseTimestampMs(v.createdAtMs || v.createdAt || v.updatedAt);
              if (markAndCheck(`vendor:${docSnap.id}`, ts)) {
                await notifyAdminRealtimeOpsEvent(
                  dbAdmin,
                  sendMetaOutboundMessage,
                  'newDriverOrVendor',
                  `🏪 *Duka / Mchuuzi Mpya Amesajiliwa!*\n• Jina: *${v.businessName || v.name || docSnap.id}*\n• Kategoria: *${v.category || '-'}*\n• Simu: *${v.phone || '-'}*`,
                  { id: docSnap.id, businessName: v.businessName || v.name, category: v.category }
                );
                dispatched += 1;
              }
            }
          })
          .catch(() => {})
      );
    }

    if (rt.newProduct) {
      tasks.push(
        dbAdmin
          .collection('products')
          .limit(300)
          .get()
          .then(async (snap: any) => {
            for (const docSnap of snap?.docs || []) {
              const p = docSnap.data() || {};
              const ts = parseTimestampMs(p.createdAtMs || p.createdAt || p.updatedAt);
              if (markAndCheck(`product:${docSnap.id}`, ts)) {
                const price = Number(p.price || 0);
                await notifyAdminRealtimeOpsEvent(
                  dbAdmin,
                  sendMetaOutboundMessage,
                  'newProduct',
                  `📦 *Bidhaa / Huduma Mpya Imeongezwa!*\n• Jina: *${p.name || p.title || docSnap.id}*\n• Bei: *TZS ${price.toLocaleString()}/=*\n• Duka: *${p.vendorName || p.vendorId || '-'}*`,
                  { id: docSnap.id, name: p.name || p.title, price, vendorId: p.vendorId }
                );
                dispatched += 1;
              }
            }
          })
          .catch(() => {})
      );
    }

    if (rt.newOrderOrService || rt.lipaNambaPending) {
      tasks.push(
        dbAdmin
          .collection('orders')
          .limit(200)
          .get()
          .then(async (snap: any) => {
            for (const docSnap of snap?.docs || []) {
              const o = docSnap.data() || {};
              const ts = parseTimestampMs(o.createdAtMs || o.createdAt || o.updatedAt);
              const amt = Number(o.totalAmount || o.total || o.amount || 0);
              const payMethod = String(o.paymentMethod || '').toLowerCase();
              const payStatus = String(o.paymentStatus || '').toLowerCase();
              const isLipaPending =
                payStatus !== 'paid' &&
                (payMethod === 'lipanamba' ||
                  payMethod === 'lipa_namba' ||
                  o.paymentPushStatus === 'awaiting_manual_confirmation' ||
                  Boolean(o.lipaNambaRef));

              if (isLipaPending && rt.lipaNambaPending) {
                const lipaKey = `lipa:${docSnap.id}:${o.lipaNambaRef || ''}`;
                if (markAndCheck(lipaKey, parseTimestampMs(o.updatedAt || o.createdAt))) {
                  await notifyAdminRealtimeOpsEvent(
                    dbAdmin,
                    sendMetaOutboundMessage,
                    'lipaNambaPending',
                    `🏪 *Lipa Namba 5656565 Inasubiri Uthibitisho!*\n• Oda: *#${docSnap.id}*\n• Kiasi: *TZS ${amt.toLocaleString()}/=*\n• Simu: *${o.customerPhone || o.phone || '-'}*${o.lipaNambaRef ? `\n• Kumbukumbu: *${o.lipaNambaRef}*` : ''}`,
                    { id: docSnap.id, amount: amt, customerPhone: o.customerPhone, lipaNambaRef: o.lipaNambaRef }
                  );
                  dispatched += 1;
                }
              }

              if (rt.newOrderOrService && markAndCheck(`order:${docSnap.id}`, ts)) {
                await notifyAdminRealtimeOpsEvent(
                  dbAdmin,
                  sendMetaOutboundMessage,
                  'newOrderOrService',
                  `🛍️ *Oda / Huduma Mpya Imepokelewa!*\n• Namba: *#${docSnap.id}*\n• Aina: *${o.type || o.vendorCategory || 'Order'}*\n• Kiasi: *TZS ${amt.toLocaleString()}/=*\n• Simu: *${o.customerPhone || o.phone || '-'}*`,
                  { id: docSnap.id, type: o.type, amount: amt, customerPhone: o.customerPhone }
                );
                dispatched += 1;
              }
            }
          })
          .catch(() => {})
      );

      if (rt.newOrderOrService) {
        tasks.push(
          dbAdmin
            .collection('rides')
            .limit(150)
            .get()
            .then(async (snap: any) => {
              for (const docSnap of snap?.docs || []) {
                const r = docSnap.data() || {};
                const ts = parseTimestampMs(r.createdAtMs || r.createdAt || r.updatedAt);
                if (markAndCheck(`ride:${docSnap.id}`, ts)) {
                  const fare = Number(r.estimatedFare || r.fare || r.price || 0);
                  await notifyAdminRealtimeOpsEvent(
                    dbAdmin,
                    sendMetaOutboundMessage,
                    'newOrderOrService',
                    `🚖 *Ombi Jipya la Usafiri!*\n• Safari: *#${docSnap.id}*\n• Kutoka: *${r.pickupAddress || r.pickup || '-'}*\n• Kwenda: *${r.dropoffAddress || r.dropoff || '-'}*\n• Nauli: *TZS ${fare.toLocaleString()}/=*`,
                    { id: docSnap.id, fare, pickup: r.pickupAddress, dropoff: r.dropoffAddress }
                  );
                  dispatched += 1;
                }
              }
            })
            .catch(() => {})
        );
      }
    }

    await Promise.all(tasks);
    return dispatched;
  } finally {
    realtimePollInFlight = false;
  }
}
