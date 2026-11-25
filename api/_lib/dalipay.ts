import crypto from 'node:crypto';
import { cleanUndefined } from './getFirestoreDb.js';
import { findOrEnsureWalletUser, settlePaidMongikeOrder } from './papoWalletSettlement.js';

export const DEFAULT_DALIPAY_BASE_URL = 'https://app.dalipay.co.tz/api/v1';

export interface DaliPayConfigStatus {
  configured: boolean;
  mode: 'live' | 'test' | 'unconfigured';
  baseUrl: string;
  collectionsPath: string;
  disbursementsPath: string;
  hasCallbackSecret: boolean;
}

function isPlaceholder(val: string): boolean {
  if (!val || val.length < 10) return true;
  const lower = val.toLowerCase();
  return (
    lower.includes('your_') ||
    lower.includes('weka_') ||
    lower.includes('placeholder') ||
    lower.includes('enter_') ||
    lower.includes('my_dalipay')
  );
}

export function getDaliPayConfig(): DaliPayConfigStatus & {
  publicKey: string;
  secretKey: string;
  callbackSecret: string;
} {
  const cleanEnv = (v?: string) =>
    String(v || '')
      .trim()
      .replace(/^["']+|["']+$/g, '')
      .trim();
  const publicKey = cleanEnv(process.env.DALIPAY_PUBLIC_KEY);
  const secretKey = cleanEnv(process.env.DALIPAY_SECRET_KEY);
  const callbackSecret = cleanEnv(process.env.DALIPAY_CALLBACK_SECRET);
  let baseUrl = (cleanEnv(process.env.DALIPAY_BASE_URL) || DEFAULT_DALIPAY_BASE_URL)
    .replace(/\/+$/, '');
  if (/^https?:\/\/api\.dalipay\.co\.tz(\/|$)/i.test(baseUrl)) {
    baseUrl = baseUrl.replace(/^https?:\/\/api\.dalipay\.co\.tz/i, 'https://app.dalipay.co.tz');
  }
  const collectionsPath = `/${String(process.env.DALIPAY_COLLECTIONS_PATH || '/collections')
    .trim()
    .replace(/^\/+/, '')}`;
  const disbursementsPath = `/${String(process.env.DALIPAY_DISBURSEMENTS_PATH || '/disbursements')
    .trim()
    .replace(/^\/+/, '')}`;

  const configured = !isPlaceholder(publicKey) && !isPlaceholder(secretKey);
  let mode: 'live' | 'test' | 'unconfigured' = 'unconfigured';
  if (configured) {
    if (
      publicKey.startsWith('gw_pk_test_') ||
      secretKey.startsWith('gw_sk_test_')
    ) {
      mode = 'test';
    } else {
      mode = 'live';
    }
  }

  return {
    configured,
    mode,
    baseUrl,
    collectionsPath,
    disbursementsPath,
    hasCallbackSecret: !isPlaceholder(callbackSecret),
    publicKey,
    secretKey,
    callbackSecret,
  };
}

export function isDaliPayConfigured(): boolean {
  return getDaliPayConfig().configured;
}

export function normalizePhoneForDaliPay(rawPhone?: string): string {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('255') && digits.length >= 12) return digits.slice(0, 12);
  if (digits.startsWith('0') && digits.length >= 10) return `255${digits.slice(1, 10)}`;
  if (digits.length === 9) return `255${digits}`;
  return digits;
}

export function detectTanzaniaMobileNetwork(
  rawPhone?: string
): 'MPESA' | 'TIGO' | 'AIRTEL' | 'HALOPESA' | 'TTCL' {
  const msisdn = normalizePhoneForDaliPay(rawPhone);
  const prefix = msisdn.startsWith('255') ? msisdn.slice(3, 5) : msisdn.slice(0, 2);
  if (['74', '75', '76'].includes(prefix)) return 'MPESA';
  if (['71', '65', '67'].includes(prefix)) return 'TIGO';
  if (['68', '69', '78', '79'].includes(prefix)) return 'AIRTEL';
  if (prefix === '62') return 'HALOPESA';
  if (prefix === '73') return 'TTCL';
  return 'MPESA';
}

export function extractRealOrderIdFromGatewayRef(gatewayOrderId?: string): string {
  const raw = String(gatewayOrderId || '').trim();
  if (!raw) return '';
  if (/-\d{10,}$/.test(raw)) return raw.replace(/-\d{10,}$/, '');
  if (/_\d{10,}$/.test(raw)) return raw.replace(/_\d{10,}$/, '');
  return raw;
}

/**
 * Verifies DaliPay `X-Signature` header (HMAC-SHA256 using Callback Secret).
 * Fails closed whenever `DALIPAY_CALLBACK_SECRET` is configured.
 */
export function verifyDaliPaySignature(
  rawBody: string | Buffer,
  signatureHeader?: string | string[]
): { valid: boolean; enforced: boolean; reason?: string } {
  const cfg = getDaliPayConfig();
  if (!cfg.hasCallbackSecret) {
    return { valid: true, enforced: false };
  }

  const rawSig = Array.isArray(signatureHeader)
    ? String(signatureHeader[0] || '').trim()
    : String(signatureHeader || '').trim();
  if (!rawSig) {
    return { valid: false, enforced: true, reason: 'Missing X-Signature header' };
  }

  const normalizedSig = rawSig.replace(/^sha256=/i, '').trim();
  const bodyBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8');
  const expectedHex = crypto
    .createHmac('sha256', cfg.callbackSecret)
    .update(bodyBuf)
    .digest('hex');
  const expectedB64 = crypto
    .createHmac('sha256', cfg.callbackSecret)
    .update(bodyBuf)
    .digest('base64');

  const safeCompare = (a: string, b: string) => {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
  };

  if (
    safeCompare(normalizedSig.toLowerCase(), expectedHex.toLowerCase()) ||
    safeCompare(normalizedSig, expectedB64)
  ) {
    return { valid: true, enforced: true };
  }

  return { valid: false, enforced: true, reason: 'Invalid X-Signature HMAC-SHA256 digest' };
}

export const DEFAULT_PUBLIC_APP_URL = 'https://dereva-tz.onrender.com';

export function getPublicWebhookCallbackUrl(): string {
  const explicitWebhook = String(process.env.DALIPAY_WEBHOOK_URL || '').trim();
  if (/^https?:\/\//i.test(explicitWebhook)) {
    return explicitWebhook;
  }
  const publicBase = String(process.env.APP_PUBLIC_URL || '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/\/+$/, '');
  const base =
    publicBase && /^https?:\/\//i.test(publicBase)
      ? publicBase
      : DEFAULT_PUBLIC_APP_URL;
  return `${base}/webhooks/gateway`;
}

export async function initiateDaliPayCollection(
  params: {
    orderId: string;
    amount: number;
    buyerPhone: string;
    collection?: 'orders' | 'rides';
    description?: string;
  },
  dbAdmin?: any
) {
  const cfg = getDaliPayConfig();
  const cleanPhone = normalizePhoneForDaliPay(params.buyerPhone);
  const numericAmount = Math.max(0, Math.round(Number(params.amount) || 0));
  const collection = params.collection === 'rides' ? 'rides' : 'orders';

  if (!cfg.configured) {
    return {
      status: 'error',
      message: 'DaliPay API keys (DALIPAY_PUBLIC_KEY / DALIPAY_SECRET_KEY) hazijawekwa.',
      httpStatus: 503,
    };
  }

  if (!params.orderId || numericAmount <= 0 || cleanPhone.length < 9) {
    return {
      status: 'error',
      message: 'Taarifa za malipo hazijakamilika (orderId, kiasi, au namba ya simu).',
      httpStatus: 400,
    };
  }

  const uniqueOrderId = `${params.orderId}-${Date.now()}`;
  const network = detectTanzaniaMobileNetwork(cleanPhone);
  const callbackUrl = getPublicWebhookCallbackUrl();
  const endpoint = `${cfg.baseUrl}${cfg.collectionsPath}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 14000);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'X-Public-Key': cfg.publicKey,
          'X-Secret-Key': cfg.secretKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          cleanUndefined({
            reference: uniqueOrderId,
            order_id: uniqueOrderId,
            amount: numericAmount,
            currency: 'TZS',
            phone_number: cleanPhone,
            phone: cleanPhone,
            msisdn: cleanPhone,
            network,
            channel: network,
            description: params.description || `PapoPay #${params.orderId}`,
            callback_url: callbackUrl || undefined,
            webhook_url: callbackUrl || undefined,
          })
        ),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const rawText = await response.text().catch(() => '');
    let data: any = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = rawText ? { message: rawText.slice(0, 240) } : {};
    }

    if (!response.ok || data?.success === false || String(data?.status || '').toLowerCase() === 'error') {
      const errMsg =
        data?.message ||
        data?.error?.message ||
        (typeof data?.error === 'string' ? data.error : '') ||
        data?.detail ||
        `DaliPay API ilikataa ombi la malipo (HTTP ${response.status})`;
      console.error('[DaliPay Collection] API error:', response.status, data);

      if (dbAdmin) {
        await Promise.allSettled([
          dbAdmin.collection(collection).doc(String(params.orderId)).set(
            cleanUndefined({
              gatewayOrderId: uniqueOrderId,
              paymentProvider: 'dalipay',
              paymentMode: cfg.mode,
              paymentPushStatus: 'failed',
              paymentError: errMsg,
              updatedAt: new Date().toISOString(),
            }),
            { merge: true }
          ),
          dbAdmin.collection('payment_callbacks').doc(String(params.orderId)).set(
            cleanUndefined({
              order_id: params.orderId,
              gateway_order_id: uniqueOrderId,
              targetCollection: collection,
              provider: 'dalipay',
              mode: cfg.mode,
              status: 'FAILED',
              http_status: response.status,
              error_message: errMsg,
              buyer_phone: cleanPhone,
              network,
              amount: numericAmount,
              updated_at: new Date().toISOString(),
            }),
            { merge: true }
          ),
        ]);
      }

      return {
        status: 'error',
        message: errMsg,
        sandbox: cfg.mode === 'test',
        httpStatus: response.status >= 400 ? response.status : 502,
        error: data,
      };
    }

    const gatewayRef = String(
      data?.data?.gateway_ref ||
        data?.data?.reference ||
        data?.data?.transaction_id ||
        data?.gateway_ref ||
        data?.reference ||
        data?.transaction_id ||
        uniqueOrderId
    );
    const remoteStatus = String(data?.data?.status || data?.status || 'PENDING').toUpperCase();
    const isInstantPaid = ['COMPLETED', 'SUCCESS', 'PAID', 'SETTLED', 'SUCCESSFUL'].includes(remoteStatus);

    if (dbAdmin) {
      await Promise.allSettled([
        dbAdmin.collection(collection).doc(String(params.orderId)).set(
          cleanUndefined({
            gatewayOrderId: uniqueOrderId,
            gatewayRef,
            paymentProvider: 'dalipay',
            paymentMode: cfg.mode,
            paymentNetwork: network,
            paymentPushStatus: isInstantPaid ? 'paid' : 'sent',
            paymentStatus: isInstantPaid ? 'paid' : 'pending',
            paymentError: null,
            updatedAt: new Date().toISOString(),
          }),
          { merge: true }
        ),
        dbAdmin.collection('payment_callbacks').doc(String(params.orderId)).set(
          cleanUndefined({
            order_id: params.orderId,
            gateway_order_id: uniqueOrderId,
            targetCollection: collection,
            provider: 'dalipay',
            mode: cfg.mode,
            kind: 'collection',
            network,
            status: isInstantPaid ? 'COMPLETED' : 'PENDING',
            reference_id: gatewayRef,
            buyer_phone: cleanPhone,
            amount: numericAmount,
            raw_payload: data,
            updated_at: new Date().toISOString(),
          }),
          { merge: true }
        ),
      ]);

      if (isInstantPaid) {
        await settlePaidMongikeOrder(dbAdmin, {
          targetId: String(params.orderId),
          targetType: collection,
          amount: numericAmount,
          gatewayRef,
        }).catch(() => {});
      }
    }

    return {
      status: 'success',
      provider: 'dalipay',
      sandbox: cfg.mode === 'test',
      httpStatus: 201,
      message:
        data?.message ||
        `Ombi la malipo (${network}) limetumwa kupitia DaliPay (${cfg.mode === 'test' ? 'Test Mode' : 'Live'})`,
      data: {
        id: String(data?.data?.id || data?.id || uniqueOrderId),
        order_id: params.orderId,
        gateway_ref: gatewayRef,
        amount: numericAmount,
        status: isInstantPaid ? 'COMPLETED' : 'PENDING',
        expires_at: data?.data?.expires_at,
      },
    };
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError';
    const failMsg = isAbort
      ? 'Muda wa kusubiri DaliPay umeisha (timeout). Tafadhali jaribu tena.'
      : 'Imeshindikana kuwasiliana na DaliPay. Jaribu tena au tumia Lipa Namba 5656565.';
    console.error('[DaliPay Collection] Network failure:', err?.message || err);

    if (dbAdmin) {
      await Promise.allSettled([
        dbAdmin.collection(collection).doc(String(params.orderId)).set(
          cleanUndefined({
            gatewayOrderId: uniqueOrderId,
            paymentProvider: 'dalipay',
            paymentMode: cfg.mode,
            paymentPushStatus: 'failed',
            paymentError: err?.message || failMsg,
            updatedAt: new Date().toISOString(),
          }),
          { merge: true }
        ),
        dbAdmin.collection('payment_callbacks').doc(String(params.orderId)).set(
          cleanUndefined({
            order_id: params.orderId,
            gateway_order_id: uniqueOrderId,
            targetCollection: collection,
            provider: 'dalipay',
            mode: cfg.mode,
            kind: 'collection',
            status: 'FAILED',
            http_status: isAbort ? 504 : 500,
            error_message: err?.message || failMsg,
            buyer_phone: cleanPhone,
            network,
            amount: numericAmount,
            updated_at: new Date().toISOString(),
          }),
          { merge: true }
        ),
      ]);
    }

    return {
      status: 'error',
      message: failMsg,
      sandbox: cfg.mode === 'test',
      httpStatus: isAbort ? 504 : 500,
    };
  }
}

export async function initiateDaliPayDisbursement(
  params: {
    reference: string;
    amount: number;
    recipientPhone: string;
    recipientName?: string;
    reason?: string;
    payerUid?: string;
  },
  dbAdmin?: any
): Promise<{
  ok: boolean;
  status: 'completed' | 'pending' | 'failed';
  mode: 'live' | 'test' | 'unconfigured';
  gatewayRef?: string;
  network?: string;
  message: string;
}> {
  const cfg = getDaliPayConfig();
  const cleanPhone = normalizePhoneForDaliPay(params.recipientPhone);
  const numericAmount = Math.max(0, Math.round(Number(params.amount) || 0));
  const network = detectTanzaniaMobileNetwork(cleanPhone);

  if (!cfg.configured) {
    return {
      ok: false,
      status: 'failed',
      mode: 'unconfigured',
      network,
      message: 'DaliPay API haijawashwa kwenye seva bado.',
    };
  }

  if (!params.reference || numericAmount < 500 || cleanPhone.length < 9) {
    return {
      ok: false,
      status: 'failed',
      mode: cfg.mode,
      network,
      message: 'Taarifa za mpokeaji au kiasi hazijakamilika.',
    };
  }

  const endpoint = `${cfg.baseUrl}${cfg.disbursementsPath}`;
  const callbackUrl = getPublicWebhookCallbackUrl();
  const nowIso = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 14000);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'X-Public-Key': cfg.publicKey,
          'X-Secret-Key': cfg.secretKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          cleanUndefined({
            reference: params.reference,
            external_reference: params.reference,
            amount: numericAmount,
            currency: 'TZS',
            phone_number: cleanPhone,
            phone: cleanPhone,
            msisdn: cleanPhone,
            network,
            recipient_name: params.recipientName || 'PapoPay User',
            description: params.reason || `PapoWallet Payout #${params.reference}`,
            callback_url: callbackUrl || undefined,
            webhook_url: callbackUrl || undefined,
          })
        ),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const rawText = await response.text().catch(() => '');
    let data: any = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = rawText ? { message: rawText.slice(0, 240) } : {};
    }

    if (!response.ok || data?.success === false || String(data?.status || '').toLowerCase() === 'error') {
      const errMsg =
        data?.message ||
        data?.error?.message ||
        (typeof data?.error === 'string' ? data.error : '') ||
        `DaliPay Disbursement ilishindwa (HTTP ${response.status})`;
      console.error('[DaliPay Disbursement] API error:', response.status, data);
      return {
        ok: false,
        status: 'failed',
        mode: cfg.mode,
        network,
        message: errMsg,
      };
    }

    const gatewayRef = String(
      data?.data?.gateway_ref ||
        data?.data?.reference ||
        data?.data?.transaction_id ||
        data?.gateway_ref ||
        data?.reference ||
        params.reference
    );
    const remoteStatus = String(data?.data?.status || data?.status || 'PENDING').toUpperCase();
    const isCompleted = ['COMPLETED', 'SUCCESS', 'PAID', 'SETTLED', 'SUCCESSFUL'].includes(remoteStatus);

    if (dbAdmin) {
      await Promise.allSettled([
        dbAdmin.collection('disbursements').doc(params.reference).set(
          cleanUndefined({
            reference: params.reference,
            gatewayRef,
            provider: 'dalipay',
            mode: cfg.mode,
            network,
            recipientPhone: cleanPhone,
            recipientName: params.recipientName || 'PapoPay User',
            payerUid: params.payerUid || null,
            amount: numericAmount,
            status: isCompleted ? 'completed' : 'pending',
            rawResponse: data,
            createdAt: nowIso,
            updatedAt: nowIso,
          }),
          { merge: true }
        ),
        dbAdmin.collection('payment_callbacks').doc(params.reference).set(
          cleanUndefined({
            order_id: params.reference,
            targetCollection: 'disbursements',
            provider: 'dalipay',
            mode: cfg.mode,
            kind: 'disbursement',
            network,
            status: isCompleted ? 'COMPLETED' : 'PENDING',
            reference_id: gatewayRef,
            buyer_phone: cleanPhone,
            amount: numericAmount,
            updated_at: nowIso,
          }),
          { merge: true }
        ),
      ]);
    }

    return {
      ok: true,
      status: isCompleted ? 'completed' : 'pending',
      mode: cfg.mode,
      gatewayRef,
      network,
      message: isCompleted
        ? `Pesa imetumwa kwenda ${network} (+${cleanPhone}) kupitia DaliPay.`
        : `Ombi la kutuma pesa kwenda ${network} (+${cleanPhone}) linachakatwa na DaliPay.`,
    };
  } catch (err: any) {
    console.error('[DaliPay Disbursement] Network failure:', err?.message || err);
    return {
      ok: false,
      status: 'failed',
      mode: cfg.mode,
      network,
      message: err?.message || 'Imeshindikana kuwasiliana na DaliPay Disbursements API.',
    };
  }
}

export async function processDaliPayWebhook(
  payload: any,
  dbAdmin?: any
): Promise<{
  kind: 'collection' | 'disbursement';
  realOrderId: string;
  targetType: 'orders' | 'rides' | 'disbursements';
  isPaid: boolean;
  isFailed: boolean;
  amount: number;
  gatewayRef: string;
  normalizedStatus: string;
}> {
  const dataObj = payload?.data && typeof payload.data === 'object' ? payload.data : payload || {};
  const rawRef = String(
    dataObj.order_id ||
      dataObj.external_reference ||
      dataObj.reference ||
      payload?.order_id ||
      payload?.reference ||
      ''
  ).trim();
  const realOrderId = extractRealOrderIdFromGatewayRef(rawRef);
  const gatewayRef = String(
    dataObj.gateway_ref ||
      dataObj.transaction_id ||
      dataObj.reference_id ||
      payload?.transaction_id ||
      rawRef
  ).trim();
  const rawEvent = String(payload?.event || payload?.type || dataObj?.type || '').toLowerCase();
  const rawStatus = String(dataObj.status || payload?.status || '').trim().toUpperCase();
  const isPaid = ['COMPLETED', 'SUCCESS', 'PAID', 'SETTLED', 'SUCCESSFUL'].includes(rawStatus);
  const isFailed = ['FAILED', 'ERROR', 'CANCELLED', 'EXPIRED', 'REJECTED'].includes(rawStatus);
  const numericAmount = Number(dataObj.amount || payload?.amount || 0);

  let isDisbursement =
    rawEvent.includes('disbursement') ||
    rawEvent.includes('payout') ||
    realOrderId.startsWith('WTH-');

  let targetType: 'orders' | 'rides' | 'disbursements' = isDisbursement ? 'disbursements' : 'orders';

  if (dbAdmin && realOrderId) {
    try {
      const cbSnap = await dbAdmin.collection('payment_callbacks').doc(realOrderId).get().catch(() => null);
      const cbCol = cbSnap?.exists ? String(cbSnap.data()?.targetCollection || '') : '';
      if (cbCol === 'disbursements') {
        isDisbursement = true;
        targetType = 'disbursements';
      } else if (cbCol === 'rides') {
        targetType = 'rides';
      } else if (!isDisbursement) {
        const ordSnap = await dbAdmin.collection('orders').doc(realOrderId).get().catch(() => null);
        if (!ordSnap?.exists) {
          const rideSnap = await dbAdmin.collection('rides').doc(realOrderId).get().catch(() => null);
          if (rideSnap?.exists) {
            targetType = 'rides';
          } else {
            const disbSnap = await dbAdmin.collection('disbursements').doc(realOrderId).get().catch(() => null);
            if (disbSnap?.exists) {
              isDisbursement = true;
              targetType = 'disbursements';
            }
          }
        }
      }

      const nowIso = new Date().toISOString();

      if (isDisbursement) {
        await dbAdmin.collection('disbursements').doc(realOrderId).set(
          cleanUndefined({
            status: isPaid ? 'completed' : isFailed ? 'failed' : 'pending',
            gatewayRef: gatewayRef || null,
            webhookPayload: payload,
            updatedAt: nowIso,
          }),
          { merge: true }
        );
      } else {
        if (isPaid) {
          await dbAdmin.collection(targetType).doc(realOrderId).set(
            cleanUndefined({
              paymentStatus: 'paid',
              paymentPushStatus: 'paid',
              paymentProvider: 'dalipay',
              paymentError: null,
              updatedAt: nowIso,
              gatewayRef: gatewayRef || null,
            }),
            { merge: true }
          );

          const collectionTarget: 'orders' | 'rides' =
            targetType === 'rides' ? 'rides' : 'orders';
          await settlePaidMongikeOrder(dbAdmin, {
            targetId: realOrderId,
            targetType: collectionTarget,
            amount: numericAmount,
            gatewayRef,
          }).catch((sErr) => {
            console.warn('[DaliPay Webhook] Wallet settlement warning:', sErr);
          });
        } else if (isFailed) {
          await dbAdmin.collection(targetType).doc(realOrderId).set(
            cleanUndefined({
              paymentProvider: 'dalipay',
              paymentPushStatus: 'failed',
              paymentError: String(dataObj?.reason || dataObj?.message || 'Malipo hayakukamilika kupitia DaliPay.'),
              updatedAt: nowIso,
            }),
            { merge: true }
          );
        }
      }

      await dbAdmin.collection('payment_callbacks').doc(realOrderId).set(
        cleanUndefined({
          order_id: realOrderId,
          gateway_order_id: rawRef || realOrderId,
          targetCollection: targetType,
          provider: 'dalipay',
          kind: isDisbursement ? 'disbursement' : 'collection',
          status: rawStatus || 'UNKNOWN',
          reference_id: gatewayRef,
          amount: numericAmount,
          error_message: isFailed ? String(dataObj?.reason || dataObj?.message || '') || undefined : undefined,
          raw_payload: payload,
          updated_at: nowIso,
        }),
        { merge: true }
      );
    } catch (err) {
      console.warn('[DaliPay Webhook] DB update warning:', err);
    }
  }

  return {
    kind: isDisbursement ? 'disbursement' : 'collection',
    realOrderId,
    targetType,
    isPaid,
    isFailed,
    amount: numericAmount,
    gatewayRef,
    normalizedStatus: rawStatus || 'UNKNOWN',
  };
}

export async function executePapoWalletMobileDisbursement(
  dbAdmin: any,
  params: {
    payerUid?: string;
    phone: string;
    displayName: string;
    amount: number;
  }
): Promise<{
  ok: boolean;
  reason?: string;
  refCode?: string;
  gatewayRef?: string;
  network?: string;
  status?: 'completed' | 'pending';
  fee?: number;
  totalDebit?: number;
  newBalance?: number;
}> {
  const amt = Math.round(Number(params.amount || 0));
  if (!dbAdmin || !Number.isFinite(amt) || amt < 1000) {
    return { ok: false, reason: 'Kiasi cha chini cha kutoa ni TZS 1,000.' };
  }

  const cfg = getDaliPayConfig();
  if (!cfg.configured) {
    return {
      ok: false,
      reason:
        'Kutoa pesa moja kwa moja kwenda simu (DaliPay Disbursements) kunahitaji funguo za DaliPay kwenye seva. Tumia Msimbo wa Wakala kupata pesa taslimu.',
    };
  }

  const userRec = await findOrEnsureWalletUser(dbAdmin, {
    uid: params.payerUid,
    phone: params.phone,
    displayName: params.displayName,
    createIfMissing: false,
  });
  if (!userRec) {
    return { ok: false, reason: 'Akaunti ya PapoWallet haikupatikana au haina salio.' };
  }

  const fee = Math.max(100, Math.round(amt * 0.002));
  const totalDebit = amt + fee;
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const refCode = `DISB-${code}`;
  const nowIso = new Date().toISOString();
  let newBalance = 0;

  try {
    if (typeof dbAdmin.runTransaction === 'function') {
      await dbAdmin.runTransaction(async (tx: any) => {
        const ref = dbAdmin.collection('users').doc(userRec.uid);
        const snap = await tx.get(ref);
        const curBal = Number(snap.data()?.walletBalance || 0);
        if (curBal < totalDebit) {
          throw new Error(`INSUFFICIENT:${curBal}`);
        }
        newBalance = curBal - totalDebit;
        tx.set(ref, { walletBalance: newBalance, updatedAt: nowIso }, { merge: true });
      });
    } else {
      const curBal = Number(userRec.data?.walletBalance || 0);
      if (curBal < totalDebit) {
        return {
          ok: false,
          reason: `Salio halitoshi kutoa TZS ${amt.toLocaleString()} + Ada TZS ${fee.toLocaleString()} (Una TZS ${curBal.toLocaleString()}).`,
        };
      }
      newBalance = curBal - totalDebit;
      await dbAdmin.collection('users').doc(userRec.uid).set(
        { walletBalance: newBalance, updatedAt: nowIso },
        { merge: true }
      );
    }
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.startsWith('INSUFFICIENT:')) {
      const bal = Number(msg.split(':')[1] || 0);
      return {
        ok: false,
        reason: `Salio halitoshi kutoa TZS ${amt.toLocaleString()} + Ada TZS ${fee.toLocaleString()} (Una TZS ${bal.toLocaleString()}).`,
      };
    }
    return { ok: false, reason: 'Imeshindwa kuhakiki salio la PapoWallet.' };
  }

  const disbRes = await initiateDaliPayDisbursement(
    {
      reference: refCode,
      amount: amt,
      recipientPhone: params.phone,
      recipientName: params.displayName,
      reason: `PapoWallet Cash-Out #${refCode}`,
      payerUid: userRec.uid,
    },
    dbAdmin
  );

  if (!disbRes.ok) {
    // Refund atomically so customer funds are never lost when gateway declines
    try {
      const ref = dbAdmin.collection('users').doc(userRec.uid);
      const snap = await ref.get();
      const curBal = Number(snap.data()?.walletBalance || 0);
      await ref.set(
        { walletBalance: curBal + totalDebit, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch {}
    return {
      ok: false,
      reason: `${disbRes.message} (Salio lako limerudishwa salama).`,
    };
  }

  await dbAdmin.collection('payments').add(
    cleanUndefined({
      uid: userRec.uid,
      phone: params.phone,
      title: `Toa Pesa kwenda ${disbRes.network || 'Simu'} (DaliPay)`,
      subtitle: `${refCode} • Ada (TZS ${fee.toLocaleString()})`,
      amount: totalDebit,
      type: 'debit',
      category: 'withdraw',
      status: disbRes.status === 'completed' ? 'completed' : 'pending',
      refCode,
      gatewayRef: disbRes.gatewayRef,
      createdAt: nowIso,
      createdAtMs: Date.now(),
    })
  );

  return {
    ok: true,
    refCode,
    gatewayRef: disbRes.gatewayRef,
    network: disbRes.network,
    status: disbRes.status === 'completed' ? 'completed' : 'pending',
    fee,
    totalDebit,
    newBalance,
  };
}
