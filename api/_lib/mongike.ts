import { cleanUndefined } from './getFirestoreDb.js';
import { settlePaidMongikeOrder } from './papoWalletSettlement.js';

export const MONGIKE_TANZANIA_MOMO_ENDPOINT =
  'https://mongike.com/api/v1/payments/mobile-money/tanzania';

export interface MongikePaymentResult {
  status: string;
  message: string;
  sandbox?: boolean;
  httpStatus?: number;
  data?: {
    id: string;
    order_id: string;
    gateway_ref: string;
    amount: number;
    status: string;
    expires_at?: string;
  };
  error?: any;
}

export function isMongikeLiveConfigured(): boolean {
  const apiKey = String(process.env.MONGIKE_API_KEY || '').trim();
  if (!apiKey || apiKey.length < 10) return false;
  const lower = apiKey.toLowerCase();
  if (
    lower.includes('your_') ||
    lower.includes('weka_') ||
    lower.includes('placeholder') ||
    lower.includes('enter_')
  ) {
    return false;
  }
  return true;
}

export function normalizePhoneForMongike(rawPhone?: string): string {
  const raw = String(rawPhone || '').trim();
  if (!raw) return '';
  let formatted = raw;
  if (raw.startsWith('0')) {
    formatted = '255' + raw.substring(1);
  } else if (raw.startsWith('+')) {
    formatted = raw.substring(1);
  } else if (!raw.startsWith('255') && raw.replace(/[^0-9]/g, '').length === 9) {
    formatted = '255' + raw.replace(/[^0-9]/g, '');
  }
  return formatted.replace(/[^0-9]/g, '');
}

export function isMobileMoneyPaymentMethod(method?: string): boolean {
  const m = String(method || '').trim().toLowerCase();
  return ['mpesa', 'tigopesa', 'airtelmoney', 'halopesa', 'mobile_money', 'mongike', 'yas', 'mixx'].includes(m);
}

/**
 * Strips only the trailing `-<timestamp>` (10+ digits) or `_<timestamp>` appended
 * by our initiate proxy so order IDs that legitimately contain hyphens
 * (e.g. `m-176349123-ab12c` or `PH-123456`) remain completely intact.
 */
export function extractRealOrderIdFromMongikeRef(gatewayOrderId?: string): string {
  const raw = String(gatewayOrderId || '').trim();
  if (!raw) return '';
  if (/-\d{10,}$/.test(raw)) {
    return raw.replace(/-\d{10,}$/, '');
  }
  if (/_\d{10,}$/.test(raw)) {
    return raw.replace(/_\d{10,}$/, '');
  }
  return raw;
}

export async function initiateMongikePayment(
  params: {
    orderId: string;
    amount: number;
    buyerPhone: string;
    feePayer?: 'MERCHANT' | 'CUSTOMER';
    collection?: 'orders' | 'rides';
  },
  dbAdmin?: any,
  opts?: {
    autoSimulateWebhook?: boolean;
    onSimulatedPaid?: (info: {
      targetId: string;
      targetType: 'orders' | 'rides';
      amount: number;
      gatewayRef: string;
    }) => Promise<any> | any;
  }
): Promise<MongikePaymentResult> {
  const { orderId, amount, buyerPhone, feePayer = 'MERCHANT', collection = 'orders' } = params;
  const cleanPhone = normalizePhoneForMongike(buyerPhone);
  const numericAmount = Math.max(0, Math.round(Number(amount) || 0));

  if (!orderId || numericAmount <= 0 || cleanPhone.length < 9) {
    return {
      status: 'error',
      message: 'Taarifa za malipo hazijakamilika (orderId, kiasi, au namba ya simu).',
      httpStatus: 400,
    };
  }

  const isLive = isMongikeLiveConfigured();
  const apiKey = String(process.env.MONGIKE_API_KEY || '').trim();

  if (!isLive) {
    const gatewayRef = `sim_ref_${Math.random().toString(36).substring(2, 12).toUpperCase()}`;
    const simulatedResponse: MongikePaymentResult = {
      status: 'success',
      message: 'Ombi la malipo limetumwa (Sandbox Mode)',
      sandbox: true,
      httpStatus: 201,
      data: {
        id: `sim_pay_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        order_id: orderId,
        gateway_ref: gatewayRef,
        amount: numericAmount,
        status: 'PENDING',
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
    };

    if (dbAdmin) {
      try {
        await dbAdmin.collection('payment_callbacks').doc(String(orderId)).set(
          cleanUndefined({
            order_id: orderId,
            targetCollection: collection,
            provider: 'mongike',
            mode: 'sandbox',
            status: 'PENDING',
            reference_id: gatewayRef,
            buyer_phone: cleanPhone,
            amount: numericAmount,
            updated_at: new Date().toISOString(),
          }),
          { merge: true }
        );
      } catch {}
    }

    if (opts?.autoSimulateWebhook !== false && dbAdmin && orderId) {
      setTimeout(async () => {
        try {
          await dbAdmin.collection(collection).doc(String(orderId)).update({
            paymentStatus: 'paid',
            updatedAt: new Date().toISOString(),
            gatewayRef,
          });
          await dbAdmin.collection('payment_callbacks').doc(String(orderId)).set(
            cleanUndefined({
              order_id: orderId,
              targetCollection: collection,
              provider: 'mongike',
              mode: 'sandbox',
              status: 'COMPLETED',
              reference_id: gatewayRef,
              amount: numericAmount,
              raw_payload: {
                order_id: orderId,
                status: 'COMPLETED',
                gateway_ref: gatewayRef,
                reference_id: gatewayRef,
                amount: numericAmount,
                is_simulated: true,
              },
              updated_at: new Date().toISOString(),
            }),
            { merge: true }
          );
            await settlePaidMongikeOrder(dbAdmin, {
              targetId: String(orderId),
              targetType: collection,
              amount: numericAmount,
              gatewayRef,
            }).catch((sErr) => {
              console.warn('[Mongike Sandbox] Wallet settlement warning:', sErr);
            });
            if (opts?.onSimulatedPaid) {
              await opts.onSimulatedPaid({
                targetId: String(orderId),
                targetType: collection,
                amount: numericAmount,
                gatewayRef,
              });
            }
          } catch (err) {
            console.warn('[Mongike Sandbox] Simulation callback warning:', err);
          }
        }, 2500);
    }

    return simulatedResponse;
  }

    try {
    const uniqueOrderId = `${orderId}-${Date.now()}`;
    console.log(
      `[Mongike Payment] Initiating live USSD push. Order: ${orderId} -> Ref: ${uniqueOrderId}, Phone: ${cleanPhone}, Amount: ${numericAmount}`
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    let response: Response;
    try {
      response = await fetch(MONGIKE_TANZANIA_MOMO_ENDPOINT, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: uniqueOrderId,
          amount: numericAmount,
          buyer_phone: cleanPhone,
          fee_payer: feePayer,
        }),
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

    if (!response.ok || String(data?.status || '').toLowerCase() === 'error') {
      const errMsg =
        data?.message ||
        data?.error?.message ||
        (typeof data?.error === 'string' ? data.error : '') ||
        data?.detail ||
        `Mongike API ilikataa ombi la malipo (HTTP ${response.status})`;
      console.error('[Mongike Payment] API error:', response.status, data);
      if (dbAdmin) {
        try {
          await Promise.allSettled([
            dbAdmin.collection(collection).doc(String(orderId)).set(
              cleanUndefined({
                gatewayOrderId: uniqueOrderId,
                paymentProvider: 'mongike',
                paymentPushStatus: 'failed',
                paymentError: errMsg,
                updatedAt: new Date().toISOString(),
              }),
              { merge: true }
            ),
            dbAdmin.collection('payment_callbacks').doc(String(orderId)).set(
              cleanUndefined({
                order_id: orderId,
                gateway_order_id: uniqueOrderId,
                targetCollection: collection,
                provider: 'mongike',
                mode: 'live',
                status: 'FAILED',
                http_status: response.status,
                error_message: errMsg,
                buyer_phone: cleanPhone,
                amount: numericAmount,
                raw_init_response: data,
                updated_at: new Date().toISOString(),
              }),
              { merge: true }
            ),
          ]);
        } catch {}
      }
      return {
        status: 'error',
        message: errMsg,
        sandbox: false,
        httpStatus: response.status || 400,
        error: data,
      };
    }

    const gatewayRef = data?.data?.gateway_ref || data?.data?.id || uniqueOrderId;

    if (dbAdmin) {
      try {
        await Promise.allSettled([
          dbAdmin.collection(collection).doc(String(orderId)).set(
            cleanUndefined({
              gatewayRef,
              gatewayOrderId: uniqueOrderId,
              paymentProvider: 'mongike',
              paymentPushStatus: 'sent',
              paymentError: null,
              updatedAt: new Date().toISOString(),
            }),
            { merge: true }
          ),
          dbAdmin.collection('payment_callbacks').doc(String(orderId)).set(
            cleanUndefined({
              order_id: orderId,
              gateway_order_id: uniqueOrderId,
              targetCollection: collection,
              provider: 'mongike',
              mode: 'live',
              status: data?.data?.status || 'PENDING',
              reference_id: gatewayRef,
              buyer_phone: cleanPhone,
              amount: numericAmount,
              raw_init_response: data,
              updated_at: new Date().toISOString(),
            }),
            { merge: true }
          ),
        ]);
      } catch {}
    }

    return {
      status: data?.status || 'success',
      message: data?.message || 'Ombi la malipo limetumwa kupitia Mongike',
      sandbox: false,
      httpStatus: 201,
      data: data?.data || {
        id: gatewayRef,
        order_id: uniqueOrderId,
        gateway_ref: gatewayRef,
        amount: numericAmount,
        status: 'PENDING',
      },
    };
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError';
    const failMsg = isAbort
      ? 'Muda wa kusubiri Mongike USSD Push umeisha (timeout). Tafadhali jaribu tena.'
      : 'Imeshindikana kuwasiliana na Mongike. Jaribu tena.';
    console.error('[Mongike Payment] Network failure:', err?.message || err);
    if (dbAdmin && orderId) {
      try {
        await Promise.allSettled([
          dbAdmin.collection(collection).doc(String(orderId)).set(
            cleanUndefined({
              paymentProvider: 'mongike',
              paymentPushStatus: 'failed',
              paymentError: failMsg,
              updatedAt: new Date().toISOString(),
            }),
            { merge: true }
          ),
          dbAdmin.collection('payment_callbacks').doc(String(orderId)).set(
            cleanUndefined({
              order_id: orderId,
              targetCollection: collection,
              provider: 'mongike',
              mode: 'live',
              status: 'FAILED',
              http_status: isAbort ? 504 : 500,
              error_message: err?.message || failMsg,
              buyer_phone: cleanPhone,
              amount: numericAmount,
              updated_at: new Date().toISOString(),
            }),
            { merge: true }
          ),
        ]);
      } catch {}
    }
    return {
      status: 'error',
      message: failMsg,
      sandbox: false,
      httpStatus: isAbort ? 504 : 500,
    };
  }
}

export async function checkMongikeOrderPaymentStatus(
  dbAdmin: any,
  params: { orderId: string; collection?: 'orders' | 'rides' }
): Promise<{
  state: 'paid' | 'pending' | 'failed';
  amount: number;
  gatewayRef?: string;
  errorMessage?: string;
  newWalletBalance?: number;
  sandbox?: boolean;
}> {
  const { orderId, collection = 'orders' } = params;
  if (!dbAdmin || !orderId) {
    return { state: 'pending', amount: 0 };
  }

  try {
    const [docSnap, cbSnap] = await Promise.all([
      dbAdmin.collection(collection).doc(String(orderId)).get().catch(() => null),
      dbAdmin.collection('payment_callbacks').doc(String(orderId)).get().catch(() => null),
    ]);

    const rec = docSnap?.exists ? docSnap.data() || {} : {};
    const cb = cbSnap?.exists ? cbSnap.data() || {} : {};
    const amount = Number(rec.totalAmount || rec.total || rec.fare || cb.amount || 0);
    const gatewayRef = String(rec.gatewayRef || cb.reference_id || '').trim() || undefined;
    const recPayStatus = String(rec.paymentStatus || '').trim().toLowerCase();
    const cbStatus = String(cb.status || '').trim().toUpperCase();

    if (
      recPayStatus === 'paid' ||
      ['COMPLETED', 'SUCCESS', 'PAID', 'SETTLED'].includes(cbStatus)
    ) {
      const settled = await settlePaidMongikeOrder(dbAdmin, {
        targetId: String(orderId),
        targetType: collection,
        amount,
        gatewayRef,
      }).catch(() => null);

      return {
        state: 'paid',
        amount,
        gatewayRef,
        newWalletBalance: settled?.newPayerBalance ?? rec.newWalletBalance,
        sandbox: cb.mode === 'sandbox',
      };
    }

    // In serverless environments (e.g. Vercel), the sandbox 2500ms timer may have been suspended after HTTP 200.
    // Complete sandbox transactions cleanly when the user taps "Hakiki Malipo" after 2 seconds.
    if (cb.mode === 'sandbox' && cbStatus === 'PENDING') {
      const updatedMs = Date.parse(String(cb.updated_at || '')) || 0;
      if (!updatedMs || Date.now() - updatedMs >= 1800) {
        await dbAdmin.collection(collection).doc(String(orderId)).set(
          cleanUndefined({
            paymentStatus: 'paid',
            updatedAt: new Date().toISOString(),
            gatewayRef: gatewayRef || null,
          }),
          { merge: true }
        );
        await dbAdmin.collection('payment_callbacks').doc(String(orderId)).set(
          cleanUndefined({
            order_id: orderId,
            targetCollection: collection,
            provider: 'mongike',
            mode: 'sandbox',
            status: 'COMPLETED',
            reference_id: gatewayRef,
            amount,
            updated_at: new Date().toISOString(),
          }),
          { merge: true }
        );
        const settled = await settlePaidMongikeOrder(dbAdmin, {
          targetId: String(orderId),
          targetType: collection,
          amount,
          gatewayRef,
        }).catch(() => null);

        return {
          state: 'paid',
          amount,
          gatewayRef,
          newWalletBalance: settled?.newPayerBalance,
          sandbox: true,
        };
      }
    }

    if (
      rec.paymentPushStatus === 'failed' ||
      ['FAILED', 'ERROR', 'CANCELLED', 'EXPIRED'].includes(cbStatus)
    ) {
      return {
        state: 'failed',
        amount,
        gatewayRef,
        errorMessage: String(rec.paymentError || cb.error_message || 'Ombi la malipo halikukamilika.'),
        sandbox: cb.mode === 'sandbox',
      };
    }

    return {
      state: 'pending',
      amount,
      gatewayRef,
      sandbox: cb.mode === 'sandbox',
    };
  } catch (err: any) {
    return {
      state: 'pending',
      amount: 0,
      errorMessage: err?.message,
    };
  }
}

export async function processMongikeWebhook(
  payload: any,
  dbAdmin?: any
): Promise<{
  realOrderId: string;
  targetType: 'orders' | 'rides';
  isPaid: boolean;
  amount: number;
  gatewayRef: string;
  normalizedStatus: string;
}> {
  const { order_id, status, reference_id, gateway_ref, amount } = payload || {};
  const rawOrderId = String(order_id || '').trim();
  let realOrderId = extractRealOrderIdFromMongikeRef(rawOrderId);
  const gatewayRef = String(gateway_ref || reference_id || '').trim();
  const normalizedStatus = String(status || '').trim().toUpperCase();
  const isPaid = ['COMPLETED', 'SUCCESS', 'PAID', 'SETTLED'].includes(normalizedStatus);
  const numericAmount = Number(amount || 0);

  let targetType: 'orders' | 'rides' = 'orders';

  if (dbAdmin && realOrderId) {
    try {
      // Check if it was mapped under payment_callbacks or belongs to `rides`
      const cbSnap = await dbAdmin.collection('payment_callbacks').doc(realOrderId).get().catch(() => null);
      if (cbSnap?.exists && cbSnap.data()?.targetCollection === 'rides') {
        targetType = 'rides';
      } else {
        const orderSnap = await dbAdmin.collection('orders').doc(realOrderId).get().catch(() => null);
        if (!orderSnap?.exists) {
          const rideSnap = await dbAdmin.collection('rides').doc(realOrderId).get().catch(() => null);
          if (rideSnap?.exists) {
            targetType = 'rides';
          }
        }
      }

      if (isPaid) {
        await dbAdmin.collection(targetType).doc(realOrderId).set(
          cleanUndefined({
            paymentStatus: 'paid',
            paymentProvider: 'mongike',
            updatedAt: new Date().toISOString(),
            gatewayRef: gatewayRef || null,
          }),
          { merge: true }
        );

        await settlePaidMongikeOrder(dbAdmin, {
          targetId: realOrderId,
          targetType,
          amount: numericAmount,
          gatewayRef,
        }).catch((sErr) => {
          console.warn('[Mongike Webhook] Wallet settlement warning:', sErr);
        });
      }

      await dbAdmin.collection('payment_callbacks').doc(realOrderId).set(
        cleanUndefined({
          order_id: realOrderId,
          gateway_order_id: rawOrderId || realOrderId,
          targetCollection: targetType,
          provider: 'mongike',
          status: normalizedStatus || 'SUCCESS',
          reference_id: gatewayRef,
          amount: numericAmount,
          raw_payload: payload,
          updated_at: new Date().toISOString(),
        }),
        { merge: true }
      );
    } catch (err) {
      console.warn('[Mongike Webhook] DB update warning:', err);
    }
  }

  return {
    realOrderId,
    targetType,
    isPaid,
    amount: numericAmount,
    gatewayRef,
    normalizedStatus: normalizedStatus || 'UNKNOWN',
  };
}
