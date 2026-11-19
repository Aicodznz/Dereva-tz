import { cleanUndefined } from './getFirestoreDb.js';

export function buildSettlementPhoneVariants(rawPhone?: string): {
  digits: string;
  phoneVariants: string[];
} {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits || digits.length < 7) {
    return { digits: '', phoneVariants: [] };
  }
  const last9 = digits.length >= 9 ? digits.slice(-9) : digits;
  const phoneVariants = Array.from(
    new Set([
      String(rawPhone || '').trim(),
      digits,
      `+${digits}`,
      `0${last9}`,
      `255${last9}`,
      `+255${last9}`,
      last9,
    ].filter(Boolean))
  );
  return { digits, phoneVariants };
}

export async function findOrEnsureWalletUser(
  dbAdmin: any,
  opts: { uid?: string; phone?: string; displayName?: string; createIfMissing?: boolean }
): Promise<{ uid: string; data: any } | null> {
  if (!dbAdmin) return null;

  if (opts.uid) {
    try {
      const snap = await dbAdmin.collection('users').doc(String(opts.uid)).get();
      if (snap?.exists) {
        return { uid: snap.id, data: snap.data() || {} };
      }
    } catch {}
  }

  const { digits, phoneVariants } = buildSettlementPhoneVariants(opts.phone);
  if (phoneVariants.length > 0) {
    for (const field of ['phone', 'phoneNumber', 'normalizedPhone']) {
      try {
        const qSnap = await dbAdmin
          .collection('users')
          .where(field, 'in', phoneVariants.slice(0, 10))
          .limit(1)
          .get();
        if (!qSnap.empty) {
          const docSnap = qSnap.docs[0];
          return { uid: docSnap.id, data: docSnap.data() || {} };
        }
      } catch {}
    }

    // Fallback check deterministic WhatsApp doc ID
    const waDocId = `meta-whatsapp-${digits}`;
    try {
      const waSnap = await dbAdmin.collection('users').doc(waDocId).get();
      if (waSnap?.exists) {
        return { uid: waSnap.id, data: waSnap.data() || {} };
      }
    } catch {}

    if (opts.createIfMissing && digits.length >= 9) {
      const fallbackDoc = cleanUndefined({
        uid: waDocId,
        displayName: opts.displayName || `Mteja ${digits.slice(-4)}`,
        fullName: opts.displayName || `Mteja ${digits.slice(-4)}`,
        phone: `+255${digits.slice(-9)}`,
        phoneNumber: `+255${digits.slice(-9)}`,
        normalizedPhone: `255${digits.slice(-9)}`,
        role: 'customer',
        status: 'active',
        walletBalance: 0,
        points: 0,
        source: 'whatsapp_papopay',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await dbAdmin.collection('users').doc(waDocId).set(fallbackDoc, { merge: true });
      return { uid: waDocId, data: fallbackDoc };
    }
  }

  return null;
}

export interface ResolvedPayeeTarget {
  kind: 'vendor' | 'driver' | 'bill';
  targetUid: string | null;
  vendorId: string | null;
  displayName: string;
  phone: string;
  subtitle: string;
}

export async function resolvePayeeTarget(
  dbAdmin: any,
  rawQuery: string
): Promise<ResolvedPayeeTarget> {
  const raw = String(rawQuery || '').trim();
  const cleanLower = raw.toLowerCase();
  const { digits, phoneVariants } = buildSettlementPhoneVariants(raw);

  if (!dbAdmin || !raw) {
    return {
      kind: 'bill',
      targetUid: null,
      vendorId: null,
      displayName: raw || 'Bili / Malipo',
      phone: '',
      subtitle: 'Bili ya Huduma',
    };
  }

  // 1. Check matching vendor by phone or name/id
  try {
    const vendorsSnap = await dbAdmin.collection('vendors').limit(80).get();
    for (const d of vendorsSnap.docs || []) {
      const v = d.data() || {};
      const vPhones = [
        v.phoneNumber,
        v.socialLinks?.whatsapp,
        v.ownerInfo?.whatsapp,
        v.ownerInfo?.phone,
      ]
        .filter(Boolean)
        .map((p: any) => String(p).replace(/\D/g, '').slice(-9));

      const phoneMatch = digits.length >= 9 && vPhones.includes(digits.slice(-9));
      const idMatch = d.id.toLowerCase() === cleanLower;
      const nameMatch =
        cleanLower.length >= 3 &&
        String(v.businessName || '').toLowerCase().includes(cleanLower);

      if (phoneMatch || idMatch || nameMatch) {
        const contactPhone =
          v.socialLinks?.whatsapp ||
          v.ownerInfo?.whatsapp ||
          v.phoneNumber ||
          v.ownerInfo?.phone ||
          '';
        return {
          kind: 'vendor',
          targetUid: v.ownerUid || d.id,
          vendorId: d.id,
          displayName: v.businessName || 'Mgahawa / Duka',
          phone: contactPhone,
          subtitle: `Biashara (${v.category || 'mgahawa'})`,
        };
      }
    }
  } catch {}

  // 2. Check matching driver/rider or user by phone, licensePlate, or displayName
  try {
    if (phoneVariants.length > 0) {
      for (const field of ['phone', 'phoneNumber', 'normalizedPhone']) {
        try {
          const uSnap = await dbAdmin
            .collection('users')
            .where(field, 'in', phoneVariants.slice(0, 10))
            .limit(3)
            .get();
          if (!uSnap.empty) {
            const matchedDoc = uSnap.docs[0];
            const u = matchedDoc.data() || {};
            const isDriver = u.role === 'rider' || u.role === 'driver' || Boolean(u.driverType);
            return {
              kind: isDriver ? 'driver' : 'vendor',
              targetUid: matchedDoc.id,
              vendorId: null,
              displayName: u.displayName || u.fullName || u.businessName || raw,
              phone: u.phoneNumber || u.phone || raw,
              subtitle: isDriver
                ? `Dereva (${u.driverType || 'taxi'}${u.licensePlate ? ` • ${u.licensePlate}` : ''})`
                : `Akaunti ya PapoPay`,
            };
          }
        } catch {}
      }
    }

    const usersSnap = await dbAdmin.collection('users').limit(100).get();
    for (const d of usersSnap.docs || []) {
      const u = d.data() || {};
      const name = String(u.displayName || u.fullName || '').toLowerCase();
      const plate = String(u.licensePlate || '').toLowerCase();
      if (
        cleanLower.length >= 3 &&
        ((name && name.includes(cleanLower)) || (plate && plate === cleanLower))
      ) {
        const isDriver = u.role === 'rider' || u.role === 'driver' || Boolean(u.driverType);
        return {
          kind: isDriver ? 'driver' : 'vendor',
          targetUid: d.id,
          vendorId: null,
          displayName: u.displayName || u.fullName || raw,
          phone: u.phoneNumber || u.phone || '',
          subtitle: isDriver
            ? `Dereva (${u.driverType || 'taxi'}${u.licensePlate ? ` • ${u.licensePlate}` : ''})`
            : `Akaunti ya PapoPay`,
        };
      }
    }
  } catch {}

  return {
    kind: 'bill',
    targetUid: null,
    vendorId: null,
    displayName: raw,
    phone: digits.length >= 9 ? `+255${digits.slice(-9)}` : '',
    subtitle: 'Bili / Mpokeaji Nje ya Orodha',
  };
}

export interface SettlementOutcome {
  settled: boolean;
  alreadySettled?: boolean;
  purpose: string;
  amount: number;
  payerUid?: string;
  payerPhone?: string;
  newPayerBalance?: number;
  payeeUid?: string;
  payeeName?: string;
  payeePhone?: string;
  payeeKind?: string;
}

const inFlightSettlements = new Set<string>();

/**
 * Settles wallet balances idempotently once a Mongike order is confirmed paid.
 * Safe to invoke from webhook, simulated timer, or notification hook.
 */
export async function settlePaidMongikeOrder(
  dbAdmin: any,
  params: { targetId: string; targetType?: 'orders' | 'rides'; amount?: number; gatewayRef?: string }
): Promise<SettlementOutcome | null> {
  const { targetId, targetType = 'orders', amount, gatewayRef } = params;
  if (!dbAdmin || !targetId) return null;

  const lockKey = `${targetType}:${targetId}`;
  if (inFlightSettlements.has(lockKey)) {
    return null;
  }
  inFlightSettlements.add(lockKey);

  try {
    const docSnap = await dbAdmin.collection(targetType).doc(String(targetId)).get().catch(() => null);
    if (!docSnap?.exists) return null;
    const rec = docSnap.data() || {};

    const purpose = String(rec.paymentPurpose || '');
    const paidAmount = Math.max(
      0,
      Math.round(Number(amount || rec.totalAmount || rec.total || rec.fare || 0))
    );

    if (rec.walletSettled === true) {
      return {
        settled: false,
        alreadySettled: true,
        purpose: purpose || 'standard',
        amount: paidAmount,
        payerUid: rec.payerUid,
        payerPhone: rec.customerPhone,
        newPayerBalance: rec.newWalletBalance,
        payeeUid: rec.payeeUid,
        payeeName: rec.payeeName,
        payeePhone: rec.payeePhone,
        payeeKind: rec.payeeKind,
      };
    }

    if (paidAmount <= 0) {
      return { settled: false, purpose: purpose || 'standard', amount: 0 };
    }

    // 1. WALLET TOP-UP (Deposit into PapoWallet)
    if (purpose === 'wallet_topup') {
      const userRec = await findOrEnsureWalletUser(dbAdmin, {
        uid: rec.payerUid,
        phone: rec.customerPhone || rec.customerInfo?.phone,
        displayName: rec.customerName || rec.customerInfo?.name,
        createIfMissing: true,
      });

      if (!userRec) {
        return { settled: false, purpose, amount: paidAmount };
      }

      const currentBal = Number(userRec.data?.walletBalance || 0);
      const currentPts = Number(userRec.data?.points || 0);
      const earnedPts = Math.floor(paidAmount / 1000) * 5;
      const newBalance = currentBal + paidAmount;

      await dbAdmin.collection('users').doc(userRec.uid).set(
        cleanUndefined({
          walletBalance: newBalance,
          points: currentPts + earnedPts,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );

      await dbAdmin.collection('payments').add(
        cleanUndefined({
          uid: userRec.uid,
          phone: rec.customerPhone || userRec.data?.phone || '',
          title: `Weka Pesa PapoWallet (${String(rec.paymentMethod || 'Mongike').toUpperCase()})`,
          subtitle: `MONGIKE USSD PUSH • COMPLETED`,
          amount: paidAmount,
          type: 'credit',
          category: 'topup',
          status: 'completed',
          refCode: gatewayRef || rec.bookingCode || targetId,
          orderId: targetId,
          createdAt: new Date().toISOString(),
          createdAtMs: Date.now(),
        })
      );

      await dbAdmin.collection(targetType).doc(String(targetId)).set(
        cleanUndefined({
          walletSettled: true,
          walletSettledAt: new Date().toISOString(),
          payerUid: userRec.uid,
          newWalletBalance: newBalance,
          status: 'completed',
          paymentStatus: 'paid',
          gatewayRef: gatewayRef || rec.gatewayRef || null,
        }),
        { merge: true }
      );

      return {
        settled: true,
        purpose,
        amount: paidAmount,
        payerUid: userRec.uid,
        payerPhone: rec.customerPhone || userRec.data?.phone || '',
        newPayerBalance: newBalance,
      };
    }

    // 2. PAPOPAY MERCHANT / DRIVER / BILL PAYMENT via Mongike
    if (purpose === 'pay_vendor' || purpose === 'pay_driver' || purpose === 'pay_bill') {
      const payeeUid = rec.payeeUid ? String(rec.payeeUid) : null;
      if (payeeUid) {
        const payeeSnap = await dbAdmin.collection('users').doc(payeeUid).get().catch(() => null);
        if (payeeSnap?.exists) {
          const payeeData = payeeSnap.data() || {};
          const payeeBal = Number(payeeData.walletBalance || 0);
          const nextPayeeBal = payeeBal + paidAmount;
          const prevEarnings = Number(payeeData.totalEarnings || 0);
          await dbAdmin.collection('users').doc(payeeUid).set(
            cleanUndefined({
              walletBalance: nextPayeeBal,
              ...(purpose === 'pay_driver' ? { totalEarnings: prevEarnings + paidAmount } : {}),
              updatedAt: new Date().toISOString(),
            }),
            { merge: true }
          );
        }

        await dbAdmin.collection('payments').add(
          cleanUndefined({
            uid: payeeUid,
            phone: rec.payeePhone || '',
            title: `Malipo Kutoka kwa ${rec.customerName || rec.customerPhone || 'Mteja'}`,
            subtitle: `PAPOPAY MONGIKE • COMPLETED`,
            amount: paidAmount,
            type: 'credit',
            category: purpose === 'pay_driver' ? 'service' : 'restaurant',
            status: 'completed',
            refCode: gatewayRef || rec.bookingCode || targetId,
            orderId: targetId,
            createdAt: new Date().toISOString(),
            createdAtMs: Date.now(),
          })
        );
      }

      if (rec.payerUid || rec.customerPhone) {
        const payerRec = await findOrEnsureWalletUser(dbAdmin, {
          uid: rec.payerUid,
          phone: rec.customerPhone,
          createIfMissing: false,
        });
        if (payerRec) {
          await dbAdmin.collection('payments').add(
            cleanUndefined({
              uid: payerRec.uid,
              phone: rec.customerPhone || '',
              title: `Malipo kwenda ${rec.payeeName || rec.deliveryAddress || 'PapoPay'}`,
              subtitle: `MONGIKE MOBILE MONEY • COMPLETED`,
              amount: paidAmount,
              type: 'debit',
              category: purpose === 'pay_driver' ? 'transit' : 'restaurant',
              status: 'completed',
              refCode: gatewayRef || rec.bookingCode || targetId,
              orderId: targetId,
              createdAt: new Date().toISOString(),
              createdAtMs: Date.now(),
            })
          );
        }
      }

      await dbAdmin.collection(targetType).doc(String(targetId)).set(
        cleanUndefined({
          walletSettled: true,
          walletSettledAt: new Date().toISOString(),
          status: 'completed',
          paymentStatus: 'paid',
          gatewayRef: gatewayRef || rec.gatewayRef || null,
        }),
        { merge: true }
      );

      return {
        settled: true,
        purpose,
        amount: paidAmount,
        payerUid: rec.payerUid,
        payerPhone: rec.customerPhone,
        payeeUid: payeeUid || undefined,
        payeeName: rec.payeeName || rec.deliveryAddress,
        payeePhone: rec.payeePhone,
        payeeKind: rec.payeeKind,
      };
    }

    return { settled: false, purpose: purpose || 'standard', amount: paidAmount };
  } catch (err) {
    console.warn('[PapoWallet Settlement] Error:', err);
    return null;
  } finally {
    inFlightSettlements.delete(lockKey);
  }
}

/**
 * Pays a driver, restaurant, or bill directly from payer's existing PapoWallet balance.
 */
export async function executeDirectPapoWalletPayment(
  dbAdmin: any,
  params: {
    payerUid: string;
    payerPhone: string;
    payerName: string;
    amount: number;
    payee: ResolvedPayeeTarget;
    bookingCode: string;
    orderId: string;
  }
): Promise<{
  ok: boolean;
  reason?: string;
  newPayerBalance?: number;
}> {
  const { payerUid, payerPhone, payerName, amount, payee, bookingCode, orderId } = params;
  if (!dbAdmin || !payerUid || amount <= 0) {
    return { ok: false, reason: 'Taarifa za muamala hazijakamilika.' };
  }

  const payerSnap = await dbAdmin.collection('users').doc(payerUid).get().catch(() => null);
  if (!payerSnap?.exists) {
    return { ok: false, reason: 'Akaunti ya PapoWallet haikupatikana.' };
  }
  const payerData = payerSnap.data() || {};
  const currentBal = Number(payerData.walletBalance || 0);
  if (currentBal < amount) {
    return {
      ok: false,
      reason: `Salio la PapoWallet halitoshi (Una TZS ${currentBal.toLocaleString()}, unahitaji TZS ${amount.toLocaleString()}).`,
    };
  }

  const nextPayerBal = currentBal - amount;
  await dbAdmin.collection('users').doc(payerUid).set(
    cleanUndefined({
      walletBalance: nextPayerBal,
      updatedAt: new Date().toISOString(),
    }),
    { merge: true }
  );

  // Credit payee if internal vendor/driver
  if (payee.targetUid && payee.targetUid !== payerUid) {
    const payeeSnap = await dbAdmin.collection('users').doc(payee.targetUid).get().catch(() => null);
    if (payeeSnap?.exists) {
      const pd = payeeSnap.data() || {};
      const nextPayeeBal = Number(pd.walletBalance || 0) + amount;
      await dbAdmin.collection('users').doc(payee.targetUid).set(
        cleanUndefined({
          walletBalance: nextPayeeBal,
          ...(payee.kind === 'driver' ? { totalEarnings: Number(pd.totalEarnings || 0) + amount } : {}),
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );
    }

    await dbAdmin.collection('payments').add(
      cleanUndefined({
        uid: payee.targetUid,
        phone: payee.phone || '',
        title: `Malipo ya PapoWallet kutoka ${payerName || payerPhone}`,
        subtitle: `PAPOWALLET INSTANT • COMPLETED`,
        amount,
        type: 'credit',
        category: payee.kind === 'driver' ? 'service' : 'restaurant',
        status: 'completed',
        refCode: bookingCode,
        orderId,
        createdAt: new Date().toISOString(),
        createdAtMs: Date.now(),
      })
    );
  }

  await dbAdmin.collection('payments').add(
    cleanUndefined({
      uid: payerUid,
      phone: payerPhone,
      title: `Malipo kwenda ${payee.displayName}`,
      subtitle: `PAPOWALLET INSTANT • COMPLETED`,
      amount,
      type: 'debit',
      category: payee.kind === 'driver' ? 'transit' : payee.kind === 'vendor' ? 'restaurant' : 'bill',
      status: 'completed',
      refCode: bookingCode,
      orderId,
      createdAt: new Date().toISOString(),
      createdAtMs: Date.now(),
    })
  );

  await dbAdmin.collection('orders').doc(orderId).set(
    cleanUndefined({
      paymentStatus: 'paid',
      paymentMethod: 'papowallet',
      paymentProvider: 'papowallet',
      walletSettled: true,
      walletSettledAt: new Date().toISOString(),
      status: 'completed',
      newWalletBalance: nextPayerBal,
      updatedAt: new Date().toISOString(),
    }),
    { merge: true }
  );

  return { ok: true, newPayerBalance: nextPayerBal };
}
