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

  const candidates = new Map<string, any>();

  if (opts.uid) {
    try {
      const snap = await dbAdmin.collection('users').doc(String(opts.uid)).get();
      if (snap?.exists) {
        candidates.set(snap.id, snap.data() || {});
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
          .limit(5)
          .get();
        for (const docSnap of qSnap.docs || []) {
          if (!candidates.has(docSnap.id)) {
            candidates.set(docSnap.id, docSnap.data() || {});
          }
        }
      } catch {}
    }

    const last9 = digits.length >= 9 ? digits.slice(-9) : digits;
    const deterministicIds = Array.from(
      new Set(
        [
          `meta-whatsapp-${digits}`,
          last9 ? `meta-whatsapp-255${last9}` : '',
          last9 ? `meta-whatsapp-0${last9}` : '',
          last9 ? `web-255${last9}` : '',
          last9 ? `web-0${last9}` : '',
        ].filter(Boolean)
      )
    );
    for (const waDocId of deterministicIds) {
      if (candidates.has(waDocId)) continue;
      try {
        const waSnap = await dbAdmin.collection('users').doc(waDocId).get();
        if (waSnap?.exists) {
          candidates.set(waSnap.id, waSnap.data() || {});
        }
      } catch {}
    }
  }

  if (candidates.size > 0) {
    const ranked = Array.from(candidates.entries()).sort((a, b) => {
      const [idA, dataA] = a;
      const [idB, dataB] = b;
      const balA = Number(dataA?.walletBalance || 0);
      const balB = Number(dataB?.walletBalance || 0);
      if (balA !== balB) return balB - balA;
      const isStubA = idA.startsWith('meta-whatsapp-') || idA.startsWith('web-');
      const isStubB = idB.startsWith('meta-whatsapp-') || idB.startsWith('web-');
      if (isStubA !== isStubB) return isStubA ? 1 : -1;
      const ptsA = Number(dataA?.points || 0);
      const ptsB = Number(dataB?.points || 0);
      return ptsB - ptsA;
    });
    return { uid: ranked[0][0], data: ranked[0][1] };
  }

  if (phoneVariants.length > 0 && opts.createIfMissing && digits.length >= 9) {
    const last9 = digits.slice(-9);
    const waDocId = `meta-whatsapp-${digits}`;
    const fallbackDoc = cleanUndefined({
      uid: waDocId,
      displayName: opts.displayName || `Mteja ${digits.slice(-4)}`,
      fullName: opts.displayName || `Mteja ${digits.slice(-4)}`,
      phone: `+255${last9}`,
      phoneNumber: `+255${last9}`,
      normalizedPhone: `255${last9}`,
      walletId: `PP${digits.slice(-7)}`,
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

/**
 * Resolves a P2P recipient by phone number, 9-digit PapoPay Wallet ID, or name.
 */
export async function resolveP2PRecipient(
  dbAdmin: any,
  rawRecipient: string
): Promise<{
  uid: string | null;
  displayName: string;
  phone: string;
  walletId?: string;
}> {
  const clean = String(rawRecipient || '').trim();
  const { digits, phoneVariants } = buildSettlementPhoneVariants(clean);

  if (dbAdmin && clean) {
    const queryLast9 = digits.length >= 9 ? digits.slice(-9) : '';
    // 1. Try matching existing user by phone
    if (phoneVariants.length > 0) {
      for (const field of ['phone', 'phoneNumber', 'normalizedPhone']) {
        try {
          const snap = await dbAdmin
            .collection('users')
            .where(field, 'in', phoneVariants.slice(0, 10))
            .limit(5)
            .get();
          if (!snap.empty) {
            const docs = snap.docs || [];
            const exactDoc =
              docs.find((docItem: any) => {
                const u = docItem.data() || {};
                const primaryLast9 = String(u.phoneNumber || u.phone || '').replace(/\D/g, '').slice(-9);
                return queryLast9 && primaryLast9 === queryLast9;
              }) || docs[0];
            const d = exactDoc.data() || {};
            const docPhoneRaw = String(d.phoneNumber || d.phone || '').trim();
            const docLast9 = docPhoneRaw.replace(/\D/g, '').slice(-9);
            const canonicalPhone =
              queryLast9 && docLast9 !== queryLast9
                ? `+255${queryLast9}`
                : docPhoneRaw || (queryLast9 ? `+255${queryLast9}` : clean);
            return {
              uid: exactDoc.id,
              displayName: d.displayName || d.fullName || d.name || clean,
              phone: canonicalPhone,
              walletId: d.walletId || undefined,
            };
          }
        } catch {}
      }
    }

    // 2. Try matching by walletId (e.g. 118504625)
    const compact = clean.replace(/\s+/g, '');
    if (compact.length >= 6) {
      try {
        const wSnap = await dbAdmin
          .collection('users')
          .where('walletId', '==', compact)
          .limit(1)
          .get();
        if (!wSnap.empty) {
          const docSnap = wSnap.docs[0];
          const d = docSnap.data() || {};
          return {
            uid: docSnap.id,
            displayName: d.displayName || d.fullName || d.name || `Wallet ${compact}`,
            phone: d.phoneNumber || d.phone || '',
            walletId: compact,
          };
        }
      } catch {}
    }

    // 3. Fallback create/ensure wallet account when a valid phone number is provided
    if (digits.length >= 9) {
      const ensured = await findOrEnsureWalletUser(dbAdmin, {
        phone: `+255${digits.slice(-9)}`,
        displayName: `Mteja ${digits.slice(-4)}`,
        createIfMissing: true,
      });
      if (ensured) {
        return {
          uid: ensured.uid,
          displayName: ensured.data?.displayName || `Mteja ${digits.slice(-4)}`,
          phone: ensured.data?.phone || `+255${digits.slice(-9)}`,
          walletId: ensured.data?.walletId,
        };
      }
    }
  }

  return {
    uid: null,
    displayName: clean,
    phone: digits.length >= 9 ? `+255${digits.slice(-9)}` : '',
  };
}

/**
 * Atomic P2P PapoWallet Transfer (0% fee). Debits sender and credits recipient.
 */
export async function executePapoWalletTransfer(
  dbAdmin: any,
  params: {
    payerUid?: string;
    payerPhone: string;
    payerName: string;
    recipientQuery: string;
    amount: number;
    note?: string;
  }
): Promise<{
  ok: boolean;
  reason?: string;
  refCode?: string;
  newPayerBalance?: number;
  recipient?: { uid: string | null; displayName: string; phone: string };
}> {
  const amt = Math.round(Number(params.amount || 0));
  if (!dbAdmin || !Number.isFinite(amt) || amt < 100) {
    return { ok: false, reason: 'Kiasi cha chini cha kutuma ni TZS 100.' };
  }

  const payer = await findOrEnsureWalletUser(dbAdmin, {
    uid: params.payerUid,
    phone: params.payerPhone,
    displayName: params.payerName,
    createIfMissing: false,
  });
  if (!payer) {
    return {
      ok: false,
      reason: 'Akaunti yako ya PapoWallet haijawekewa pesa bado. Weka pesa kwanza kupitia Mongike Push.',
    };
  }

  const recipient = await resolveP2PRecipient(dbAdmin, params.recipientQuery);
  if (!recipient.uid && !recipient.phone) {
    return {
      ok: false,
      reason: 'Hatukuweza kutambua namba ya simu au Wallet ID ya mpokeaji.',
    };
  }
  if (recipient.uid && recipient.uid === payer.uid) {
    return { ok: false, reason: 'Huwezi kujitumia pesa kwako mwenyewe.' };
  }

  const refCode = `PAPO-TRF-${Math.floor(100000 + Math.random() * 900000)}`;
  const nowIso = new Date().toISOString();
  const noteText = String(params.note || 'P2P PapoWallet').trim().slice(0, 120);

  let nextPayerBal = 0;
  try {
    if (typeof dbAdmin.runTransaction === 'function') {
      await dbAdmin.runTransaction(async (tx: any) => {
        const payerRef = dbAdmin.collection('users').doc(payer.uid);
        const recRef = recipient.uid ? dbAdmin.collection('users').doc(recipient.uid) : null;
        const pSnap = await tx.get(payerRef);
        const rSnap = recRef ? await tx.get(recRef) : null;
        const curBal = Number(pSnap.data()?.walletBalance || 0);
        if (curBal < amt) {
          throw new Error(`INSUFFICIENT:${curBal}`);
        }
        nextPayerBal = curBal - amt;
        tx.set(payerRef, { walletBalance: nextPayerBal, updatedAt: nowIso }, { merge: true });

        if (recRef && rSnap) {
          const recBal = Number(rSnap.exists ? rSnap.data()?.walletBalance || 0 : 0);
          tx.set(recRef, { walletBalance: recBal + amt, updatedAt: nowIso }, { merge: true });
        }
      });
    } else {
      const curBal = Number(payer.data?.walletBalance || 0);
      if (curBal < amt) {
        return {
          ok: false,
          reason: `Salio la PapoWallet halitoshi (Una TZS ${curBal.toLocaleString()}, unahitaji TZS ${amt.toLocaleString()}).`,
        };
      }
      nextPayerBal = curBal - amt;
      await dbAdmin.collection('users').doc(payer.uid).set(
        { walletBalance: nextPayerBal, updatedAt: nowIso },
        { merge: true }
      );
      if (recipient.uid) {
        const recSnap = await dbAdmin.collection('users').doc(recipient.uid).get().catch(() => null);
        const recBal = Number(recSnap?.exists ? recSnap.data()?.walletBalance || 0 : 0);
        await dbAdmin.collection('users').doc(recipient.uid).set(
          { walletBalance: recBal + amt, updatedAt: nowIso },
          { merge: true }
        );
      }
    }
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.startsWith('INSUFFICIENT:')) {
      const bal = Number(msg.split(':')[1] || 0);
      return {
        ok: false,
        reason: `Salio la PapoWallet halitoshi (Una TZS ${bal.toLocaleString()}, unahitaji TZS ${amt.toLocaleString()}).`,
      };
    }
    return { ok: false, reason: 'Hitilafu ya mfumo wakati wa kutuma pesa.' };
  }

  await dbAdmin.collection('payments').add(
    cleanUndefined({
      uid: payer.uid,
      phone: params.payerPhone,
      title: `Tuma Pesa kwa ${recipient.displayName}`,
      subtitle: `PAPO-TO-PAPO (0% ADA) • ${noteText}`,
      amount: amt,
      type: 'debit',
      category: 'transfer',
      status: 'completed',
      refCode,
      createdAt: nowIso,
      createdAtMs: Date.now(),
    })
  );

  if (recipient.uid) {
    await dbAdmin.collection('payments').add(
      cleanUndefined({
        uid: recipient.uid,
        phone: recipient.phone || '',
        title: `Umepokea Pesa kutoka ${params.payerName || params.payerPhone}`,
        subtitle: `PAPO-TO-PAPO (0% ADA) • ${noteText}`,
        amount: amt,
        type: 'credit',
        category: 'transfer',
        status: 'completed',
        refCode,
        createdAt: nowIso,
        createdAtMs: Date.now(),
      })
    );
  }

  return {
    ok: true,
    refCode,
    newPayerBalance: nextPayerBal,
    recipient: {
      uid: recipient.uid,
      displayName: recipient.displayName,
      phone: recipient.phone,
    },
  };
}

/**
 * Generates a Wakala cash-out code (0.2% fee) and atomically deducts from PapoWallet.
 */
export async function executePapoWalletWithdrawal(
  dbAdmin: any,
  params: {
    payerUid?: string;
    phone: string;
    displayName: string;
    amount: number;
    agentName?: string;
  }
): Promise<{
  ok: boolean;
  reason?: string;
  withdrawCode?: string;
  fee?: number;
  totalDebit?: number;
  newBalance?: number;
  refCode?: string;
}> {
  const amt = Math.round(Number(params.amount || 0));
  if (!dbAdmin || !Number.isFinite(amt) || amt < 1000) {
    return { ok: false, reason: 'Kiasi cha chini cha kutoa kwa Wakala ni TZS 1,000.' };
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
  const withdrawCode = String(Math.floor(100000 + Math.random() * 900000));
  const refCode = `WTH-${withdrawCode}`;
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
    return { ok: false, reason: 'Imeshindwa kuanzisha muamala wa kutoa pesa.' };
  }

  await dbAdmin.collection('payments').add(
    cleanUndefined({
      uid: userRec.uid,
      phone: params.phone,
      title: `Toa Pesa kwa Wakala (${params.agentName || 'PapoPay Wakala'})`,
      subtitle: `MSIMBO: ${withdrawCode} • Ada 0.2% (TZS ${fee.toLocaleString()})`,
      amount: totalDebit,
      type: 'debit',
      category: 'withdraw',
      status: 'completed',
      refCode,
      withdrawCode,
      createdAt: nowIso,
      createdAtMs: Date.now(),
    })
  );

  return { ok: true, withdrawCode, fee, totalDebit, newBalance, refCode };
}

/**
 * Fetches PapoWallet balance, PapoPoints, card state, and latest ledger transactions.
 */
export async function getPapoWalletSummaryAndStatement(
  dbAdmin: any,
  phone: string,
  uid?: string
): Promise<{
  found: boolean;
  uid?: string;
  walletId: string;
  walletBalance: number;
  points: number;
  isCardFrozen: boolean;
  displayName?: string;
  phone?: string;
  transactions: Array<{
    id: string;
    title: string;
    subtitle: string;
    amount: number;
    type: 'credit' | 'debit';
    refCode: string;
    createdAtMs: number;
  }>;
}> {
  const digits = String(phone || '').replace(/\D/g, '');
  const userRec =
    phone || uid
      ? await findOrEnsureWalletUser(dbAdmin, { phone, uid, createIfMissing: false })
      : null;

  if (!userRec || !dbAdmin) {
    return {
      found: false,
      walletId: digits.length >= 9 ? `PP${digits.slice(-7)}` : '',
      walletBalance: 0,
      points: 0,
      isCardFrozen: false,
      displayName: undefined,
      phone: digits.length >= 9 ? `+255${digits.slice(-9)}` : undefined,
      transactions: [],
    };
  }

  let txs: any[] = [];
  try {
    const pSnap = await dbAdmin
      .collection('payments')
      .where('uid', '==', userRec.uid)
      .limit(25)
      .get();
    txs = (pSnap.docs || [])
      .map((d: any) => {
        const p = d.data() || {};
        const ms =
          Number(p.createdAtMs || 0) ||
          (typeof p.createdAt?.toMillis === 'function'
            ? p.createdAt.toMillis()
            : Date.parse(String(p.createdAt || '')) || 0);
        return {
          id: d.id,
          title: String(p.title || 'Muamala wa PapoPay'),
          subtitle: String(p.subtitle || ''),
          amount: Number(p.amount || 0),
          type: (p.type === 'debit' ? 'debit' : 'credit') as 'credit' | 'debit',
          refCode: String(p.refCode || d.id.slice(-8).toUpperCase()),
          createdAtMs: ms,
        };
      })
      .sort((a: any, b: any) => b.createdAtMs - a.createdAtMs)
      .slice(0, 8);
  } catch {}

  const userPhoneDigits = String(
    userRec.data?.phoneNumber || userRec.data?.phone || phone || ''
  ).replace(/\D/g, '');
  const idSourceDigits = userPhoneDigits.length >= 9 ? userPhoneDigits : digits;
  const derivedWalletId =
    userRec.data?.walletId ||
    (idSourceDigits.length >= 9
      ? `PP${idSourceDigits.slice(-7)}`
      : `PP${userRec.uid.slice(-7).toUpperCase()}`);

  return {
    found: true,
    uid: userRec.uid,
    walletId: derivedWalletId,
    walletBalance: Number(userRec.data?.walletBalance || 0),
    points: Number(userRec.data?.points || 0),
    isCardFrozen: Boolean(userRec.data?.virtualCardFrozen),
    displayName: userRec.data?.displayName || userRec.data?.fullName || undefined,
    phone:
      userRec.data?.phoneNumber ||
      userRec.data?.phone ||
      (idSourceDigits.length >= 9 ? `+255${idSourceDigits.slice(-9)}` : undefined),
    transactions: txs,
  };
}

/**
 * Freezes or unfreezes user's PapoPay Virtual Mastercard.
 */
export async function toggleVirtualMastercardFreeze(
  dbAdmin: any,
  phone: string,
  freeze: boolean
): Promise<{ ok: boolean; isCardFrozen: boolean }> {
  const userRec = await findOrEnsureWalletUser(dbAdmin, { phone, createIfMissing: true });
  if (!userRec || !dbAdmin) return { ok: false, isCardFrozen: freeze };
  await dbAdmin.collection('users').doc(userRec.uid).set(
    { virtualCardFrozen: freeze, updatedAt: new Date().toISOString() },
    { merge: true }
  );
  return { ok: true, isCardFrozen: freeze };
}

/**
 * Tops up a Student NFC Card from parent's PapoWallet.
 */
export async function topUpStudentNfcCardFromWallet(
  dbAdmin: any,
  params: {
    phone: string;
    studentNameOrCard: string;
    amount: number;
  }
): Promise<{
  ok: boolean;
  reason?: string;
  studentName?: string;
  cardNumber?: string;
  newWalletBalance?: number;
  refCode?: string;
}> {
  const amt = Math.round(Number(params.amount || 0));
  if (!dbAdmin || !Number.isFinite(amt) || amt < 500) {
    return { ok: false, reason: 'Kiasi cha chini cha kuongeza kadi ya mwanafunzi ni TZS 500.' };
  }

  const userRec = await findOrEnsureWalletUser(dbAdmin, { phone: params.phone, createIfMissing: false });
  if (!userRec) {
    return { ok: false, reason: 'Akaunti ya PapoWallet haikupatikana. Weka salio kwanza.' };
  }

  const refCode = `STD-${Math.floor(100000 + Math.random() * 900000)}`;
  const nowIso = new Date().toISOString();
  let newWalletBalance = 0;

  try {
    if (typeof dbAdmin.runTransaction === 'function') {
      await dbAdmin.runTransaction(async (tx: any) => {
        const ref = dbAdmin.collection('users').doc(userRec.uid);
        const snap = await tx.get(ref);
        const curBal = Number(snap.data()?.walletBalance || 0);
        if (curBal < amt) {
          throw new Error(`INSUFFICIENT:${curBal}`);
        }
        newWalletBalance = curBal - amt;
        const existingCards: any[] = Array.isArray(snap.data()?.studentCards) ? snap.data().studentCards : [];
        const needle = params.studentNameOrCard.trim().toLowerCase();
        let matched = false;
        const updatedCards = existingCards.map((c: any) => {
          if (
            !matched &&
            (String(c.cardNumber || '').toLowerCase().includes(needle) ||
              String(c.studentName || '').toLowerCase().includes(needle))
          ) {
            matched = true;
            return { ...c, balance: Number(c.balance || 0) + amt };
          }
          return c;
        });
        if (!matched) {
          updatedCards.push({
            id: `std_${Date.now()}`,
            studentName: params.studentNameOrCard.trim(),
            cardNumber: /^TZ-STD-/i.test(params.studentNameOrCard.trim())
              ? params.studentNameOrCard.trim().toUpperCase()
              : `TZ-STD-${Math.floor(10000 + Math.random() * 89999)}`,
            balance: amt,
          });
        }
        tx.set(ref, { walletBalance: newWalletBalance, studentCards: updatedCards, updatedAt: nowIso }, { merge: true });
      });
    } else {
      const curBal = Number(userRec.data?.walletBalance || 0);
      if (curBal < amt) {
        return { ok: false, reason: `Salio la PapoWallet halitoshi (Una TZS ${curBal.toLocaleString()}).` };
      }
      newWalletBalance = curBal - amt;
      await dbAdmin.collection('users').doc(userRec.uid).set(
        { walletBalance: newWalletBalance, updatedAt: nowIso },
        { merge: true }
      );
    }
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.startsWith('INSUFFICIENT:')) {
      const bal = Number(msg.split(':')[1] || 0);
      return { ok: false, reason: `Salio la PapoWallet halitoshi (Una TZS ${bal.toLocaleString()}).` };
    }
    return { ok: false, reason: 'Hitilafu wakati wa kuongeza salio la kadi.' };
  }

  await dbAdmin.collection('payments').add(
    cleanUndefined({
      uid: userRec.uid,
      phone: params.phone,
      title: `Salio Kadi ya Mwanafunzi (${params.studentNameOrCard})`,
      subtitle: `STUDENT NFC CARD • COMPLETED`,
      amount: amt,
      type: 'debit',
      category: 'student',
      status: 'completed',
      refCode,
      createdAt: nowIso,
      createdAtMs: Date.now(),
    })
  );

  return {
    ok: true,
    studentName: params.studentNameOrCard.trim(),
    cardNumber: refCode,
    newWalletBalance,
    refCode,
  };
}

export interface BulkTransferItemInput {
  recipientQuery: string;
  amount: number;
  note?: string;
}

export interface BulkTransferResolvedItem {
  uid: string | null;
  displayName: string;
  phone: string;
  walletId?: string;
  amount: number;
}

/**
 * Atomic Multi-Recipient (Bulk) PapoWallet P2P Transfer (0% fee).
 * Validates all recipients, verifies full batch balance inside one transaction,
 * deducts total once from sender, and credits every recipient atomically.
 */
export async function executePapoWalletBulkTransfer(
  dbAdmin: any,
  params: {
    payerUid?: string;
    payerPhone: string;
    payerName: string;
    items: BulkTransferItemInput[];
    note?: string;
  }
): Promise<{
  ok: boolean;
  reason?: string;
  batchRefCode?: string;
  totalAmount?: number;
  newPayerBalance?: number;
  recipients?: BulkTransferResolvedItem[];
}> {
  const rawItems = Array.isArray(params.items) ? params.items : [];
  if (!dbAdmin || rawItems.length === 0) {
    return { ok: false, reason: 'Hakuna mpokeaji yeyote aliyechaguliwa.' };
  }
  if (rawItems.length > 20) {
    return { ok: false, reason: 'Kikomo cha kutuma kwa pamoja ni wapokeaji 20 kwa mkupuo mmoja.' };
  }

  const normalizedItems = rawItems.map((it) => ({
    recipientQuery: String(it.recipientQuery || '').trim(),
    amount: Math.round(Number(it.amount || 0)),
  }));

  for (const it of normalizedItems) {
    if (!it.recipientQuery) {
      return { ok: false, reason: 'Kuna namba ya mpokeaji isiyo sahihi.' };
    }
    if (!Number.isFinite(it.amount) || it.amount < 100) {
      return {
        ok: false,
        reason: `Kiasi cha chini kwa kila mpokeaji (${it.recipientQuery}) ni TZS 100.`,
      };
    }
  }

  const payer = await findOrEnsureWalletUser(dbAdmin, {
    uid: params.payerUid,
    phone: params.payerPhone,
    displayName: params.payerName,
    createIfMissing: false,
  });
  if (!payer) {
    return {
      ok: false,
      reason: 'Akaunti yako ya PapoWallet haijawekewa pesa bado. Weka pesa kwanza kupitia Mongike Push.',
    };
  }

  const resolved: BulkTransferResolvedItem[] = [];
  for (const it of normalizedItems) {
    const rec = await resolveP2PRecipient(dbAdmin, it.recipientQuery);
    if (!rec.uid && !rec.phone) {
      return {
        ok: false,
        reason: `Hatukuweza kutambua namba ya simu au Wallet ID: ${it.recipientQuery}`,
      };
    }
    if (rec.uid && rec.uid === payer.uid) {
      return {
        ok: false,
        reason: `Huwezi kujumuisha namba yako mwenyewe (${it.recipientQuery}) katika malipo ya wengi.`,
      };
    }
    resolved.push({
      uid: rec.uid,
      displayName: rec.displayName,
      phone: rec.phone,
      walletId: rec.walletId,
      amount: it.amount,
    });
  }

  const totalAmount = resolved.reduce((sum, r) => sum + r.amount, 0);
  const batchRefCode = `PAPO-BULK-${Math.floor(100000 + Math.random() * 900000)}`;
  const nowIso = new Date().toISOString();
  const noteText = String(params.note || 'Bulk P2P PapoWallet').trim().slice(0, 120);
  let nextPayerBal = 0;

  const creditByUid = new Map<string, number>();
  for (const r of resolved) {
    if (r.uid) {
      creditByUid.set(r.uid, (creditByUid.get(r.uid) || 0) + r.amount);
    }
  }

  try {
    if (typeof dbAdmin.runTransaction === 'function') {
      await dbAdmin.runTransaction(async (tx: any) => {
        const payerRef = dbAdmin.collection('users').doc(payer.uid);
        const pSnap = await tx.get(payerRef);
        const curBal = Number(pSnap.data()?.walletBalance || 0);
        if (curBal < totalAmount) {
          throw new Error(`INSUFFICIENT:${curBal}`);
        }

        // Perform all recipient reads before any writes (Firestore transaction requirement)
        const recEntries = Array.from(creditByUid.entries());
        const recSnaps = await Promise.all(
          recEntries.map(([uid]) => tx.get(dbAdmin.collection('users').doc(uid)))
        );

        nextPayerBal = curBal - totalAmount;
        tx.set(payerRef, { walletBalance: nextPayerBal, updatedAt: nowIso }, { merge: true });

        recEntries.forEach(([uid, addAmt], idx) => {
          const rSnap = recSnaps[idx];
          const recBal = Number(rSnap?.exists ? rSnap.data()?.walletBalance || 0 : 0);
          tx.set(
            dbAdmin.collection('users').doc(uid),
            { walletBalance: recBal + addAmt, updatedAt: nowIso },
            { merge: true }
          );
        });
      });
    } else {
      const curBal = Number(payer.data?.walletBalance || 0);
      if (curBal < totalAmount) {
        return {
          ok: false,
          reason: `Salio la PapoWallet halitoshi (Una TZS ${curBal.toLocaleString()}, jumla ya wote ni TZS ${totalAmount.toLocaleString()}).`,
        };
      }
      nextPayerBal = curBal - totalAmount;
      await dbAdmin.collection('users').doc(payer.uid).set(
        { walletBalance: nextPayerBal, updatedAt: nowIso },
        { merge: true }
      );
      for (const [uid, addAmt] of creditByUid.entries()) {
        const recSnap = await dbAdmin.collection('users').doc(uid).get().catch(() => null);
        const recBal = Number(recSnap?.exists ? recSnap.data()?.walletBalance || 0 : 0);
        await dbAdmin.collection('users').doc(uid).set(
          { walletBalance: recBal + addAmt, updatedAt: nowIso },
          { merge: true }
        );
      }
    }
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.startsWith('INSUFFICIENT:')) {
      const bal = Number(msg.split(':')[1] || 0);
      return {
        ok: false,
        reason: `Salio la PapoWallet halitoshi (Una TZS ${bal.toLocaleString()}, jumla inayohitajika ni TZS ${totalAmount.toLocaleString()}).`,
      };
    }
    return { ok: false, reason: 'Hitilafu ya mfumo wakati wa kutuma pesa kwa pamoja.' };
  }

  const nowMs = Date.now();
  await dbAdmin.collection('payments').add(
    cleanUndefined({
      uid: payer.uid,
      phone: params.payerPhone,
      title: `Tuma Pesa Kwa Namba ${resolved.length} Kwa Pamoja`,
      subtitle: `BULK PAPO-TO-PAPO (0% ADA) • ${noteText}`,
      amount: totalAmount,
      type: 'debit',
      category: 'transfer',
      status: 'completed',
      refCode: batchRefCode,
      recipientCount: resolved.length,
      createdAt: nowIso,
      createdAtMs: nowMs,
    })
  );

  await Promise.all(
    resolved.map((r, idx) =>
      r.uid
        ? dbAdmin.collection('payments').add(
            cleanUndefined({
              uid: r.uid,
              phone: r.phone || '',
              title: `Umepokea Pesa kutoka ${params.payerName || params.payerPhone}`,
              subtitle: `BULK PAPO-TO-PAPO (0% ADA) • ${noteText}`,
              amount: r.amount,
              type: 'credit',
              category: 'transfer',
              status: 'completed',
              refCode: `${batchRefCode}-${idx + 1}`,
              batchRefCode,
              createdAt: nowIso,
              createdAtMs: nowMs + idx,
            })
          )
        : Promise.resolve()
    )
  );

  return {
    ok: true,
    batchRefCode,
    totalAmount,
    newPayerBalance: nextPayerBal,
    recipients: resolved,
  };
}

export interface ParsedBulkTransferLine {
  recipientQuery: string;
  amount: number | null;
}

export interface ParsedBulkTransferResult {
  ok: boolean;
  mode?: 'shared_amount' | 'amounts_per_item';
  items?: ParsedBulkTransferLine[];
  errorCode?: 'EMPTY' | 'TOO_MANY' | 'MIXED_AMOUNTS' | 'AMOUNT_TOO_LOW' | 'INVALID_ENTRY';
  message?: string;
}

function isValidTargetToken(raw: string): boolean {
  const compact = String(raw || '').trim().replace(/[\s-]/g, '');
  if (!compact) return false;
  if (/^PP\d{6,}$/i.test(compact)) return true;
  const digits = compact.replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 13;
}

function cleanTargetToken(raw: string): string {
  const compact = String(raw || '').trim().replace(/[\s-]/g, '');
  if (/^PP\d+$/i.test(compact)) return compact.toUpperCase();
  if (compact.startsWith('+')) return `+${compact.slice(1).replace(/\D/g, '')}`;
  return compact.replace(/\D/g, '');
}

/**
 * Parses WhatsApp bulk-transfer text into structured recipient queries & optional per-recipient amounts.
 * Supports:
 *  - Shared amount list: "0712345678, 0755111222, 0688999000" or newline/space separated
 *  - Per-recipient amounts: "0712345678 10000\n0755111222: 15,000/=\n0688999000 - 5000"
 */
export function parseBulkTransferInput(rawText: string): ParsedBulkTransferResult {
  const text = String(rawText || '').trim();
  if (!text) {
    return { ok: false, errorCode: 'EMPTY', message: 'Andika angalau namba moja ya simu au Wallet ID.' };
  }

  // Split by newlines or semicolons first, then commas only when NOT inside a formatted number like 10,000
  const rawSegments = text
    .split(/[\n;]+/)
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed) return [];
      // Split on commas separating recipients, while preserving thousands separators like 15,000 or 1,500,000
      return trimmed.split(/,(?=\s|\+|PP\d|\d{4,})|,(?!\d{3}\b)/i);
    })
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawSegments.length === 0) {
    return { ok: false, errorCode: 'EMPTY', message: 'Andika angalau namba moja ya simu au Wallet ID.' };
  }

  const parsedItems: ParsedBulkTransferLine[] = [];

  for (const seg of rawSegments) {
    // Strip trailing currency markers like TZS, Tsh, /=
    const cleanedSeg = seg.replace(/\s*(?:\/=|tzs|tsh)\s*$/i, '').trim();

    // Case A: Explicit separator (: or =) between recipient and amount
    const explicitSep = cleanedSeg.match(/^(.+?)\s*[:=]\s*(\d[\d,]*)$/);
    if (explicitSep) {
      const targetPart = explicitSep[1].trim();
      const amt = parseInt(explicitSep[2].replace(/,/g, ''), 10);
      if (!isValidTargetToken(targetPart)) {
        return {
          ok: false,
          errorCode: 'INVALID_ENTRY',
          message: `Namba "${targetPart}" si sahihi. Tumia mfano: 0712345678 10000`,
        };
      }
      if (!Number.isFinite(amt) || amt < 100) {
        return {
          ok: false,
          errorCode: 'AMOUNT_TOO_LOW',
          message: `Kiasi cha chini kwa "${targetPart}" ni TZS 100.`,
        };
      }
      parsedItems.push({ recipientQuery: cleanTargetToken(targetPart), amount: amt });
      continue;
    }

    // Case B: Whitespace or dash-separated tokens on one line
    const tokens = cleanedSeg.split(/\s+/).filter(Boolean);

    // Check if the segment is multiple standalone phone numbers separated by spaces:
    // e.g. "0712345678 0755111222 0688999000"
    if (
      tokens.length >= 2 &&
      tokens.every((t) => {
        const d = t.replace(/\D/g, '');
        return (/^(?:0\d{9}|255\d{9})$/.test(d) || /^PP\d{6,}$/i.test(t));
      })
    ) {
      for (const t of tokens) {
        parsedItems.push({ recipientQuery: cleanTargetToken(t), amount: null });
      }
      continue;
    }

    // Check if trailing token is an amount (with optional '-' separator right before it)
    const dashOrSpaceAmt = cleanedSeg.match(/^(\+?\d[\d\s-]{5,15}?|PP\d{6,})\s*(?:-\s*|\s+)(\d[\d,]*)$/i);
    if (dashOrSpaceAmt) {
      const targetPart = dashOrSpaceAmt[1].trim();
      const amtToken = dashOrSpaceAmt[2].replace(/,/g, '');
      const targetDigits = targetPart.replace(/\D/g, '');

      // Avoid mis-parsing a spaced phone number like "0712 345 678" where targetDigits is < 9
      const looksLikePhoneWithAmount =
        (/^PP\d{6,}$/i.test(targetPart.replace(/\s+/g, '')) ||
          (targetDigits.length >= 9 && targetDigits.length <= 12) ||
          (targetDigits.length >= 6 && cleanedSeg.includes(' - ')));

      if (looksLikePhoneWithAmount) {
        const amt = parseInt(amtToken, 10);
        if (!Number.isFinite(amt) || amt < 100) {
          return {
            ok: false,
            errorCode: 'AMOUNT_TOO_LOW',
            message: `Kiasi cha chini kwa "${targetPart}" ni TZS 100.`,
          };
        }
        parsedItems.push({ recipientQuery: cleanTargetToken(targetPart), amount: amt });
        continue;
      }
    }

    // Case C: Single target without amount (supports spaced phone numbers like "+255 712 345 678")
    if (isValidTargetToken(cleanedSeg)) {
      parsedItems.push({ recipientQuery: cleanTargetToken(cleanedSeg), amount: null });
      continue;
    }

    return {
      ok: false,
      errorCode: 'INVALID_ENTRY',
      message: `Hatukuweza kuelewa mstari: "${seg}". Tumia mfano: 0712345678, 0755111222 au 0712345678 10000`,
    };
  }

  if (parsedItems.length === 0) {
    return { ok: false, errorCode: 'EMPTY', message: 'Hakuna namba iliyopatikana.' };
  }

  const withAmount = parsedItems.filter((it) => it.amount !== null);
  const withoutAmount = parsedItems.filter((it) => it.amount === null);

  if (withAmount.length > 0 && withoutAmount.length > 0) {
    return {
      ok: false,
      errorCode: 'MIXED_AMOUNTS',
      message:
        'Baadhi ya namba zina kiasi na nyingine hazina. Weka kiasi kwenye kila mstari, au tuma namba pekee ili uingize kiasi sawa kwa wote.',
    };
  }

  // Deduplicate identical recipients in shared_amount mode to prevent accidental double-pay
  let finalItems = parsedItems;
  if (withoutAmount.length > 0) {
    const seen = new Set<string>();
    const canonKey = (q: string) => {
      const upper = q.trim().toUpperCase();
      if (/^PP\d+$/.test(upper)) return upper;
      const d = upper.replace(/\D/g, '');
      if (d.length >= 9 && (d.startsWith('0') || d.startsWith('255'))) {
        return `TZ:${d.slice(-9)}`;
      }
      return d || upper;
    };
    finalItems = parsedItems.filter((it) => {
      const k = canonKey(it.recipientQuery);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  if (finalItems.length > 20) {
    return {
      ok: false,
      errorCode: 'TOO_MANY',
      message: `Umeweka wapokeaji ${finalItems.length}. Kikomo ni wapokeaji 20 kwa mkupuo mmoja.`,
    };
  }

  return {
    ok: true,
    mode: withAmount.length > 0 ? 'amounts_per_item' : 'shared_amount',
    items: finalItems,
  };
}

export interface TanzaniaBankOption {
  id: string;
  name: string;
  shortCode: string;
  description: string;
}

export const TANZANIA_BANKS: TanzaniaBankOption[] = [
  { id: 'CRDB', name: 'CRDB Bank', shortCode: 'CRDB', description: 'Tuma kwenda akaunti ya CRDB' },
  { id: 'NMB', name: 'NMB Bank', shortCode: 'NMB', description: 'Tuma kwenda akaunti ya NMB' },
  { id: 'NBC', name: 'NBC Bank', shortCode: 'NBC', description: 'Tuma kwenda akaunti ya NBC' },
  { id: 'PBZ', name: 'PBZ Bank', shortCode: 'PBZ', description: 'People’s Bank of Zanzibar' },
  { id: 'STANBIC', name: 'Stanbic Bank', shortCode: 'STANBIC', description: 'Tuma kwenda Stanbic Bank' },
  { id: 'ABSA', name: 'ABSA Bank Tanzania', shortCode: 'ABSA', description: 'Tuma kwenda ABSA Bank' },
  { id: 'EXIM', name: 'Exim Bank Tanzania', shortCode: 'EXIM', description: 'Tuma kwenda Exim Bank' },
  { id: 'TCB', name: 'TCB (Postal Bank)', shortCode: 'TCB', description: 'Tanzania Commercial Bank' },
  { id: 'KCB', name: 'KCB / Equity / Azania', shortCode: 'KCB', description: 'KCB, Equity au Azania Bank' },
];

export async function executeQueuedExternalTransfer(
  dbAdmin: any,
  params: {
    payerUid?: string;
    payerPhone: string;
    payerName: string;
    destinationType: 'mobile_money' | 'bank';
    destinationName: string; // e.g. 'M-Pesa', 'Mixx by Yas', 'CRDB Bank'
    accountOrPhone: string;
    recipientName: string;
    amount: number;
    fee: number;
    note?: string;
  }
): Promise<{
  ok: boolean;
  reason?: string;
  insufficientBalance?: boolean;
  currentBalance?: number;
  refCode?: string;
  fee?: number;
  totalDebit?: number;
  newBalance?: number;
}> {
  const amt = Math.round(Number(params.amount || 0));
  const fee = Math.max(0, Math.round(Number(params.fee || 0)));
  const totalDebit = amt + fee;
  if (!dbAdmin || !Number.isFinite(amt) || amt < 1000) {
    return { ok: false, reason: 'Kiasi cha chini cha kutuma nje ya PapoWallet ni TZS 1,000.' };
  }

  const payer = await findOrEnsureWalletUser(dbAdmin, {
    uid: params.payerUid,
    phone: params.payerPhone,
    displayName: params.payerName,
    createIfMissing: false,
  });
  if (!payer) {
    return {
      ok: false,
      insufficientBalance: true,
      currentBalance: 0,
      reason: 'Akaunti yako ya PapoWallet haina salio. Weka pesa kwanza kupitia Mongike Push au Lipa Namba.',
    };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const refCode = params.destinationType === 'bank' ? `BANK-${code}` : `MOMO-${code}`;
  const nowIso = new Date().toISOString();
  let newBalance = 0;

  try {
    if (typeof dbAdmin.runTransaction === 'function') {
      await dbAdmin.runTransaction(async (tx: any) => {
        const payerRef = dbAdmin.collection('users').doc(payer.uid);
        const snap = await tx.get(payerRef);
        const curBal = Number(snap.data()?.walletBalance || 0);
        if (curBal < totalDebit) {
          throw new Error(`INSUFFICIENT:${curBal}`);
        }
        newBalance = curBal - totalDebit;
        tx.set(payerRef, { walletBalance: newBalance, updatedAt: nowIso }, { merge: true });
      });
    } else {
      const curBal = Number(payer.data?.walletBalance || 0);
      if (curBal < totalDebit) {
        return {
          ok: false,
          insufficientBalance: true,
          currentBalance: curBal,
          reason: `Salio la PapoWallet halitoshi (Una TZS ${curBal.toLocaleString()}, unahitaji TZS ${totalDebit.toLocaleString()}).`,
        };
      }
      newBalance = curBal - totalDebit;
      await dbAdmin.collection('users').doc(payer.uid).set(
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
        insufficientBalance: true,
        currentBalance: bal,
        reason: `Salio la PapoWallet halitoshi (Una TZS ${bal.toLocaleString()}, unahitaji TZS ${totalDebit.toLocaleString()}).`,
      };
    }
    return { ok: false, reason: 'Imeshindwa kuhakiki salio la PapoWallet.' };
  }

  await Promise.allSettled([
    dbAdmin.collection('disbursements').doc(refCode).set(
      cleanUndefined({
        reference: refCode,
        provider: params.destinationType === 'bank' ? 'bank_queue' : 'mobile_queue',
        channel: params.destinationType,
        network: params.destinationName,
        bankName: params.destinationType === 'bank' ? params.destinationName : undefined,
        accountNumber: params.destinationType === 'bank' ? params.accountOrPhone : undefined,
        recipientPhone: params.destinationType === 'mobile_money' ? params.accountOrPhone : undefined,
        recipientName: params.recipientName,
        payerUid: payer.uid,
        payerPhone: params.payerPhone,
        payerName: params.payerName,
        amount: amt,
        fee,
        totalDebit,
        note: params.note || undefined,
        refundedOnFailure: false,
        status: 'pending_admin',
        createdAt: nowIso,
        updatedAt: nowIso,
      }),
      { merge: true }
    ),
    dbAdmin.collection('payments').add(
      cleanUndefined({
        uid: payer.uid,
        phone: params.payerPhone,
        recipientAccount: params.accountOrPhone,
        recipientName: params.recipientName,
        title:
          params.destinationType === 'bank'
            ? `Tuma Benki: ${params.destinationName} (${params.accountOrPhone})`
            : `Tuma Simu: ${params.destinationName} (${params.accountOrPhone})`,
        subtitle: `${refCode} • ${params.recipientName} • Ada TZS ${fee.toLocaleString()}`,
        amount: totalDebit,
        type: 'debit',
        category: params.destinationType === 'bank' ? 'bank_transfer' : 'transfer',
        status: 'pending',
        refCode,
        createdAt: nowIso,
        createdAtMs: Date.now(),
      })
    ),
  ]);

  return {
    ok: true,
    refCode,
    fee,
    totalDebit,
    newBalance,
  };
}
