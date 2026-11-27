import { cleanUndefined } from '../_lib/getFirestoreDb.js';
import { initiateMongikePayment, PAPO_LIPA_NAMBA, PAPO_LIPA_NAMBA_NAME } from '../_lib/mongike.js';
import { notifyMongikePaymentPaidToWhatsApp, sendMetaOutboundMessage } from '../_lib/metaBot.js';
import {
  executeDirectPapoWalletPayment,
  findOrEnsureWalletUser,
  resolvePayeeTarget,
} from '../_lib/papoWalletSettlement.js';
import { verifyTransactionPinRecord } from '../_lib/userAuth.js';
import { markEnhancedPaymentLinkPaid } from '../_lib/whatsappFlows.js';

export interface PapoPayWhatsAppCheckoutInput {
  amount?: number | string;
  method?: string;
  buyerPhone?: string;
  payerName?: string;
  recipientName?: string;
  recipientPhone?: string;
  title?: string;
  purpose?: string;
  orderId?: string;
  referenceId?: string;
  pin?: string;
  shippingAddress?: string;
  transactionRef?: string;
}

const VALID_METHODS = new Set([
  'papowallet',
  'lipanamba',
  'mpesa',
  'tigopesa',
  'airtel',
  'halopesa',
  'card',
]);

const METHOD_LABELS: Record<string, string> = {
  papowallet: 'PapoPay Wallet',
  lipanamba: `Lipa Namba ${PAPO_LIPA_NAMBA} (${PAPO_LIPA_NAMBA_NAME})`,
  mpesa: 'M-Pesa (Vodacom)',
  tigopesa: 'Mixx by Yas',
  airtel: 'Airtel Money',
  halopesa: 'HaloPesa',
  card: 'PapoPay Mastercard / Visa',
};

function generateLukuToken(): string {
  const chunk = () => String(Math.floor(1000 + Math.random() * 9000));
  return `${chunk()}-${chunk()}-${chunk()}-${chunk()}-${chunk()}`;
}

export async function processPapoPayWhatsAppCheckout(
  dbAdmin: any,
  body: PapoPayWhatsAppCheckoutInput
): Promise<{ statusCode: number; payload: Record<string, any> }> {
  const amt = Math.round(Number(body?.amount || 0));
  if (!Number.isFinite(amt) || amt < 100 || amt > 50_000_000) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        error: 'Kiasi cha malipo lazima kiwe kati ya TZS 100 na TZS 50,000,000.',
      },
    };
  }

  const rawMethod = String(body?.method || 'papowallet').trim().toLowerCase();
  if (!VALID_METHODS.has(rawMethod)) {
    return {
      statusCode: 400,
      payload: { ok: false, error: 'Njia ya malipo iliyochaguliwa si sahihi.' },
    };
  }

  const buyerPhone = String(body?.buyerPhone || '').trim();
  const buyerDigits = buyerPhone.replace(/\D/g, '');
  if (buyerDigits.length < 9) {
    return {
      statusCode: 400,
      payload: { ok: false, error: 'Tafadhali weka namba sahihi ya simu ya mlipaji.' },
    };
  }

  if (!dbAdmin) {
    return {
      statusCode: 503,
      payload: { ok: false, error: 'Huduma ya kanzidata haipatikani kwa sasa.' },
    };
  }

  const payerName = String(body?.payerName || 'Mteja wa PapoPay').trim().slice(0, 80);
  const recipientName = String(body?.recipientName || 'PapoPay Merchant').trim().slice(0, 80);
  const recipientPhone = String(body?.recipientPhone || '').trim();
  const title = String(body?.title || `Malipo kwenda ${recipientName}`).trim().slice(0, 120);
  const purposeRaw = String(body?.purpose || 'pay_vendor').trim();
  const finalRef = String(body?.referenceId || `PP-${Math.floor(100000 + Math.random() * 899999)}`).trim();
  const shippingAddress = String(body?.shippingAddress || recipientName).trim().slice(0, 180);
  const methodLabel = METHOD_LABELS[rawMethod] || 'PapoPay';

  // Resolve target payee if phone or name was provided
  const payeeLookupQuery = recipientPhone || recipientName;
  const resolvedPayee = await resolvePayeeTarget(dbAdmin, payeeLookupQuery);
  if (recipientName && (!resolvedPayee.displayName || resolvedPayee.displayName === payeeLookupQuery)) {
    resolvedPayee.displayName = recipientName;
  }
  if (recipientPhone && !resolvedPayee.phone) {
    resolvedPayee.phone = recipientPhone;
  }

  const normalizedPurpose =
    purposeRaw === 'pay_driver' || resolvedPayee.kind === 'driver'
      ? 'pay_driver'
      : purposeRaw === 'pay_bill'
      ? 'pay_bill'
      : 'pay_vendor';

  // Ensure or locate order document
  let finalOrderId = String(body?.orderId || '').trim();
  const existingSnap = finalOrderId
    ? await dbAdmin.collection('orders').doc(finalOrderId).get().catch(() => null)
    : null;

  if (!existingSnap?.exists) {
    const newOrderRef = await dbAdmin.collection('orders').add(
      cleanUndefined({
        bookingCode: finalRef,
        vendorId: resolvedPayee.vendorId || 'papopay-express',
        vendorName: resolvedPayee.displayName || recipientName,
        service: 'PapoPay WhatsApp Checkout',
        items: [{ name: title, price: amt, quantity: 1 }],
        totalAmount: amt,
        total: amt,
        customerPhone: buyerPhone,
        customerName: payerName,
        deliveryAddress: shippingAddress,
        orderType: 'payment',
        paymentPurpose: normalizedPurpose,
        payeeUid: resolvedPayee.targetUid || null,
        payeeName: resolvedPayee.displayName || recipientName,
        payeePhone: resolvedPayee.phone || recipientPhone || '',
        payeeKind: resolvedPayee.kind || 'vendor',
        paymentMethod: rawMethod,
        paymentMethodLabel: methodLabel,
        paymentStatus: 'pending',
        status: 'pending',
        sourceChannel: 'whatsapp',
        createdAt: new Date().toISOString(),
        createdAtMs: Date.now(),
      })
    );
    finalOrderId = newOrderRef.id;
  }

  // Wallet / Card PIN-protected instant payment
  if (rawMethod === 'papowallet' || rawMethod === 'card') {
    const cleanPin = String(body?.pin || '').trim();
    if (!/^\d{4,6}$/.test(cleanPin)) {
      return {
        statusCode: 400,
        payload: { ok: false, error: 'Tafadhali weka PIN yako ya tarakimu 4–6 kuthibitisha malipo.' },
      };
    }

    const payerUser = await findOrEnsureWalletUser(dbAdmin, {
      phone: buyerPhone,
      displayName: payerName,
      createIfMissing: false,
    });

    if (!payerUser) {
      return {
        statusCode: 400,
        payload: {
          ok: false,
          error: `Akaunti ya PapoWallet kwa namba ${buyerPhone} haikupatikana. Weka pesa kwanza au tumia M-Pesa / Mixx by Yas.`,
        },
      };
    }

    if (rawMethod === 'card' && payerUser.data?.virtualCardFrozen) {
      return {
        statusCode: 403,
        payload: {
          ok: false,
          error: 'Virtual Mastercard yako imegandishwa. Ifungue kwenye PapoPay au tumia M-Pesa.',
        },
      };
    }

    const storedPin = payerUser.data?.walletPin ? String(payerUser.data.walletPin) : '';
    const hasHashedPin = Boolean(payerUser.data?.walletPinHash || storedPin);
    if (hasHashedPin) {
      const pinCheck = verifyTransactionPinRecord(payerUser.data, cleanPin);
      if (!pinCheck.ok) {
        return {
          statusCode: 401,
          payload: { ok: false, error: pinCheck.error || 'PIN ya PapoPay uliyoingiza si sahihi.' },
        };
      }
    }

    const execRes = await executeDirectPapoWalletPayment(dbAdmin, {
      payerUid: payerUser.uid,
      payerPhone: buyerPhone,
      payerName,
      amount: amt,
      payee: resolvedPayee,
      bookingCode: finalRef,
      orderId: finalOrderId,
    });

    if (!execRes.ok) {
      return {
        statusCode: 402,
        payload: { ok: false, error: execRes.reason || 'Salio halitoshi kukamilisha malipo.' },
      };
    }

    // Persist chosen PIN on first use & award cashback for bills
    const isBill = normalizedPurpose === 'pay_bill' || /luku|dawasa|azam|dstv|startimes|vocha/i.test(title);
    const lukuToken = /luku/i.test(title) ? generateLukuToken() : null;
    const cashbackPoints = isBill ? Math.max(10, Math.round(amt * 0.05)) : Math.max(5, Math.floor(amt / 1000) * 2);

    try {
      await dbAdmin.collection('users').doc(payerUser.uid).set(
        cleanUndefined({
          ...(storedPin ? {} : { walletPin: cleanPin }),
          points: Number(payerUser.data?.points || 0) + cashbackPoints,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );
      await dbAdmin.collection('orders').doc(finalOrderId).set(
        cleanUndefined({
          lukuToken,
          paymentMethod: rawMethod,
          paymentMethodLabel: methodLabel,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );
    } catch {}

    await markEnhancedPaymentLinkPaid(dbAdmin, finalRef, {
      status: 'paid',
      methodLabel,
      transactionRef: finalRef,
      orderId: finalOrderId,
    }).catch(() => {});

    // Notify recipient on WhatsApp when phone exists
    const targetNotifyDigits = (resolvedPayee.phone || recipientPhone || '').replace(/\D/g, '');
    if (targetNotifyDigits.length >= 9) {
      sendMetaOutboundMessage({
        channel: 'whatsapp',
        recipientId: targetNotifyDigits,
        text:
          `💰 *UMEPOKEA MALIPO YA PAPOPAY!*\n` +
          `🔖 Rejea: *#${finalRef}*\n\n` +
          `- Mteja: *${payerName}* (${buyerPhone})\n` +
          `- Huduma: *${title}*\n` +
          `- Kiasi: *TZS ${amt.toLocaleString()}/=*\n` +
          `- Njia: *${methodLabel}* ✅`,
      }).catch(() => {});
    }

    return {
      statusCode: 200,
      payload: {
        ok: true,
        status: 'paid',
        orderId: finalOrderId,
        referenceId: finalRef,
        refCode: finalRef,
        amount: amt,
        method: rawMethod,
        methodLabel,
        merchantName: resolvedPayee.displayName || recipientName,
        newBalance: Number(execRes.newPayerBalance || 0),
        cashbackPoints,
        token: lukuToken,
        paidAt: new Date().toISOString(),
      },
    };
  }

  // Lipa Namba 5656565 Manual Admin Confirmation Flow
  if (rawMethod === 'lipanamba') {
    const cleanTxRef = String(body?.transactionRef || '').trim().slice(0, 80);
    await dbAdmin.collection('orders').doc(finalOrderId).set(
      cleanUndefined({
        paymentMethod: 'lipanamba',
        paymentMethodLabel: methodLabel,
        lipaNambaNumber: PAPO_LIPA_NAMBA,
        lipaNambaName: PAPO_LIPA_NAMBA_NAME,
        lipaNambaRef: cleanTxRef || null,
        customerReportedPaid: true,
        paymentPushStatus: 'awaiting_admin_confirm',
        paymentError: null,
        paymentStatus: 'pending',
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );

    await dbAdmin.collection('notifications').add({
      type: 'lipa_namba_confirm',
      title: `Lipa Namba ${PAPO_LIPA_NAMBA}: TZS ${amt.toLocaleString()} (#${finalRef})`,
      message: `${payerName} (${buyerPhone}) ametuma taarifa za kulipa TZS ${amt.toLocaleString()}/= kwenda Lipa Namba ${PAPO_LIPA_NAMBA}.${cleanTxRef ? ` Kumbukumbu: ${cleanTxRef}` : ''}`,
      orderId: finalOrderId,
      bookingCode: finalRef,
      amount: amt,
      customerPhone: buyerPhone,
      lipaNambaRef: cleanTxRef || null,
      read: false,
      createdAt: new Date().toISOString(),
    }).catch(() => {});

    return {
      statusCode: 200,
      payload: {
        ok: true,
        status: 'pending_admin_confirm',
        orderId: finalOrderId,
        referenceId: finalRef,
        refCode: finalRef,
        amount: amt,
        method: 'lipanamba',
        methodLabel,
        lipaNambaNumber: PAPO_LIPA_NAMBA,
        lipaNambaName: PAPO_LIPA_NAMBA_NAME,
        transactionRef: cleanTxRef || null,
        merchantName: resolvedPayee.displayName || recipientName,
        message: `Taarifa ya malipo ya Lipa Namba ${PAPO_LIPA_NAMBA} (${PAPO_LIPA_NAMBA_NAME}) imepokelewa! Admin anahakiki na utapokea risiti WhatsApp punde.`,
      },
    };
  }

  // Mobile Money Push via Mongike
  const mRes = await initiateMongikePayment(
    {
      orderId: finalOrderId,
      amount: amt,
      buyerPhone,
      feePayer: 'MERCHANT',
      collection: 'orders',
    },
    dbAdmin,
    {
      autoSimulateWebhook: true,
      onSimulatedPaid: (info) => notifyMongikePaymentPaidToWhatsApp(info, dbAdmin),
    }
  );

  if (mRes.status === 'error') {
    return {
      statusCode: mRes.httpStatus || 500,
      payload: {
        ok: false,
        error: mRes.message || 'Imeshindikana kutuma ombi la Malipo kwa Simu.',
      },
    };
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      status: 'pending',
      orderId: finalOrderId,
      referenceId: finalRef,
      refCode: finalRef,
      amount: amt,
      method: rawMethod,
      methodLabel,
      merchantName: resolvedPayee.displayName || recipientName,
      sandbox: mRes.sandbox,
      message: `Ombi la ${methodLabel} la TZS ${amt.toLocaleString()}/= limetumwa kwenye namba ${buyerPhone}.`,
    },
  };
}
