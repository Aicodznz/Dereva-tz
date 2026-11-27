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

export function mapNetworkToDaliPayProvider(
  network: ReturnType<typeof detectTanzaniaMobileNetwork>
): 'Airtel' | 'Tigo' | 'Halopesa' | 'Azampesa' | 'Mpesa' {
  switch (network) {
    case 'AIRTEL':
      return 'Airtel';
    case 'TIGO':
      return 'Tigo';
    case 'HALOPESA':
      return 'Halopesa';
    case 'MPESA':
    default:
      return 'Mpesa';
  }
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
  const daliProvider = mapNetworkToDaliPayProvider(network);
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
            external_id: uniqueOrderId,
            reference: uniqueOrderId,
            order_id: uniqueOrderId,
            amount: numericAmount,
            currency: 'TZS',
            account_number: cleanPhone,
            phone_number: cleanPhone,
            phone: cleanPhone,
            msisdn: cleanPhone,
            network,
            provider: daliProvider,
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
    fee?: number;
    totalDebit?: number;
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
  const daliProvider = mapNetworkToDaliPayProvider(network);
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
            external_id: params.reference,
            reference: params.reference,
            external_reference: params.reference,
            amount: numericAmount,
            currency: 'TZS',
            account_number: cleanPhone,
            phone_number: cleanPhone,
            phone: cleanPhone,
            msisdn: cleanPhone,
            network,
            provider: daliProvider,
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
            fee: typeof params.fee === 'number' ? params.fee : 0,
            totalDebit: typeof params.totalDebit === 'number' ? params.totalDebit : numericAmount,
            refundedOnFailure: false,
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
  disbursementInfo?: {
    recipientPhone?: string;
    network?: string;
    amount?: number;
    refundedAmount?: number;
    payerUid?: string;
  };
}> {
  const dataObj = payload?.data && typeof payload.data === 'object' ? payload.data : payload || {};
  const rawRef = String(
    dataObj.external_id ||
      payload?.external_id ||
      dataObj.order_id ||
      dataObj.external_reference ||
      dataObj.reference ||
      payload?.order_id ||
      payload?.reference ||
      ''
  ).trim();
  let realOrderId = extractRealOrderIdFromGatewayRef(rawRef);
  const gatewayRef = String(
    dataObj.gateway_ref ||
      dataObj.transaction_id ||
      dataObj.reference_id ||
      dataObj.reference ||
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
    realOrderId.startsWith('WTH-') ||
    realOrderId.startsWith('DISB-');

  let targetType: 'orders' | 'rides' | 'disbursements' = isDisbursement ? 'disbursements' : 'orders';
  let disbursementInfo: {
    recipientPhone?: string;
    network?: string;
    amount?: number;
    refundedAmount?: number;
    payerUid?: string;
  } | undefined;

  if (dbAdmin && (realOrderId || gatewayRef)) {
    try {
      let cbSnap = realOrderId
        ? await dbAdmin.collection('payment_callbacks').doc(realOrderId).get().catch(() => null)
        : null;
      if ((!cbSnap || !cbSnap.exists) && gatewayRef) {
        const cbQuery = await dbAdmin
          .collection('payment_callbacks')
          .where('reference_id', '==', gatewayRef)
          .limit(1)
          .get()
          .catch(() => null);
        const foundDoc = cbQuery?.docs?.[0];
        if (foundDoc) {
          cbSnap = foundDoc;
          realOrderId = String(foundDoc.data()?.order_id || foundDoc.id || realOrderId);
        }
      }

      const cbCol = cbSnap?.exists ? String(cbSnap.data()?.targetCollection || '') : '';
      if (cbCol === 'disbursements') {
        isDisbursement = true;
        targetType = 'disbursements';
      } else if (cbCol === 'rides') {
        targetType = 'rides';
      } else if (!isDisbursement && realOrderId) {
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

      if (isDisbursement && realOrderId) {
        const disbRef = dbAdmin.collection('disbursements').doc(realOrderId);
        const disbSnap = await disbRef.get().catch(() => null);
        const disbData = disbSnap?.exists ? disbSnap.data() || {} : {};
        const payerUid = String(disbData.payerUid || '').trim();
        const holdAmt = Number(disbData.holdAmount ?? disbData.totalDebit ?? disbData.amount ?? numericAmount ?? 0);
        let refundedAmount = 0;

        if (isFailed && payerUid && holdAmt > 0 && disbData.refundedOnFailure !== true) {
          try {
            const { releaseReservedPayoutFunds } = await import('./walletEngine.js');
            const relRes = await releaseReservedPayoutFunds(dbAdmin, {
              refCode: realOrderId,
              reason: String(dataObj?.reason || dataObj?.message || 'Payout failed at DaliPay webhook'),
              actorUid: 'dalipay_webhook',
              actorEmail: 'dalipay_webhook',
              externalReference: gatewayRef || undefined,
            });
            if (relRes.ok) {
              refundedAmount = Number(relRes.refundedAmount || holdAmt);
            }
          } catch (refundErr) {
            console.warn('[DaliPay Webhook] Disbursement auto-refund warning:', refundErr);
          }
        } else if (isPaid && payerUid && disbData.settledOnCompletion !== true) {
          try {
            const { finalizeCompletedPayout } = await import('./walletEngine.js');
            await finalizeCompletedPayout(dbAdmin, {
              refCode: realOrderId,
              externalReference: gatewayRef || realOrderId,
              actorUid: 'dalipay_webhook',
              actorEmail: 'dalipay_webhook',
              note: 'Settled automatically via DaliPay webhook',
            });
          } catch (settleErr) {
            console.warn('[DaliPay Webhook] Disbursement settle warning:', settleErr);
          }
        } else {
          await disbRef.set(
            cleanUndefined({
              status: isPaid ? 'completed' : isFailed ? 'failed' : 'pending',
              gatewayRef: gatewayRef || null,
              webhookPayload: payload,
              updatedAt: nowIso,
            }),
            { merge: true }
          );
        }

        disbursementInfo = {
          recipientPhone: disbData.recipientPhone ? String(disbData.recipientPhone) : undefined,
          network: disbData.network ? String(disbData.network) : undefined,
          amount: Number(disbData.amount || numericAmount || 0),
          refundedAmount: refundedAmount || undefined,
          payerUid: payerUid || undefined,
        };
      } else if (realOrderId) {
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

      if (realOrderId) {
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
      }
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
    disbursementInfo,
  };
}

export async function executePapoWalletMobileDisbursement(
  dbAdmin: any,
  params: {
    payerUid?: string;
    phone: string;
    displayName: string;
    recipientPhone?: string;
    recipientName?: string;
    amount: number;
    pin?: string;
    idempotencyKey?: string;
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
  newReservedBalance?: number;
}> {
  const amt = Math.round(Number(params.amount || 0));
  if (!dbAdmin || !Number.isFinite(amt) || amt < 1000) {
    return { ok: false, reason: 'Kiasi cha chini cha kutoa ni TZS 1,000.' };
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

  const targetRecipientPhone = String(params.recipientPhone || params.phone).trim();
  const network = detectTanzaniaMobileNetwork(targetRecipientPhone);
  const {
    computeWithdrawalFee,
    dispatchModularMobileMoneyPayout,
    getMobileMoneyNetworkLabel,
    getPapoPayTreasurySettings,
    normalizeMobileMoneyNetwork,
  } = await import('./payoutProviders.js');
  const { finalizeCompletedPayout, releaseReservedPayoutFunds } = await import('./walletEngine.js');

  const settings = await getPapoPayTreasurySettings(dbAdmin);
  const cleanNet = normalizeMobileMoneyNetwork(network, targetRecipientPhone) || 'MPESA';
  if (settings.enabledNetworks[cleanNet] === false) {
    return {
      ok: false,
      reason: `Huduma ya ${getMobileMoneyNetworkLabel(cleanNet)} imezimwa kwa muda na Admin.`,
    };
  }

  const fee = computeWithdrawalFee(amt, settings);
  const totalDebit = amt + fee;
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const refCode = `MMW-${code}`;
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const targetRecipientName = String(params.recipientName || params.displayName || targetRecipientPhone).trim();
  const cleanPhone = normalizePhoneForDaliPay(targetRecipientPhone);
  const formattedPhone = `+${cleanPhone}`;

  let newBalance = 0;
  let newReservedBalance = 0;

  try {
    await dbAdmin.runTransaction(async (tx: any) => {
      const ref = dbAdmin.collection('users').doc(userRec.uid);
      const snap = await tx.get(ref);
      const curBal = Number(snap.data()?.walletBalance || 0);
      const curRes = Number(snap.data()?.reservedBalance || 0);
      if (curBal < totalDebit || curBal - totalDebit < 0) {
        throw new Error(`INSUFFICIENT:${curBal}`);
      }
      newBalance = curBal - totalDebit;
      newReservedBalance = curRes + totalDebit;
      tx.set(
        ref,
        { walletBalance: newBalance, reservedBalance: newReservedBalance, updatedAt: nowIso },
        { merge: true }
      );
      tx.set(
        dbAdmin.collection('disbursements').doc(refCode),
        cleanUndefined({
          reference: refCode,
          transactionId: refCode,
          provider: settings.b2cProvider,
          channel: 'mobile_money',
          network: cleanNet,
          networkLabel: getMobileMoneyNetworkLabel(cleanNet),
          recipientPhone: formattedPhone,
          recipientName: targetRecipientName,
          payerUid: userRec.uid,
          payerName: params.displayName,
          payerPhone: params.phone,
          amount: amt,
          fee,
          totalDebit,
          holdAmount: totalDebit,
          status: 'pending_admin_settlement',
          refundedOnFailure: false,
          settledOnCompletion: false,
          createdAt: nowIso,
          createdAtMs: nowMs,
          updatedAt: nowIso,
        })
      );
      tx.set(
        dbAdmin.collection('wallet_transactions').doc(`${refCode}-PND`),
        cleanUndefined({
          id: `${refCode}-PND`,
          transactionId: refCode,
          refCode,
          ownerUid: userRec.uid,
          type: 'PENDING_WITHDRAWAL',
          typeLabel: 'Pending Withdrawal',
          direction: 'debit',
          amount: amt,
          fee,
          totalAmount: totalDebit,
          status: 'pending',
          paymentMethod: getMobileMoneyNetworkLabel(cleanNet),
          network: cleanNet,
          senderUid: userRec.uid,
          senderName: params.displayName,
          senderPhone: params.phone,
          recipientName: `${targetRecipientName} (${formattedPhone})`,
          recipientPhone: formattedPhone,
          title: `Pending Withdrawal: ${getMobileMoneyNetworkLabel(cleanNet)} (${formattedPhone})`,
          subtitle: `${refCode} • Funds reserved awaiting settlement`,
          currency: 'TZS',
          createdAt: nowIso,
          createdAtMs: nowMs,
        })
      );
    });
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

  const dispatch = await dispatchModularMobileMoneyPayout(dbAdmin, settings, {
    reference: refCode,
    amount: amt,
    fee,
    totalDebit,
    network: cleanNet,
    recipientPhone: cleanPhone,
    recipientName: targetRecipientName,
    payerUid: userRec.uid,
    reason: `PapoPay Mobile Money #${refCode}`,
  });

  if (dispatch.outcome === 'completed') {
    await finalizeCompletedPayout(dbAdmin, {
      refCode,
      externalReference: dispatch.gatewayRef || refCode,
      actorUid: 'system_b2c',
      actorEmail: dispatch.provider,
    });
    return {
      ok: true,
      refCode,
      gatewayRef: dispatch.gatewayRef,
      network: cleanNet,
      status: 'completed',
      fee,
      totalDebit,
      newBalance,
      newReservedBalance: Math.max(0, newReservedBalance - totalDebit),
    };
  }

  if (dispatch.outcome === 'definitive_failure') {
    const rel = await releaseReservedPayoutFunds(dbAdmin, {
      refCode,
      reason: dispatch.message,
      actorUid: 'system_b2c',
      actorEmail: dispatch.provider,
    });
    return {
      ok: false,
      reason: `${dispatch.message} (Fedha zimerudishwa salama kwenye wallet yako).`,
      newBalance: rel.newAvailableBalance,
      newReservedBalance: rel.newReservedBalance,
    };
  }

  // Safely reserved pending settlement (including DaliPay dashboard-only mode)
  await dbAdmin.collection('payments').doc(`${refCode}-PND`).set(
    cleanUndefined({
      uid: userRec.uid,
      phone: params.phone,
      recipientPhone: formattedPhone,
      recipientName: targetRecipientName,
      title: `Toa Pesa kwenda ${getMobileMoneyNetworkLabel(cleanNet)} (${formattedPhone})`,
      subtitle: `${refCode} • PENDING • Ada TZS ${fee.toLocaleString()}`,
      amount: totalDebit,
      fee,
      type: 'debit',
      txType: 'PENDING_WITHDRAWAL',
      category: 'withdraw',
      status: 'pending',
      refCode,
      paymentMethod: getMobileMoneyNetworkLabel(cleanNet),
      createdAt: nowIso,
      createdAtMs: nowMs,
    }),
    { merge: true }
  );

  return {
    ok: true,
    refCode,
    gatewayRef: dispatch.gatewayRef,
    network: cleanNet,
    status: 'pending',
    fee,
    totalDebit,
    newBalance,
    newReservedBalance,
  };
}
