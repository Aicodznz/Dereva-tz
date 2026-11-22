import QRCode from 'qrcode';
import {
  cleanUndefined,
  normalizePartnerWaDigits,
  partnerPhoneLast9,
  type PartnerBotDeps,
  type PartnerMetaChannel,
  type PartnerSessionLike,
  awardWhatsAppOrderLoyalty,
  notifyDriversNewJobToWhatsApp,
} from './whatsappPartnerAndLoyalty.js';

function normEpoch(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
  const p = Date.parse(String(ts));
  return Number.isNaN(p) ? 0 : p;
}

function normalizePhoneDisplay(raw: string): string {
  const digits = normalizePartnerWaDigits(raw);
  return digits ? `+${digits}` : raw;
}

export function getPublicAppBaseUrl(): string {
  return (process.env.APP_PUBLIC_URL || 'https://dereva-tz.onrender.com').replace(/\/+$/, '');
}

// ============================================================================
// 1. VISUAL QR RECEIPT / TICKET GENERATOR (PNG Data URL + WhatsApp Media)
// ============================================================================
export async function generateVisualReceiptQrDataUrl(targetUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(targetUrl, {
      type: 'image/png',
      width: 420,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.warn('[QR Receipt] Failed to generate QR Data URL:', err);
    return '';
  }
}

export async function generateVisualReceiptQrBuffer(targetUrl: string): Promise<Buffer | null> {
  try {
    return await QRCode.toBuffer(targetUrl, {
      type: 'png',
      width: 480,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.warn('[QR Receipt] Failed to generate QR Buffer:', err);
    return null;
  }
}

export async function attachBookingQrMedia(
  mediaCollector: Array<{ url: string; caption?: string }> | undefined,
  params: {
    entityType: 'order' | 'ride' | 'ticket';
    entityId: string;
    bookingCode: string;
    title: string;
    amount?: number;
    subtitle?: string;
  }
): Promise<string> {
  const baseUrl = getPublicAppBaseUrl();
  const verifyPath =
    params.entityType === 'ride'
      ? `/track/${encodeURIComponent(params.entityId)}`
      : `/verify-receipt/${encodeURIComponent(params.entityId)}`;
  const verifyUrl = `${baseUrl}${verifyPath}`;
  const qrDataUrl = await generateVisualReceiptQrDataUrl(verifyUrl);

  if (qrDataUrl && Array.isArray(mediaCollector)) {
    const amtText = params.amount && params.amount > 0 ? ` • TZS ${Number(params.amount).toLocaleString()}` : '';
    const subText = params.subtitle ? `\n${params.subtitle}` : '';
    mediaCollector.push({
      url: qrDataUrl,
      caption: `🧾 QR ${params.title} (#${params.bookingCode})${amtText}${subText}\n🔍 Uhakiki: ${verifyUrl}`,
    });
  }
  return verifyUrl;
}

export async function handleReceiptQrCommand(params: {
  senderId: string;
  cleanInput: string;
  dbAdmin: any;
  session: PartnerSessionLike;
  lang: 'sw' | 'en';
  knownPhone: string;
  defaultWaPhone: string;
  mediaCollector?: Array<{ url: string; caption?: string }>;
  deps: PartnerBotDeps;
}): Promise<string | null> {
  const { senderId, cleanInput, dbAdmin, session, lang, knownPhone, defaultWaPhone, mediaCollector, deps } = params;
  const trimmed = cleanInput.trim();
  const match = trimmed.match(/^(?:🧾\s*)?(?:risiti|receipt|qr|tiketi\s*qr|e-?ticket|CMD:GET_RECEIPT)(?:\s+#?([A-Za-z0-9_-]{3,24}))?$/i);
  if (!match) return null;

  const isEn = lang === 'en';
  const requestedCode = (match[1] || '').trim().toUpperCase().replace(/^#/, '');
  const lookupPhone = knownPhone || defaultWaPhone || senderId;
  const last9 = partnerPhoneLast9(lookupPhone);

  if (!dbAdmin) {
    return isEn
      ? `[[EN_NATIVE]]⚠️ Receipt lookup requires an active database connection.`
      : `⚠️ Mfumo wa kuhakiki risiti haujaunganishwa kwa sasa.`;
  }

  const [ordersSnap, ridesSnap] = await Promise.all([
    dbAdmin.collection('orders').limit(60).get().catch(() => ({ docs: [] })),
    dbAdmin.collection('rides').limit(60).get().catch(() => ({ docs: [] })),
  ]);

  const matchingOrders = (ordersSnap.docs || [])
    .map((d: any) => ({ id: d.id, ...(d.data() || {}), _kind: 'order' as const }))
    .filter((o: any) => {
      const code = String(o.bookingCode || o.bookingRef || o.id.slice(-6)).toUpperCase().replace(/^#/, '');
      if (requestedCode) return code === requestedCode || o.id.toUpperCase() === requestedCode;
      return (
        partnerPhoneLast9(o.customerPhone) === last9 ||
        partnerPhoneLast9(o.metaSenderId) === last9 ||
        String(o.customerId || '').includes(senderId)
      );
    });

  const matchingRides = (ridesSnap.docs || [])
    .map((d: any) => ({ id: d.id, ...(d.data() || {}), _kind: 'ride' as const }))
    .filter((r: any) => {
      const code = String(r.bookingId || r.id.slice(-6)).toUpperCase().replace(/^#/, '');
      if (requestedCode) return code === requestedCode || r.id.toUpperCase() === requestedCode;
      return (
        partnerPhoneLast9(r.customerInfo?.phone || r.customerPhone) === last9 ||
        partnerPhoneLast9(r.metaSenderId) === last9 ||
        String(r.customerId || '').includes(senderId)
      );
    });

  const combined = [...matchingOrders, ...matchingRides].sort((a, b) => normEpoch(b.createdAt) - normEpoch(a.createdAt));
  if (combined.length === 0) {
    session.details.quickReplyButtons = [
      { id: 'CMD:MY_ORDERS', title: isEn ? '📋 My Orders' : '📋 Oda Zangu' },
      { id: '00', title: isEn ? '🏠 Main Menu' : '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return isEn
      ? `[[EN_NATIVE]]ℹ️ No matching receipt/ticket found${requestedCode ? ` for *#${requestedCode}*` : ''}. Tap *My Orders* to view your history.`
      : `ℹ️ Hatujapata risiti au tiketi${requestedCode ? ` ya *#${requestedCode}*` : ''} kwenye namba hii. Bonyeza *Oda Zangu* kuona historia yako.`;
  }

  const target = combined[0];
  const isRide = target._kind === 'ride';
  const code = String(target.bookingCode || target.bookingId || target.id.slice(-6)).toUpperCase().replace(/^#/, '');
  const amount = Number(target.totalAmount ?? target.total ?? target.fare ?? 0);
  const title = isRide
    ? `Safari (${target.vehicleType || 'PapoRide'})`
    : target.vendorName || target.type || 'Papo Hapo';
  const sub = isRide
    ? `${target.pickup?.name || 'Mwanzo'} ➜ ${target.destination?.name || 'Mwisho'}`
    : Array.isArray(target.items)
    ? target.items.slice(0, 3).map((it: any) => `${it.name || it.productName} x${it.quantity || 1}`).join(', ')
    : '';

  const verifyUrl = await attachBookingQrMedia(mediaCollector, {
    entityType: isRide ? 'ride' : 'order',
    entityId: target.id,
    bookingCode: code,
    title,
    amount,
    subtitle: sub,
  });

  session.details.quickReplyButtons = [
    { id: 'CMD:REORDER_LAST', title: isEn ? '🔁 Reorder' : '🔁 Agiza Tena' },
    { id: '00', title: isEn ? '🏠 Main Menu' : '🏠 Menyu Kuu' },
  ];
  await deps.saveSession(session, dbAdmin);

  return (
    `🧾 *RISITI RASMI YA QR — #${code}*\n\n` +
    `📌 *Huduma:* ${title}\n` +
    (sub ? `📝 *Maelezo:* ${sub}\n` : '') +
    (amount > 0 ? `💰 *Kiasi:* *TZS ${amount.toLocaleString()}/=*\n` : '') +
    `📊 *Hali:* ${String(target.status || 'pending').toUpperCase()}\n\n` +
    `✅ _Skani picha ya QR hapo juu au fungua kiungo kuhakiki risiti:_\n🔗 ${verifyUrl}`
  );
}

// ============================================================================
// 2. LOYALTY REDEMPTION & REFERRAL REWARDS (KOMBOA POINTI + ALIKA RAFIKI)
// ============================================================================
export const POINTS_TO_TZS_RATE = 20; // 1 Pointi = TZS 20/=
export const STAMP_REWARD_TZS_VALUE = 2000; // 1 Zawadi ya Stempu 5 = TZS 2,000/=

export async function getCustomerLoyaltySnapshot(dbAdmin: any, phoneOrSenderId: string): Promise<{
  totalPoints: number;
  totalRewards: number;
  cards: Array<{ vendorId: string; cardDocId: string; label: string; points: number; rewards: number; stamps: number }>;
}> {
  const last9 = partnerPhoneLast9(phoneOrSenderId);
  if (!dbAdmin || !last9) return { totalPoints: 0, totalRewards: 0, cards: [] };

  let totalPoints = 0;
  let totalRewards = 0;
  const cards: Array<{ vendorId: string; cardDocId: string; label: string; points: number; rewards: number; stamps: number }> = [];

  try {
    const vSnap = await dbAdmin.collection('vendors').limit(60).get().catch(() => ({ docs: [] }));
    const vendorTargets: Array<{ id: string; label: string }> = (vSnap.docs || []).map((vd: any) => ({
      id: vd.id,
      label: vd.data()?.businessName || vd.data()?.name || 'Duka',
    }));
    if (!vendorTargets.some((v) => v.id === 'papo-hapo-express')) {
      vendorTargets.push({ id: 'papo-hapo-express', label: 'Papo Hapo Express / Safari' });
    }

    await Promise.all(
      vendorTargets.map(async (vt) => {
        const cardsSnap = await dbAdmin
          .collection('vendors')
          .doc(vt.id)
          .collection('loyalty_cards')
          .limit(35)
          .get()
          .catch(() => ({ docs: [] }));
        for (const cd of cardsSnap.docs || []) {
          const c = cd.data() || {};
          if (partnerPhoneLast9(c.customerPhone) === last9) {
            const pts = Number(c.currentPoints || 0);
            const rw = Number(c.availableRewards || 0);
            totalPoints += pts;
            totalRewards += rw;
            cards.push({
              vendorId: vt.id,
              cardDocId: cd.id,
              label: vt.label,
              points: pts,
              rewards: rw,
              stamps: Number(c.currentStamps || 0),
            });
          }
        }
      })
    );
  } catch {}

  return { totalPoints, totalRewards, cards };
}

export async function deductRedeemedLoyaltyPoints(
  dbAdmin: any,
  params: {
    customerPhone: string;
    pointsUsed?: number;
    redeemRewardVendorId?: string;
  }
): Promise<void> {
  if (!dbAdmin || !params.customerPhone) return;
  const pointsToDeduct = Math.max(0, Math.floor(Number(params.pointsUsed || 0)));
  if (pointsToDeduct <= 0 && !params.redeemRewardVendorId) return;

  const snap = await getCustomerLoyaltySnapshot(dbAdmin, params.customerPhone);
  let remainingPts = pointsToDeduct;

  for (const card of snap.cards) {
    const ref = dbAdmin.collection('vendors').doc(card.vendorId).collection('loyalty_cards').doc(card.cardDocId);
    const updates: Record<string, any> = {};
    if (params.redeemRewardVendorId && card.vendorId === params.redeemRewardVendorId && card.rewards > 0) {
      updates.availableRewards = Math.max(0, card.rewards - 1);
      updates.redeemedRewardsCount = (await ref.get().catch(() => null))?.data()?.redeemedRewardsCount
        ? Number((await ref.get().catch(() => null))?.data()?.redeemedRewardsCount || 0) + 1
        : 1;
    }
    if (remainingPts > 0 && card.points > 0) {
      const take = Math.min(card.points, remainingPts);
      updates.currentPoints = Math.max(0, card.points - take);
      remainingPts -= take;
    }
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await ref.set(updates, { merge: true }).catch(() => {});
    }
  }
}

export async function ensureCustomerReferralCode(
  dbAdmin: any,
  params: { senderId: string; channel: PartnerMetaChannel; name?: string; phone?: string }
): Promise<{
  code: string;
  invitedCount: number;
  referredByCode?: string;
}> {
  const digits = normalizePartnerWaDigits(params.phone || params.senderId) || params.senderId.replace(/\W/g, '');
  const fallbackCode = `PAPO${digits.slice(-4).padStart(4, '0')}`.toUpperCase();
  const docKey = `${params.channel}_${params.senderId}`;

  if (!dbAdmin) {
    return { code: fallbackCode, invitedCount: 0 };
  }

  try {
    const custRef = dbAdmin.collection('meta_customers').doc(docKey);
    const cSnap = await custRef.get().catch(() => null);
    const cData = cSnap?.exists ? cSnap.data() || {} : {};
    let code = String(cData.referralCode || '').trim().toUpperCase();
    if (!code) {
      code = fallbackCode;
      await custRef.set(cleanUndefined({ referralCode: code, promoOptIn: cData.promoOptIn ?? true }), { merge: true }).catch(() => {});
    }

    const rSnap = await dbAdmin.collection('referrals').doc(code).get().catch(() => null);
    if (!rSnap?.exists) {
      await dbAdmin
        .collection('referrals')
        .doc(code)
        .set(
          cleanUndefined({
            code,
            ownerSenderId: params.senderId,
            ownerChannel: params.channel,
            ownerPhone: normalizePartnerWaDigits(params.phone || params.senderId),
            ownerName: params.name || cData.name || 'Mteja wa Papo Hapo',
            invitedCount: 0,
            totalBonusPointsEarned: 0,
            createdAt: new Date(),
          }),
          { merge: true }
        )
        .catch(() => {});
      return { code, invitedCount: 0, referredByCode: cData.referredByCode };
    }
    const rData = rSnap.data() || {};
    return {
      code,
      invitedCount: Number(rData.invitedCount || 0),
      referredByCode: cData.referredByCode,
    };
  } catch {
    return { code: fallbackCode, invitedCount: 0 };
  }
}

export async function processReferralRewardOnOrder(
  dbAdmin: any,
  params: { senderId: string; channel: PartnerMetaChannel; customerPhone: string; customerName?: string },
  sendOutbound?: PartnerBotDeps['sendOutbound']
): Promise<void> {
  if (!dbAdmin || !params.senderId) return;
  try {
    const custRef = dbAdmin.collection('meta_customers').doc(`${params.channel}_${params.senderId}`);
    const cSnap = await custRef.get().catch(() => null);
    const cData = cSnap?.exists ? cSnap.data() || {} : {};
    const refCode = String(cData.referredByCode || '').trim().toUpperCase();
    if (!refCode || cData.referralFirstOrderRewarded === true) return;

    const rSnap = await dbAdmin.collection('referrals').doc(refCode).get().catch(() => null);
    if (!rSnap?.exists) return;
    const rData = rSnap.data() || {};
    const ownerPhone = String(rData.ownerPhone || rData.ownerSenderId || '').trim();

    await custRef.set({ referralFirstOrderRewarded: true, updatedAt: new Date() }, { merge: true }).catch(() => {});
    await dbAdmin
      .collection('referrals')
      .doc(refCode)
      .set(
        {
          invitedCount: Number(rData.invitedCount || 0) + 1,
          totalBonusPointsEarned: Number(rData.totalBonusPointsEarned || 0) + 50,
          updatedAt: new Date(),
        },
        { merge: true }
      )
      .catch(() => {});

    // Award +50 bonus points (= TZS 1,000) to both referee and referrer
    await awardWhatsAppOrderLoyalty(dbAdmin, {
      vendorId: 'papo-hapo-express',
      customerPhone: params.customerPhone || params.senderId,
      customerName: params.customerName || 'Mteja',
      orderTotal: 5000, // yields 50 points
    });
    if (ownerPhone) {
      await awardWhatsAppOrderLoyalty(dbAdmin, {
        vendorId: 'papo-hapo-express',
        customerPhone: ownerPhone,
        customerName: rData.ownerName || 'Rafiki',
        orderTotal: 5000,
      });
      if (sendOutbound) {
        await sendOutbound({
          channel: (rData.ownerChannel || 'whatsapp') as PartnerMetaChannel,
          recipientId: rData.ownerSenderId || ownerPhone,
          text:
            `🎊 *BONASI YA MUALIKO (+50 Pointi = TZS 1,000)!*\n\n` +
            `Rafiki yako *${params.customerName || 'mpya'}* ameagiza huduma kupitia kodi yako *${refCode}*!\n` +
            `Umepokea *+50 Pointi* za ziada. Andika *Pointi* kuona salio lako au *KOMBOA* unapolipa oda!`,
        }).catch(() => {});
      }
    }
  } catch {}
}

export async function handleReferralAndRedemptionCommands(params: {
  senderId: string;
  cleanInput: string;
  channel: PartnerMetaChannel;
  dbAdmin: any;
  session: PartnerSessionLike;
  lang: 'sw' | 'en';
  knownPhone: string;
  defaultWaPhone: string;
  deps: PartnerBotDeps;
}): Promise<string | null> {
  const { senderId, cleanInput, channel, dbAdmin, session, lang, knownPhone, defaultWaPhone, deps } = params;
  const trimmed = cleanInput.trim();
  const isEn = lang === 'en';
  const lookupPhone = knownPhone || defaultWaPhone || senderId;

  // A. Show Customer's Referral Info ("Alika Rafiki" / CMD:REFERRAL_INFO) — must run BEFORE ALIKA <CODE>
  if (/^(?:🤝\s*)?(alika\s*rafiki|mualiko|referral|invite\s*friends?|CMD:REFERRAL_INFO|REFERRAL_INFO)$/i.test(trimmed)) {
    const info = await ensureCustomerReferralCode(dbAdmin, {
      senderId,
      channel,
      name: session.details.customerName,
      phone: lookupPhone,
    });
    const botWaDigits = normalizePartnerWaDigits(process.env.META_WHATSAPP_PUBLIC_NUMBER || '255775985358');
    const waShareUrl = `https://wa.me/${botWaDigits}?text=${encodeURIComponent(`ALIKA ${info.code}`)}`;

    session.details.quickReplyButtons = [
      { id: 'CMD:LOYALTY_INFO', title: isEn ? '🎁 My Points' : '🎁 Pointi Zangu' },
      { id: '00', title: isEn ? '🏠 Main Menu' : '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);

    return (
      `🤝 *ALIKA RAFIKI — PATA TZS 1,000+ BURE!*\n\n` +
      `🔖 *Kodi Yako ya Mualiko:* *${info.code}*\n` +
      `👥 *Marafiki Waliojiunga:* ${info.invitedCount}\n\n` +
      `📣 *Jinsi Inavyofanya Kazi:*\n` +
      `1. Mtumie rafiki yako kodi *${info.code}* au kiungo chako.\n` +
      `2. Akijiunga na kuandika *ALIKA ${info.code}* kisha akaagiza mara ya kwanza, nyote wawili mnapata *+50 Pointi (TZS 1,000)*!\n\n` +
      `🔗 *Kiungo cha Kushea:* ${waShareUrl}`
    );
  }

  // B. Apply a Friend's Referral Code: "ALIKA PAPO1234" or "INVITE PAPO1234"
  const applyRefMatch = trimmed.match(/^(?:alika|invite|referral|ref)\s+#?([A-Za-z0-9_-]{4,20})$/i);
  if (applyRefMatch && !/^(rafiki|friends?|mualiko|info)$/i.test(applyRefMatch[1]) && dbAdmin) {
    const code = applyRefMatch[1].toUpperCase();
    const myInfo = await ensureCustomerReferralCode(dbAdmin, {
      senderId,
      channel,
      name: session.details.customerName,
      phone: lookupPhone,
    });
    if (code === myInfo.code) {
      return `⚠️ Huwezi kutumia kodi yako mwenyewe (*${code}*). Mtumie rafiki yako kodi hiyo ili nyote mpate *+50 Pointi*!`;
    }
    if (myInfo.referredByCode) {
      return `ℹ️ Akaunti yako tayari imeunganishwa na kodi ya mualiko *${myInfo.referredByCode}*.`;
    }
    const rSnap = await dbAdmin.collection('referrals').doc(code).get().catch(() => null);
    if (!rSnap?.exists) {
      return `⚠️ Kodi ya mualiko *${code}* haipatikani. Hakikisha umeandika kodi sahihi (mfano: *ALIKA PAPO1234*).`;
    }
    const rData = rSnap.data() || {};
    await dbAdmin
      .collection('meta_customers')
      .doc(`${channel}_${senderId}`)
      .set(
        cleanUndefined({
          referredByCode: code,
          referredByName: rData.ownerName || 'Rafiki',
          referredAt: new Date(),
        }),
        { merge: true }
      )
      .catch(() => {});

    // Give immediate 20 welcome pts
    await awardWhatsAppOrderLoyalty(dbAdmin, {
      vendorId: 'papo-hapo-express',
      customerPhone: lookupPhone,
      customerName: session.details.customerName || 'Mteja',
      orderTotal: 2000, // 20 pts
    });

    session.details.quickReplyButtons = [
      { id: 'CMD:LOYALTY_INFO', title: '🎁 Pointi Zangu' },
      { id: '00', title: '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return (
      `🤝 *KODI YA MUALIKO IMETUMIKA: ${code}!*\n\n` +
      `🎁 Umepata *+20 Pointi* za ukaribisho sasa hivi!\n` +
      `Ukikamilisha oda au safari yako inayofuata, wewe na *${rData.ownerName || 'aliyekualika'}* mtapata *+50 Pointi* za nyongeza!`
    );
  }

  // C. Redeem Loyalty Points ("KOMBOA" / "TUMIA POINTI" / CMD:REDEEM_POINTS)
  const isRedeemCmd = /^(?:🎁\s*|💎\s*)?(komboa(\s*pointi|\s*zawadi)?|tumia\s*pointi|redeem(\s*points)?|CMD:REDEEM_POINTS|REDEEM_POINTS)$/i.test(
    trimmed
  );
  if (isRedeemCmd) {
    const snap = await getCustomerLoyaltySnapshot(dbAdmin, lookupPhone);
    const inCheckout =
      session.step === 'SELECTING_PAYMENT_METHOD' ||
      session.step === 'CONFIRMING_TRIP' ||
      session.step === 'CART_WAIT_PAYMENT';

    if (!inCheckout) {
      const worthTzs = snap.totalPoints * POINTS_TO_TZS_RATE + snap.totalRewards * STAMP_REWARD_TZS_VALUE;
      session.details.quickReplyButtons = [
        { id: 'CMD:LOYALTY_INFO', title: '🎁 Pointi Zangu' },
        { id: '00', title: '🏠 Menyu Kuu' },
      ];
      await deps.saveSession(session, dbAdmin);
      return (
        `💎 *KUKOMBOA POINTI & ZAWADI*\n\n` +
        `⭐ *Pointi Ulizonazo:* ${snap.totalPoints} pts *(Thamani: TZS ${(snap.totalPoints * POINTS_TO_TZS_RATE).toLocaleString()}/=)*\n` +
        `🏆 *Zawadi za Stempu 5:* ${snap.totalRewards} *(Thamani: TZS ${(snap.totalRewards * STAMP_REWARD_TZS_VALUE).toLocaleString()}/=)*\n` +
        `💰 *Jumla ya Ofa Yako:* *TZS ${worthTzs.toLocaleString()}/=*\n\n` +
        `💡 _Ukiwa katika hatua ya kuchagua malipo (kwenye PapoRide, PapoFood au PapoMall), andika *KOMBOA* kupunguza bei ya oda papo hapo!_`
      );
    }

    // Mid-checkout redemption
    const subtotal = Number(
      session.details?.mallTotal ??
        session.details?.selectedPrice ??
        session.details?.calculatedFare ??
        session.details?.fare ??
        session.details?.totalAmount ??
        session.details?.total ??
        session.details?.price ??
        (Array.isArray(session.details?.foodCart)
          ? session.details.foodCart.reduce((s: number, it: any) => s + Number(it.price || 0) * Number(it.quantity || 1), 0)
          : 0)
    );

    const promoAlready = Number(session.details?.promoDiscount || 0);
    const remainingPayable = Math.max(0, subtotal - promoAlready);

    if (snap.totalRewards <= 0 && snap.totalPoints < 5) {
      return (
        `ℹ️ Kwa sasa una *${snap.totalPoints} pts* na *${snap.totalRewards}* zawadi za stempu (zinahitajika angalau *5 pts* kukomboa).\n\n` +
        `Endelea kuchagua malipo (*1–4*) ili kupata pointi zaidi kwenye oda hii!`
      );
    }

    let redeemDiscount = 0;
    let pointsUsed = 0;
    let rewardVendorId: string | undefined;

    const matchingRewardCard = snap.cards.find((c) => c.rewards > 0 && (!session.details?.selectedVendorId || c.vendorId === session.details.selectedVendorId)) || snap.cards.find((c) => c.rewards > 0);
    if (matchingRewardCard && remainingPayable > 0) {
      redeemDiscount = Math.min(remainingPayable, STAMP_REWARD_TZS_VALUE);
      rewardVendorId = matchingRewardCard.vendorId;
    } else if (snap.totalPoints >= 5 && remainingPayable > 0) {
      const maxWorth = snap.totalPoints * POINTS_TO_TZS_RATE;
      redeemDiscount = Math.min(remainingPayable, maxWorth);
      pointsUsed = Math.ceil(redeemDiscount / POINTS_TO_TZS_RATE);
    }

    session.details.redeemDiscount = redeemDiscount;
    session.details.redeemPointsUsed = pointsUsed;
    if (rewardVendorId) session.details.redeemRewardVendorId = rewardVendorId;
    const netTotal = Math.max(0, subtotal - promoAlready - redeemDiscount);
    await deps.saveSession(session, dbAdmin);

    return (
      `💎 *POINTI ZIMEKOMBOLWA!* ✅\n` +
      `✂️ *Punguzo la Pointi:* -TZS ${redeemDiscount.toLocaleString()}/=${pointsUsed > 0 ? ` (${pointsUsed} pts)` : ' (Zawadi ya Stempu 5)'}\n` +
      `💰 *Kiasi Kipya cha Kulipa:* *TZS ${netTotal.toLocaleString()}/=*\n\n` +
      `Sasa chagua njia ya malipo (*1. Cash, 2. M-Pesa, 3. Tigo Pesa, 4. Airtel Money*) au andika *Ndio* kuthibitisha:`
    );
  }

  return null;
}

// ============================================================================
// 3. LIVE HUMAN AGENT HANDOVER (ONGEA NA MHUDUMU + ADMIN SUPPORT DESK)
// ============================================================================
export async function handleHumanHandoverFlow(params: {
  senderId: string;
  cleanInput: string;
  channel: PartnerMetaChannel;
  dbAdmin: any;
  session: PartnerSessionLike;
  lang: 'sw' | 'en';
  knownPhone: string;
  defaultWaPhone: string;
  deps: PartnerBotDeps;
}): Promise<string | null> {
  const { senderId, cleanInput, channel, dbAdmin, session, lang, knownPhone, defaultWaPhone, deps } = params;
  const trimmed = cleanInput.trim();
  const isEn = lang === 'en';
  const lookupPhone = knownPhone || defaultWaPhone || senderId;

  const isStartHandoverCmd = /^(?:🎧\s*|🙋\s*|🆘\s*)?(ongea\s+na\s+(?:mhudumu|mtu|admin|huduma)|mhudumu|msaada\s+wa\s+haraka|msaada|human\s*(?:agent|support)|live\s*support|agent|support|help\s*desk|CMD:HUMAN_HANDOVER|HUMAN_HANDOVER)$/i.test(
    trimmed
  );
  const isEndHandoverCmd = /^(?:🤖\s*)?(rudi\s*(?:kwa\s*)?boti|maliza\s*msaada|end\s*support|back\s*to\s*bot|CMD:END_HANDOVER|END_HANDOVER|menu|menyu|00|hi|habari)$/i.test(
    trimmed
  );

  // If currently in human handover session
  if (session.details?.humanHandover === true) {
    if (isEndHandoverCmd) {
      session.details.humanHandover = false;
      const ticketId = session.details.activeSupportTicketId;
      delete session.details.activeSupportTicketId;
      session.step = 'COLLECTING_ROUTE';
      delete session.service;
      session.details.quickReplyButtons = [{ id: '00', title: isEn ? '🏠 Main Menu' : '🏠 Menyu Kuu' }];
      await deps.saveSession(session, dbAdmin);

      if (dbAdmin) {
        try {
          await dbAdmin
            .collection('meta_customers')
            .doc(`${channel}_${senderId}`)
            .set({ humanHandover: false, updatedAt: new Date() }, { merge: true });
          if (ticketId) {
            await dbAdmin
              .collection('support_tickets')
              .doc(ticketId)
              .set({ status: 'resolved', resolvedBy: 'customer', resolvedAt: new Date(), updatedAt: new Date() }, { merge: true });
          }
        } catch {}
      }
      if (/^(menu|menyu|00|hi|habari)$/i.test(trimmed)) {
        return null; // Let main menu handler show the full menu seamlessly
      }
      return isEn
        ? `[[EN_NATIVE]]🤖 *Papo Hapo Bot is back online!*\nType *Menu* anytime to browse all services.`
        : `🤖 *Umerudi kwa Boti ya Papo Hapo!*\nAndika *Menu* muda wowote kuchagua huduma zetu.`;
    }

    // Forward message to active support ticket for Admin Live Support Desk
    let ticketId = session.details.activeSupportTicketId;
    if (dbAdmin) {
      try {
        if (!ticketId) {
          const tRef = await dbAdmin.collection('support_tickets').add(
            cleanUndefined({
              channel,
              senderId,
              customerName: session.details.customerName || 'Mteja wa WhatsApp',
              customerPhone: normalizePhoneDisplay(lookupPhone),
              status: 'open',
              messages: [{ sender: 'customer', text: trimmed, timestamp: new Date().toISOString() }],
              lastMessage: trimmed,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          );
          ticketId = tRef.id;
          session.details.activeSupportTicketId = ticketId;
          await deps.saveSession(session, dbAdmin);
        } else {
          const tRef = dbAdmin.collection('support_tickets').doc(ticketId);
          const snap = await tRef.get().catch(() => null);
          const prevMsgs = Array.isArray(snap?.data()?.messages) ? snap.data().messages : [];
          await tRef.set(
            cleanUndefined({
              status: 'open',
              lastMessage: trimmed,
              messages: [...prevMsgs.slice(-30), { sender: 'customer', text: trimmed, timestamp: new Date().toISOString() }],
              updatedAt: new Date(),
            }),
            { merge: true }
          );
        }
      } catch {}
    }

    session.details.quickReplyButtons = [{ id: 'CMD:END_HANDOVER', title: isEn ? '🤖 Back to Bot' : '🤖 Rudi kwa Boti' }];
    await deps.saveSession(session, dbAdmin);
    return isEn
      ? `[[EN_NATIVE]]🎧 Message received by our support team. A live agent will reply to you right here on WhatsApp shortly.\n_(Tap *Back to Bot* or send *Menu* anytime to resume automated booking.)_`
      : `🎧 Ujumbe wako umefika kwa timu ya msaada. Mhudumu atakujibu hapa hapa WhatsApp muda si mrefu.\n_(Bonyeza *Rudi kwa Boti* au andika *Menu* kurudi kwenye huduma za boti.)_`;
  }

  if (!isStartHandoverCmd) return null;

  let ticketId = '';
  if (dbAdmin) {
    try {
      const custName = session.details.customerName || 'Mteja wa WhatsApp';
      const tRef = await dbAdmin.collection('support_tickets').add(
        cleanUndefined({
          channel,
          senderId,
          customerName: custName,
          customerPhone: normalizePhoneDisplay(lookupPhone),
          status: 'open',
          messages: [{ sender: 'customer', text: 'Aliomba kuongea na Mhudumu wa Moja kwa Moja', timestamp: new Date().toISOString() }],
          lastMessage: 'Aliomba kuongea na Mhudumu',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
      ticketId = tRef.id;
      await dbAdmin
        .collection('meta_customers')
        .doc(`${channel}_${senderId}`)
        .set({ humanHandover: true, activeSupportTicketId: ticketId, updatedAt: new Date() }, { merge: true })
        .catch(() => {});
      await dbAdmin
        .collection('notifications')
        .add({
          title: '🎧 Mteja Anaomba Mhudumu WhatsApp!',
          message: `${custName} (${normalizePhoneDisplay(lookupPhone)}) amefungua tiketi ya msaada wa moja kwa moja WhatsApp.`,
          type: 'whatsapp_support_handover',
          ticketId,
          senderId,
          read: false,
          createdAt: new Date(),
        })
        .catch(() => {});
    } catch {}
  }

  session.details.humanHandover = true;
  if (ticketId) session.details.activeSupportTicketId = ticketId;
  session.details.quickReplyButtons = [{ id: 'CMD:END_HANDOVER', title: isEn ? '🤖 Back to Bot' : '🤖 Rudi kwa Boti' }];
  await deps.saveSession(session, dbAdmin);

  return isEn
    ? `[[EN_NATIVE]]🎧 *LIVE HUMAN SUPPORT CONNECTED*\n\nType your issue or send a photo/order code below — our customer care team will reply to you directly on WhatsApp.\n\n_(Reply *Menu* or tap *Back to Bot* anytime to return to self-service.)_`
    : `🎧 *UMEUNGANISHWA NA HUDUMA KWA WATEJA*\n\nAndika tatizo lako, namba ya oda au tuma picha hapa — mhudumu wa Papo Hapo atapokea na kukujibu moja kwa moja hapa WhatsApp.\n\n_(Andika *Menu* au bonyeza *Rudi kwa Boti* muda wowote kurudi kwenye boti.)_`;
}

// ============================================================================
// 4. FUNDI HUB INSIDE WHATSAPP (UFUNDI WANGU, JOBS & QUOTE DISPATCH)
// ============================================================================
export async function findApprovedFundiByWhatsApp(dbAdmin: any, senderId: string): Promise<any | null> {
  if (!dbAdmin || !senderId) return null;
  const senderLast9 = partnerPhoneLast9(senderId);
  if (!senderLast9) return null;
  try {
    const snap = await dbAdmin.collection('vendors').where('category', '==', 'handyman').limit(80).get();
    for (const d of snap.docs || []) {
      const v = d.data() || {};
      const st = String(v.status || '').toLowerCase();
      if (st !== 'active' && st !== 'approved' && v.isApproved !== true) continue;
      if (
        partnerPhoneLast9(v.metaSenderId) === senderLast9 ||
        partnerPhoneLast9(v.whatsappNumber) === senderLast9 ||
        partnerPhoneLast9(v.phone) === senderLast9
      ) {
        return { id: d.id, ...v };
      }
    }
  } catch {}
  return null;
}

const notifiedFundiJobs = new Set<string>();

export async function notifyFundisNewJobToWhatsApp(
  params: { orderId: string; orderData: any },
  dbAdmin: any,
  sendOutbound: PartnerBotDeps['sendOutbound']
): Promise<{ notifiedCount: number }> {
  const { orderId, orderData } = params;
  if (!dbAdmin || !orderId || !orderData) return { notifiedCount: 0 };
  if (notifiedFundiJobs.has(orderId) || orderData.fundiWaDispatched === true) return { notifiedCount: 0 };
  const typeLower = String(orderData.type || orderData.vendorCategory || '').toLowerCase();
  if (typeLower !== 'handyman' && typeLower !== 'fundi') return { notifiedCount: 0 };
  notifiedFundiJobs.add(orderId);

  let notifiedCount = 0;
  try {
    const vSnap = await dbAdmin.collection('vendors').where('category', '==', 'handyman').limit(40).get();
    const openFundis = (vSnap.docs || [])
      .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
      .filter((v: any) => {
        const st = String(v.status || '').toLowerCase();
        if (st !== 'active' && st !== 'approved' && v.isApproved !== true) return false;
        if (v.isOpen === false) return false;
        if (orderData.vendorId && orderData.vendorId !== 'papo-hapo-express' && v.id === orderData.vendorId) return true;
        return Boolean(v.metaSenderId || v.whatsappNumber || v.phone);
      });

    const targetFundis =
      orderData.vendorId && openFundis.some((f: any) => f.id === orderData.vendorId)
        ? openFundis.filter((f: any) => f.id === orderData.vendorId)
        : openFundis.slice(0, 6);

    const shortCode = String(orderData.bookingCode || orderId.slice(-6)).toUpperCase().replace(/^#/, '');
    const itemsText = Array.isArray(orderData.items)
      ? orderData.items.map((i: any) => i.name || i.productName).join(', ')
      : 'Huduma ya Ufundi';
    const areaText = orderData.deliveryAddress || orderData.location || 'Dar es Salaam';

    for (const fundi of targetFundis) {
      const waTarget = normalizePartnerWaDigits(fundi.metaSenderId || fundi.whatsappNumber || fundi.phone);
      if (!waTarget) continue;
      const msg =
        `🛠️ *KAZI MPYA YA UFUNDI!* (#${shortCode})\n` +
        `🔧 *Huduma:* ${itemsText}\n` +
        `📍 *Eneo:* ${areaText}\n` +
        `👤 *Mteja:* ${orderData.customerName || 'Mteja'}\n` +
        (orderData.notes ? `📝 *Maelezo:* ${String(orderData.notes).slice(0, 120)}\n` : '') +
        `\n👇 Bonyeza *Kubali Kazi* au *Tuma Bei (Quote)* hapa chini:`;

      const res = await sendOutbound({
        channel: 'whatsapp',
        recipientId: waTarget,
        text: msg,
        interactive: {
          type: 'button',
          header: { type: 'text', text: `🛠️ Kazi Mpya #${shortCode}` },
          body: { text: msg },
          action: {
            buttons: [
              { type: 'reply', reply: { id: `FND_ACCEPT:${orderId}`, title: '✅ Kubali Kazi' } },
              { type: 'reply', reply: { id: `FND_QUOTE:${orderId}`, title: '💰 Tuma Bei' } },
            ],
          },
        },
      }).catch(() => ({ sent: false }));
      if (res.sent) notifiedCount += 1;
    }

    if (notifiedCount > 0) {
      await dbAdmin
        .collection('orders')
        .doc(orderId)
        .update({ fundiWaDispatched: true, fundiWaDispatchedAt: new Date() })
        .catch(() => {});
    }
  } catch {}

  return { notifiedCount };
}

export async function handleFundiHubOrAction(params: {
  senderId: string;
  cleanInput: string;
  dbAdmin: any;
  session: PartnerSessionLike;
  lang: 'sw' | 'en';
  deps: PartnerBotDeps;
}): Promise<string | null> {
  const { senderId, cleanInput, dbAdmin, session, lang, deps } = params;
  const trimmed = cleanInput.trim();
  const isEn = lang === 'en';

  // Customer quote accept/reject actions
  const custQuoteAccept = trimmed.match(/^(?:CMD:)?CUST_ACCEPT_QUOTE:([A-Za-z0-9_-]+)$/i);
  const custQuoteReject = trimmed.match(/^(?:CMD:)?CUST_REJECT_QUOTE:([A-Za-z0-9_-]+)$/i);
  if ((custQuoteAccept || custQuoteReject) && dbAdmin) {
    const orderId = (custQuoteAccept || custQuoteReject)![1];
    const isAcc = Boolean(custQuoteAccept);
    const oRef = dbAdmin.collection('orders').doc(orderId);
    const oSnap = await oRef.get().catch(() => null);
    if (!oSnap?.exists) return `⚠️ Samahani, ombi hili la kazi halipo tena.`;
    const oData = oSnap.data() || {};
    const quoted = Number(oData.quotedPrice || oData.totalAmount || 0);
    await oRef
      .update({
        status: isAcc ? 'accepted' : 'pending',
        quoteAcceptedByCustomer: isAcc,
        ...(isAcc && quoted > 0 ? { totalAmount: quoted, total: quoted } : {}),
        updatedAt: new Date(),
      })
      .catch(() => {});
    const fPhone = normalizePartnerWaDigits(oData.assignedFundiPhone || '');
    if (fPhone) {
      await deps
        .sendOutbound({
          channel: 'whatsapp',
          recipientId: fPhone,
          text: isAcc
            ? `✅ *Mteja Amekubali Bei Yako (TZS ${quoted.toLocaleString()})!*\n📍 *Eneo:* ${oData.deliveryAddress || '-'}\n📞 *Mteja:* ${oData.customerPhone || '-'}\nAnza safari au kazi sasa.`
            : `ℹ️ Mteja hakukubali bei ya TZS ${quoted.toLocaleString()} kwa kazi #${oData.bookingCode || orderId.slice(-6)}.`,
          interactive: isAcc
            ? {
                type: 'button',
                body: { text: `Mteja amekubali bei (TZS ${quoted.toLocaleString()}). Bonyeza ukifika/ukianza kazi:` },
                action: {
                  buttons: [
                    { type: 'reply', reply: { id: `FND_START:${orderId}`, title: '🔧 Kazi Imeanza' } },
                    { type: 'reply', reply: { id: `FND_DONE:${orderId}`, title: '✅ Nimemaliza' } },
                  ],
                },
              }
            : undefined,
        })
        .catch(() => {});
    }
    return isAcc
      ? `✅ *Umekubali bei ya Fundi (TZS ${quoted.toLocaleString()}/=)!*\n🛠️ *Fundi:* ${oData.assignedFundiName || 'Fundi'} amejulishwa na yuko njiani.`
      : `❌ Umekataa bei hiyo. Tumefungua upya ombi lako kwa mafundi wengine.`;
  }

  // Handle Fundi quote entry step
  if (session.step === 'FUNDI_ENTERING_QUOTE' && session.details.activeFundiQuoteOrderId) {
    const orderId = session.details.activeFundiQuoteOrderId;
    const priceDigits = Number(trimmed.replace(/[^\d]/g, ''));
    if (!priceDigits || priceDigits < 2000) {
      return `⚠️ Andika bei sahihi ya TZS (angalau *2,000*, mfano: *25000*):`;
    }
    const fundi = await findApprovedFundiByWhatsApp(dbAdmin, senderId);
    if (!fundi) {
      session.step = 'START';
      delete session.details.activeFundiQuoteOrderId;
      await deps.saveSession(session, dbAdmin);
      return `⚠️ Akaunti yako ya ufundi haikutambulika.`;
    }
    const oRef = dbAdmin.collection('orders').doc(orderId);
    const oSnap = await oRef.get().catch(() => null);
    if (!oSnap?.exists) {
      session.step = 'START';
      delete session.details.activeFundiQuoteOrderId;
      await deps.saveSession(session, dbAdmin);
      return `⚠️ Kazi hii haipo tena.`;
    }
    const oData = oSnap.data() || {};
    await oRef
      .update({
        status: 'quote_sent',
        quotedPrice: priceDigits,
        assignedFundiId: fundi.id,
        assignedFundiName: fundi.businessName || fundi.name || 'Fundi',
        assignedFundiPhone: senderId,
        updatedAt: new Date(),
      })
      .catch(() => {});

    const custPhone = normalizePartnerWaDigits(oData.metaSenderId || oData.customerPhone || '');
    if (custPhone) {
      const shortCode = String(oData.bookingCode || orderId.slice(-6)).toUpperCase().replace(/^#/, '');
      const quoteMsg =
        `🛠️ *FUNDI AMETUMA BEI (QUOTE) — #${shortCode}*\n\n` +
        `👷 *Fundi:* ${fundi.businessName || fundi.name}\n` +
        `💰 *Gharama Aliyopendekeza:* *TZS ${priceDigits.toLocaleString()}/=*\n\n` +
        `Je, unakubali gharama hii aje kufanya kazi?`;
      await deps
        .sendOutbound({
          channel: 'whatsapp',
          recipientId: custPhone,
          text: quoteMsg,
          interactive: {
            type: 'button',
            body: { text: quoteMsg },
            action: {
              buttons: [
                { type: 'reply', reply: { id: `CUST_ACCEPT_QUOTE:${orderId}`, title: '✅ Kubali Bei' } },
                { type: 'reply', reply: { id: `CUST_REJECT_QUOTE:${orderId}`, title: '❌ Kataa' } },
              ],
            },
          },
        })
        .catch(() => {});
    }

    session.step = 'COLLECTING_ROUTE';
    delete session.details.activeFundiQuoteOrderId;
    session.details.quickReplyButtons = [
      { id: 'CMD:FUNDI_HUB', title: '🛠️ Ufundi Wangu' },
      { id: '00', title: '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return `✅ *Bei ya TZS ${priceDigits.toLocaleString()}/= imetumwa kwa mteja!* Utajulishwa WhatsApp akishakubali.`;
  }

  // Action triggers from Fundi buttons
  const acceptMatch = trimmed.match(/^(?:CMD:)?FND_ACCEPT:([A-Za-z0-9_-]+)$/i);
  const quoteMatch = trimmed.match(/^(?:CMD:)?FND_QUOTE:([A-Za-z0-9_-]+)$/i);
  const startMatch = trimmed.match(/^(?:CMD:)?FND_START:([A-Za-z0-9_-]+)$/i);
  const doneMatch = trimmed.match(/^(?:CMD:)?FND_DONE:([A-Za-z0-9_-]+)$/i);

  const isFundiHubCmd = /^(?:🛠️\s*)?(ufundi\s*wangu|fundi\s*hub|kazi\s*za\s*ufundi|CMD:FUNDI_HUB|FUNDI_HUB)$/i.test(trimmed);
  const isFundiToggleCmd = /^(?:CMD:)?FUNDI_TOGGLE_OPEN$/i.test(trimmed);
  const isFundiJobsCmd = /^(?:CMD:)?FUNDI_JOBS$/i.test(trimmed);

  if (!acceptMatch && !quoteMatch && !startMatch && !doneMatch && !isFundiHubCmd && !isFundiToggleCmd && !isFundiJobsCmd) {
    return null;
  }

  const fundi = await findApprovedFundiByWhatsApp(dbAdmin, senderId);
  if (!fundi) {
    session.details.quickReplyButtons = [
      { id: 'CMD:REGISTER_FUNDI', title: '🛠️ Sajili Fundi' },
      { id: '00', title: '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return isEn
      ? `[[EN_NATIVE]]ℹ️ Your number is not linked to an approved Fundi profile yet. Tap *Sajili Fundi* to apply.`
      : `ℹ️ Namba hii bado haijasajiliwa/kuthibitishwa kama *Fundi*. Bonyeza *Sajili Fundi* kujiunga.`;
  }

  if (quoteMatch) {
    session.step = 'FUNDI_ENTERING_QUOTE';
    session.details.activeFundiQuoteOrderId = quoteMatch[1];
    await deps.saveSession(session, dbAdmin);
    return `💰 *Tuma Bei ya Kazi (Quote):*\n\nAndika kiasi cha TZS utakachomtoza mteja (mfano: *25000*):`;
  }

  if (acceptMatch || startMatch || doneMatch) {
    const orderId = (acceptMatch || startMatch || doneMatch)![1];
    const nextStatus = acceptMatch ? 'accepted' : startMatch ? 'in_progress' : 'completed';
    const oRef = dbAdmin.collection('orders').doc(orderId);
    const oSnap = await oRef.get().catch(() => null);
    if (!oSnap?.exists) return `⚠️ Kazi hii haipo tena.`;
    const oData = oSnap.data() || {};
    await oRef
      .update({
        status: nextStatus,
        assignedFundiId: fundi.id,
        assignedFundiName: fundi.businessName || fundi.name,
        assignedFundiPhone: senderId,
        updatedAt: new Date(),
      })
      .catch(() => {});

    await deps
      .notifyCustomerOrderStatus({ orderId, status: nextStatus, orderData: { ...oData, status: nextStatus }, vendorName: fundi.businessName }, dbAdmin)
      .catch(() => {});

    session.details.quickReplyButtons =
      nextStatus === 'accepted'
        ? [
            { id: `FND_START:${orderId}`, title: '🔧 Anza Kazi' },
            { id: `FND_DONE:${orderId}`, title: '✅ Nimemaliza' },
          ]
        : nextStatus === 'in_progress'
        ? [
            { id: `FND_DONE:${orderId}`, title: '✅ Nimemaliza Kazi' },
            { id: 'CMD:FUNDI_HUB', title: '🛠️ Ufundi Wangu' },
          ]
        : [
            { id: 'CMD:FUNDI_JOBS', title: '📋 Kazi Mpya' },
            { id: 'CMD:FUNDI_HUB', title: '🛠️ Ufundi Wangu' },
          ];
    await deps.saveSession(session, dbAdmin);

    return nextStatus === 'accepted'
      ? `✅ *Umekubali kazi ya ufundi!* Mteja *${oData.customerName || 'Mteja'}* (${oData.customerPhone || '-'}) ametumiwa taarifa.\n📍 *Eneo:* ${oData.deliveryAddress || '-'}`
      : nextStatus === 'in_progress'
      ? `🔧 *Kazi imeanza!* Ukishamaliza bonyeza *Nimemaliza Kazi*.`
      : `🎉 *Hongera! Kazi imekamilika.* Mteja amejulishwa!`;
  }

  if (isFundiToggleCmd) {
    const nextOpen = fundi.isOpen === false;
    await dbAdmin.collection('vendors').doc(fundi.id).update({ isOpen: nextOpen, updatedAt: new Date() }).catch(() => {});
    fundi.isOpen = nextOpen;
  }

  const oSnap = await dbAdmin.collection('orders').limit(50).get().catch(() => ({ docs: [] }));
  const fundiOrders = (oSnap.docs || [])
    .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
    .filter((o: any) => String(o.type || '').toLowerCase() === 'handyman' && ['pending', 'accepted', 'quote_sent', 'in_progress'].includes(String(o.status || '').toLowerCase()));

  if (isFundiJobsCmd) {
    const first = fundiOrders[0];
    session.details.quickReplyButtons = first
      ? [
          { id: `FND_ACCEPT:${first.id}`, title: '✅ Kubali #1' },
          { id: `FND_QUOTE:${first.id}`, title: '💰 Tuma Bei' },
          { id: 'CMD:FUNDI_HUB', title: '🛠️ Ufundi Wangu' },
        ]
      : [
          { id: 'CMD:FUNDI_HUB', title: '🛠️ Ufundi Wangu' },
          { id: '00', title: '🏠 Menyu Kuu' },
        ];
    await deps.saveSession(session, dbAdmin);
    if (fundiOrders.length === 0) {
      return `📋 *KAZI ZA UFUNDI*\n\nHakuna kazi mpya ya ufundi kwa sasa. Hakikisha uko *🟢 Wazi* kupokea maombi ya wateja papo hapo.`;
    }
    const listText = fundiOrders
      .slice(0, 5)
      .map((o: any, i: number) => `${i + 1}. *#${o.bookingCode || o.id.slice(-5)}* — ${o.deliveryAddress || 'Dar'} (${o.status})`)
      .join('\n');
    return `🛠️ *KAZI ZA UFUNDI ZILIZOPO (${fundiOrders.length}):*\n\n${listText}\n\nBonyeza kitufe chini kukubali au kutuma bei:`;
  }

  const openBadge = fundi.isOpen === false ? '🔴 Mapumziko' : '🟢 Wazi Kupokea Kazi';
  session.details.quickReplyButtons = [
    { id: 'CMD:FUNDI_TOGGLE_OPEN', title: fundi.isOpen === false ? '🟢 Fungua Kazi' : '🔴 Pumzika' },
    { id: 'CMD:FUNDI_JOBS', title: `📋 Kazi (${fundiOrders.length})` },
    { id: '00', title: '🏠 Menyu Kuu' },
  ];
  await deps.saveSession(session, dbAdmin);

  return (
    `🛠️ *KITUO CHA UFUNDI — ${fundi.businessName || fundi.name}*\n\n` +
    `• *Hali:* ${openBadge}\n` +
    `• *Fani:* ${fundi.specialty || 'Fundi'}\n` +
    `• *Kazi Zinazosubiri:* ${fundiOrders.length}\n\n` +
    `Tumia vitufe chini kusimamia upatikanaji na kazi zako:`
  );
}

// ============================================================================
// 5. SCHEDULED RIDES ("RATIBA") + MULTI-ITEM SHOPPING CART ("KIKAPU") + PROMO BROADCAST
// ============================================================================
export function parseScheduledTimeFromInput(input: string): {
  isScheduled: boolean;
  label: string;
  scheduledAt: Date;
} | null {
  const lower = input.toLowerCase();
  const hasScheduleWord = /\b(kesho|tomorrow|baadaye|baadae|scheduled?|ratiba|leo\s+jioni|leo\s+usiku|asubuhi\s+ijayo)\b/i.test(lower);
  if (!hasScheduleWord) return null;

  const now = new Date();
  const target = new Date(now.getTime());
  const isTomorrow = /\b(kesho|tomorrow|asubuhi\s+ijayo)\b/i.test(lower);
  if (isTomorrow) {
    target.setDate(target.getDate() + 1);
  }

  let hour = 8;
  let min = 0;
  const timeMatch = lower.match(/\b(?:saa\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|asubuhi|mchana|jioni|usiku)?\b/i);
  if (timeMatch) {
    let parsedH = Number(timeMatch[1]);
    min = Number(timeMatch[2] || 0);
    const period = (timeMatch[3] || '').toLowerCase();
    // Handle Swahili clock optionally or standard hours
    if (period === 'pm' || period === 'mchana' || period === 'jioni' || period === 'usiku') {
      if (parsedH < 12 && (period === 'pm' || period === 'jioni' || period === 'usiku')) parsedH += 12;
      else if (period === 'mchana' && parsedH >= 1 && parsedH <= 5) parsedH += 12;
    } else if (!period && !isTomorrow && parsedH >= 1 && parsedH <= 6) {
      parsedH += 12;
    }
    hour = Math.min(23, Math.max(0, parsedH));
  } else if (lower.includes('jioni')) {
    hour = 18;
  } else if (lower.includes('usiku')) {
    hour = 21;
  } else if (lower.includes('mchana')) {
    hour = 13;
  } else if (!isTomorrow) {
    target.setTime(now.getTime() + 60 * 60 * 1000);
    return {
      isScheduled: true,
      label: `Baada ya Saa 1 (${target.toTimeString().slice(0, 5)})`,
      scheduledAt: target,
    };
  }

  target.setHours(hour, min, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  const dayLabel = isTomorrow ? 'Kesho' : 'Leo';
  const hhmm = `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`;
  return {
    isScheduled: true,
    label: `${dayLabel} Saa ${hhmm}`,
    scheduledAt: target,
  };
}

export async function handleScheduledRideFlow(params: {
  senderId: string;
  cleanInput: string;
  channel: PartnerMetaChannel;
  dbAdmin: any;
  session: PartnerSessionLike;
  lang: 'sw' | 'en';
  knownPhone: string;
  defaultWaPhone: string;
  mediaCollector?: Array<{ url: string; caption?: string }>;
  deps: PartnerBotDeps;
}): Promise<string | null> {
  const { senderId, cleanInput, channel, dbAdmin, session, lang, knownPhone, defaultWaPhone, mediaCollector, deps } = params;
  const trimmed = cleanInput.trim();
  const isEn = lang === 'en';
  const lookupPhone = knownPhone || defaultWaPhone || senderId;

  const isStartSchedCmd = /^(?:📅\s*|⏰\s*)?(ratiba|weka\s*ratiba|safari\s*ya\s*baada(?:ye|e)|schedule(\s*ride)?|CMD:SCHEDULE_RIDE|SCHEDULE_RIDE)$/i.test(
    trimmed
  );

  // Detect direct natural language scheduled ride e.g. "Taxi kesho saa 8 kutoka Mwenge kwenda Posta"
  const natTime = !session.step.startsWith('SCHED_') && !session.service ? parseScheduledTimeFromInput(trimmed) : null;
  const hasRideKeyword = /\b(taxi|teksi|bajaji|boda|pikipiki|ride|usafiri|safari)\b/i.test(trimmed);
  const routeMatch = trimmed.match(/(?:kutoka|from)\s+([a-zA-Z0-9\s]+?)\s+(?:kwenda|mpaka|hadi|to)\s+([a-zA-Z0-9\s,]+)$/i);

  if (natTime && (hasRideKeyword || routeMatch)) {
    session.step = 'SCHED_CONFIRM';
    session.details.schedAtIso = natTime.scheduledAt.toISOString();
    session.details.schedLabel = natTime.label;
    session.details.schedPickup = routeMatch ? routeMatch[1].trim() : session.details.lastLocation?.name || 'Kariakoo';
    session.details.schedDest = routeMatch ? routeMatch[2].trim().replace(/\s*(kesho|tomorrow|leo|saa\s+\d+.*)/i, '').trim() : 'Airport (JNIA)';
    session.details.schedVehicle = /boda/i.test(trimmed) ? 'boda' : /bajaji/i.test(trimmed) ? 'bajaji' : 'car';
    session.details.schedFare = session.details.schedVehicle === 'boda' ? 3000 : session.details.schedVehicle === 'bajaji' ? 4500 : 7500;
    session.details.quickReplyButtons = [
      { id: 'SCHED_DO_CONFIRM', title: '✅ Weka Ratiba' },
      { id: '00', title: '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return (
      `📅 *THIBITISHA SAFARI YA RATIBA*\n\n` +
      `🕒 *Muda:* *${session.details.schedLabel}*\n` +
      `📍 *Kutoka:* ${session.details.schedPickup}\n` +
      `🏁 *Kwenda:* ${session.details.schedDest}\n` +
      `🚖 *Usafiri:* ${session.details.schedVehicle.toUpperCase()} • ~TZS ${session.details.schedFare.toLocaleString()}/=\n\n` +
      `Bonyeza *Weka Ratiba* kuthibitisha (utakumbushwa na kuunganishiwa dereva muda ukifika):`
    );
  }

  if (isStartSchedCmd) {
    session.step = 'SCHED_PICKUP';
    session.details.quickReplyButtons = session.details.lastLocation?.name
      ? [{ id: session.details.lastLocation.name, title: `📍 ${session.details.lastLocation.name.slice(0, 17)}` }]
      : [{ id: '00', title: '🏠 Menyu Kuu' }];
    await deps.saveSession(session, dbAdmin);
    return isEn
      ? `[[EN_NATIVE]]📅 *Schedule a Future Ride*\n\nWhere should the driver pick you up? (e.g. *Sinza Mori* or send 📍 Location):`
      : `📅 *WEKA RATIBA YA SAFARI (SCHEDULED RIDE)*\n\nDereva akuchukue *eneo gani*? _(Andika jina la mtaa mf. *Sinza Mori* au tuma 📍 Location)_:`;
  }

  if (session.step === 'SCHED_PICKUP') {
    session.details.schedPickup = trimmed.replace(/^__GPS_PIN__:/, '').split('|')[0] || trimmed;
    session.step = 'SCHED_DEST';
    await deps.saveSession(session, dbAdmin);
    return `📍 *Kutoka:* ${session.details.schedPickup}\n\n🏁 *Unaenda wapi?* (Andika eneo unalokwenda, mfano: *Airport JNIA*):`;
  }

  if (session.step === 'SCHED_DEST') {
    session.details.schedDest = trimmed;
    session.step = 'SCHED_TIME';
    session.details.quickReplyButtons = [
      { id: '1', title: '🌇 Leo Saa 18:00' },
      { id: '2', title: '🌅 Kesho 07:00' },
      { id: '3', title: '☀️ Kesho 13:00' },
    ];
    await deps.saveSession(session, dbAdmin);
    return (
      `🕒 *Chagua Muda wa Safari:*\n\n` +
      `1. 🌇 Leo Jioni (18:00)\n` +
      `2. 🌅 Kesho Asubuhi (07:00)\n` +
      `3. ☀️ Kesho Mchana (13:00)\n\n` +
      `_Au andika muda wako mfano: *Kesho saa 09:30*:`
    );
  }

  if (session.step === 'SCHED_TIME') {
    let chosen: { label: string; scheduledAt: Date };
    const now = new Date();
    if (trimmed === '1') {
      const d = new Date(now.getTime());
      d.setHours(18, 0, 0, 0);
      if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
      chosen = { label: 'Leo Jioni Saa 18:00', scheduledAt: d };
    } else if (trimmed === '2') {
      const d = new Date(now.getTime());
      d.setDate(d.getDate() + 1);
      d.setHours(7, 0, 0, 0);
      chosen = { label: 'Kesho Asubuhi Saa 07:00', scheduledAt: d };
    } else if (trimmed === '3') {
      const d = new Date(now.getTime());
      d.setDate(d.getDate() + 1);
      d.setHours(13, 0, 0, 0);
      chosen = { label: 'Kesho Mchana Saa 13:00', scheduledAt: d };
    } else {
      const parsed = parseScheduledTimeFromInput(trimmed) || parseScheduledTimeFromInput(`kesho ${trimmed}`);
      chosen = parsed
        ? { label: parsed.label, scheduledAt: parsed.scheduledAt }
        : { label: trimmed, scheduledAt: new Date(now.getTime() + 6 * 60 * 60 * 1000) };
    }
    session.details.schedLabel = chosen.label;
    session.details.schedAtIso = chosen.scheduledAt.toISOString();
    session.details.schedVehicle = 'car';
    session.details.schedFare = 7500;
    session.step = 'SCHED_CONFIRM';
    session.details.quickReplyButtons = [
      { id: 'SCHED_DO_CONFIRM', title: '✅ Thibitisha Ratiba' },
      { id: '00', title: '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return (
      `📅 *MUHTASARI WA SAFARI YA RATIBA*\n\n` +
      `🕒 *Muda:* *${chosen.label}*\n` +
      `📍 *Kutoka:* ${session.details.schedPickup}\n` +
      `🏁 *Kwenda:* ${session.details.schedDest}\n` +
      `🚖 *Usafiri:* Teksi • ~TZS 7,500/=\n\n` +
      `Bonyeza *Thibitisha Ratiba* kuhifadhi safari yako:`
    );
  }

  if (session.step === 'SCHED_CONFIRM') {
    if (!/^(?:1|ndio|yes|thibitisha|weka|SCHED_DO_CONFIRM)$/i.test(trimmed)) {
      return `⚠️ Bonyeza *Thibitisha Ratiba* au andika *Ndio* kuhifadhi (au *00* kughairi).`;
    }
    const code = `SCH-${Math.floor(100000 + Math.random() * 900000)}`;
    const pickupName = session.details.schedPickup || 'Dar es Salaam';
    const destName = session.details.schedDest || 'Posta';
    const schedLabel = session.details.schedLabel || 'Kesho';
    const schedAtIso = session.details.schedAtIso || new Date(Date.now() + 3600000).toISOString();
    const fare = Number(session.details.schedFare || 7500);
    let createdId = code;

    if (dbAdmin) {
      try {
        const ref = await dbAdmin.collection('rides').add(
          cleanUndefined({
            status: 'scheduled',
            bookingId: code,
            scheduledForLabel: schedLabel,
            scheduledAtIso: schedAtIso,
            reminderSent: false,
            dispatchedToDrivers: false,
            metaSenderId: senderId,
            metaChannel: channel,
            channel,
            customerId: `meta-client-${senderId}`,
            customerInfo: {
              name: session.details.customerName || 'Mteja wa WhatsApp',
              phone: normalizePhoneDisplay(lookupPhone),
              rating: 4.9,
            },
            pickup: { name: pickupName, address: pickupName },
            destination: { name: destName, address: destName },
            vehicleType: session.details.schedVehicle || 'car',
            fare,
            paymentMethod: 'cash',
            paymentMethodLabel: 'Cash 💵',
            createdAt: new Date(),
          })
        );
        if (ref?.id) createdId = ref.id;
      } catch {}
    }

    const trackUrl = await attachBookingQrMedia(mediaCollector, {
      entityType: 'ride',
      entityId: createdId,
      bookingCode: code,
      title: `Safari ya Ratiba (${schedLabel})`,
      amount: fare,
      subtitle: `${pickupName} ➜ ${destName}`,
    });

    session.step = 'COLLECTING_ROUTE';
    delete session.details.schedPickup;
    delete session.details.schedDest;
    delete session.details.schedLabel;
    delete session.details.schedAtIso;
    session.details.quickReplyButtons = [
      { id: 'CMD:MY_ORDERS', title: '📋 Oda Zangu' },
      { id: '00', title: '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);

    return (
      `✅ *SAFARI YA RATIBA IMEHIFADHIWA!* (#${code})\n\n` +
      `🕒 *Muda:* *${schedLabel}*\n` +
      `📍 *Njia:* ${pickupName} ➜ ${destName}\n` +
      `💰 *Kadirio la Nauli:* TZS ${fare.toLocaleString()}/=\n\n` +
      `⏰ Tutakutumia ukumbusho na kuwatafuta madereva dakika 30 kabla ya muda wako.\n🔗 Fuatilia: ${trackUrl}`
    );
  }

  return null;
}

export async function processDueScheduledBookings(
  dbAdmin: any,
  sendOutbound: PartnerBotDeps['sendOutbound']
): Promise<{ processed: number }> {
  if (!dbAdmin) return { processed: 0 };
  let processed = 0;
  try {
    const snap = await dbAdmin.collection('rides').where('status', '==', 'scheduled').limit(30).get();
    const now = Date.now();
    const windowMs = 30 * 60 * 1000;

    for (const d of snap.docs || []) {
      const ride = d.data() || {};
      const schedTs = Date.parse(String(ride.scheduledAtIso || ''));
      if (Number.isNaN(schedTs)) continue;
      if (schedTs - now <= windowMs && now - schedTs <= 4 * 60 * 60 * 1000) {
        await dbAdmin
          .collection('rides')
          .doc(d.id)
          .update({
            status: 'pending',
            reminderSent: true,
            dispatchedToDrivers: true,
            updatedAt: new Date(),
          })
          .catch(() => {});

        if (ride.metaSenderId) {
          await (sendOutbound as any)({
            channel: (ride.metaChannel || 'whatsapp') as PartnerMetaChannel,
            recipientId: ride.metaSenderId,
            text:
              `⏰ *UKUMBUSHO WA SAFARI YAKO YA RATIBA!*\n\n` +
              `🔖 *#${ride.bookingId || d.id.slice(-6)}* • *${ride.scheduledForLabel || 'Sasa'}*\n` +
              `📍 ${ride.pickup?.name || '-'} ➜ ${ride.destination?.name || '-'}\n\n` +
              `📡 Tunawaunganisha madereva wa karibu sasa hivi! Utapokea taarifa dereva akipokea.`,
            templateFallback: {
              category: 'utility',
              bodyParams: [String(ride.bookingId || d.id.slice(-6)), String(ride.scheduledForLabel || 'Sasa')],
            },
          }).catch(() => {});
        }
        await notifyDriversNewJobToWhatsApp(
          { jobType: 'ride', jobId: d.id, jobData: { ...ride, status: 'pending' } },
          dbAdmin,
          sendOutbound
        ).catch(() => {});
        processed += 1;
      }
    }
  } catch {}
  return { processed };
}

// ============================================================================
// 5B. MULTI-ITEM WHATSAPP CART & CATALOG BROWSING ("KATALOGI" / "KIKAPU")
// ============================================================================
export async function handleMultiItemCatalogCart(params: {
  senderId: string;
  cleanInput: string;
  channel: PartnerMetaChannel;
  dbAdmin: any;
  session: PartnerSessionLike;
  lang: 'sw' | 'en';
  knownPhone: string;
  defaultWaPhone: string;
  mediaCollector?: Array<{ url: string; caption?: string }>;
  deps: PartnerBotDeps;
}): Promise<string | null> {
  const { senderId, cleanInput, channel, dbAdmin, session, lang, knownPhone, defaultWaPhone, mediaCollector, deps } = params;
  const trimmed = cleanInput.trim();
  const isEn = lang === 'en';
  const lookupPhone = knownPhone || defaultWaPhone || senderId;

  const isCatalogOpenCmd = /^(?:🛍️\s*|📦\s*)?(katalogi|catalog|catalogue|duka\s*la\s*picha|nunua\s*nyingi|CMD:OPEN_CATALOG|OPEN_CATALOG)(?:\s+(.+))?$/i.test(
    trimmed
  );
  const isViewCartCmd = /^(?:🛒\s*)?(kikapu(\s*changu)?|cart|view\s*cart|my\s*cart|CMD:VIEW_CART|VIEW_CART)$/i.test(trimmed);
  const isClearCartCmd = /^(?:🧹\s*)?(safisha\s*kikapu|clear\s*cart|CMD:CLEAR_CART)$/i.test(trimmed);
  const isCheckoutCartCmd = /^(?:✅\s*|💳\s*)?(lipia\s*kikapu|checkout(\s*cart)?|maliza\s*kikapu|CMD:CHECKOUT_CART)$/i.test(trimmed);
  const removeMatch = trimmed.match(/^(?:ondoa|remove)\s+(\d{1,2})$/i);
  const addCartMatch = trimmed.match(/^(?:ongeza|add)\s+(\d{1,2})(?:\s+(\d{1,2}))?$/i) || trimmed.match(/^(?:CMD:)?CAT_ADD:([A-Za-z0-9_-]+)$/i);

  const getCart = (): Array<{ id: string; name: string; price: number; quantity: number; vendorId?: string; vendorName?: string }> =>
    Array.isArray(session.details.unifiedCart) ? session.details.unifiedCart : [];

  if (isClearCartCmd) {
    session.details.unifiedCart = [];
    await deps.saveSession(session, dbAdmin);
    return `🧹 Kikapu kimesafishwa! Andika *Katalogi* kuchagua bidhaa mpya.`;
  }

  if (removeMatch) {
    const idx = Number(removeMatch[1]) - 1;
    const cart = [...getCart()];
    if (idx < 0 || idx >= cart.length) {
      return `⚠️ Namba ya bidhaa *${removeMatch[1]}* haipo kikapuni.`;
    }
    const removed = cart.splice(idx, 1)[0];
    session.details.unifiedCart = cart;
    await deps.saveSession(session, dbAdmin);
    const total = cart.reduce((s, c) => s + c.price * c.quantity, 0);
    return `🗑️ *${removed.name}* imeondolewa kikapuni. Jumla sasa: *TZS ${total.toLocaleString()}/=* (${cart.length} bidhaa).`;
  }

  if (isViewCartCmd) {
    const cart = getCart();
    if (cart.length === 0) {
      session.details.quickReplyButtons = [
        { id: 'CMD:OPEN_CATALOG', title: '🛍️ Fungua Katalogi' },
        { id: '00', title: '🏠 Menyu Kuu' },
      ];
      await deps.saveSession(session, dbAdmin);
      return `🛒 Kikapu chako hakina bidhaa bado! Bonyeza *Fungua Katalogi* kuongeza vitu.`;
    }
    const total = cart.reduce((s, c) => s + c.price * c.quantity, 0);
    const lines = cart.map((c, i) => `${i + 1}. *${c.name}* x${c.quantity} — TZS ${(c.price * c.quantity).toLocaleString()}`).join('\n');
    session.details.quickReplyButtons = [
      { id: 'CMD:CHECKOUT_CART', title: '💳 Lipia Kikapu' },
      { id: 'CMD:OPEN_CATALOG', title: '➕ Ongeza Zaidi' },
      { id: 'CMD:CLEAR_CART', title: '🧹 Safisha' },
    ];
    await deps.saveSession(session, dbAdmin);
    return (
      `🛒 *KIKAPU CHAKO (${cart.length} Bidhaa):*\n\n${lines}\n\n` +
      `💰 *Jumla:* *TZS ${total.toLocaleString()}/=*\n\n` +
      `Bonyeza *Lipia Kikapu* kuagiza sasa, *Ongeza Zaidi*, au andika *ONDOA 1* kuondoa bidhaa:`
    );
  }

  if (isCheckoutCartCmd) {
    const cart = getCart();
    if (cart.length === 0) {
      return `🛒 Kikapu chako kiko tupu. Andika *Katalogi* kuchagua bidhaa kwanza.`;
    }
    const total = cart.reduce((s, c) => s + c.price * c.quantity, 0);
    session.details.mallTotal = total;
    session.details.selectedPrice = total;
    session.details.selectedVendorId = cart[0].vendorId || 'papo-mall-official';
    session.details.selectedVendorName = cart[0].vendorName || 'Papo Hapo Store';
    session.details.selectedName = cart.map((c) => `${c.name} x${c.quantity}`).join(', ');
    session.step = 'CART_WAIT_ADDRESS';
    session.details.quickReplyButtons = session.details.lastLocation?.name
      ? [{ id: session.details.lastLocation.name, title: `📍 ${session.details.lastLocation.name.slice(0, 17)}` }]
      : [{ id: '00', title: '🏠 Menyu Kuu' }];
    await deps.saveSession(session, dbAdmin);
    return `📍 *KIKAPU — TZS ${total.toLocaleString()}/=*\n\nTuma *eneo/mtaa wa kuletewa* mzigo wako (au tuma 📍 *Location*):`;
  }

  if (session.step === 'CART_WAIT_ADDRESS') {
    const addr = trimmed.replace(/^__GPS_PIN__:/, '').split('|')[0] || trimmed;
    session.details.cartDeliveryAddress = addr;
    session.step = 'CART_WAIT_PAYMENT';
    session.details.quickReplyButtons = [
      { id: '1', title: '💵 Cash' },
      { id: '2', title: '📱 M-Pesa' },
      { id: '3', title: '📱 Tigo Pesa' },
    ];
    await deps.saveSession(session, dbAdmin);
    const total = Number(session.details.mallTotal || 0);
    return (
      `📍 *Eneo:* ${addr}\n💰 *Jumla:* *TZS ${total.toLocaleString()}/=*\n\n` +
      `💳 *Chagua Njia ya Malipo:*\n1. 💵 Cash\n2. 📱 M-Pesa\n3. 📱 Tigo Pesa\n4. 📱 Airtel Money\n\n` +
      `_(Unaweza pia kuandika *KUPONI KODI* au *KOMBOA* kabla ya kuchagua malipo)_`
    );
  }

  if (session.step === 'CART_WAIT_PAYMENT') {
    // Allow promo or redeem inside cart payment step too
    const lower = trimmed.toLowerCase();
    let payMethod = '';
    let payLabel = '';
    if (lower === '1' || lower.includes('cash') || lower.includes('taslimu')) {
      payMethod = 'cash';
      payLabel = 'Cash 💵';
    } else if (lower === '2' || lower.includes('mpesa') || lower.includes('m-pesa')) {
      payMethod = 'mpesa';
      payLabel = 'M-Pesa 📱';
    } else if (lower === '3' || lower.includes('tigo') || lower.includes('yas')) {
      payMethod = 'tigopesa';
      payLabel = 'Tigo Pesa 📱';
    } else if (lower === '4' || lower.includes('airtel')) {
      payMethod = 'airtelmoney';
      payLabel = 'Airtel Money 📱';
    } else {
      return `⚠️ Chagua *1* (Cash), *2* (M-Pesa), *3* (Tigo Pesa), au *4* (Airtel Money).`;
    }

    const cart = getCart();
    const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
    const discountTotal = Math.min(subtotal, Number(session.details.promoDiscount || 0) + Number(session.details.redeemDiscount || 0));
    const finalTotal = Math.max(0, subtotal - discountTotal);
    const code = `CT-${Math.floor(1000 + Math.random() * 9000)}`;
    const vendorId = cart[0]?.vendorId || 'papo-mall-official';
    const vendorName = cart[0]?.vendorName || 'Papo Hapo Store';
    const deliveryAddress = session.details.cartDeliveryAddress || 'Dar es Salaam';

    const orderId = await deps.triggerAutomatedOrder(
      dbAdmin,
      vendorId,
      'ecommerce',
      cart,
      finalTotal,
      lookupPhone,
      session.details.customerName || 'Mteja wa WhatsApp',
      `WhatsApp Multi-Item Cart #${code} | ${deliveryAddress}`,
      channel,
      {
        bookingCode: code,
        vendorName,
        deliveryAddress,
        orderType: 'delivery',
        paymentMethod: payMethod,
        paymentMethodLabel: payLabel,
        metaSenderId: senderId,
        metaChannel: channel,
        ...(discountTotal > 0 ? { discountAmount: discountTotal, couponCode: session.details.appliedPromoCode } : {}),
      }
    );

    if (session.details.redeemPointsUsed || session.details.redeemRewardVendorId) {
      await deductRedeemedLoyaltyPoints(dbAdmin, {
        customerPhone: lookupPhone,
        pointsUsed: session.details.redeemPointsUsed,
        redeemRewardVendorId: session.details.redeemRewardVendorId,
      }).catch(() => {});
    }
    await processReferralRewardOnOrder(
      dbAdmin,
      {
        senderId,
        channel,
        customerPhone: lookupPhone,
        customerName: session.details.customerName || 'Mteja',
      },
      deps.sendOutbound
    ).catch(() => {});

    const verifyUrl = await attachBookingQrMedia(mediaCollector, {
      entityType: 'order',
      entityId: orderId || code,
      bookingCode: code,
      title: `Kikapu (${vendorName})`,
      amount: finalTotal,
      subtitle: cart.map((c) => `${c.name} x${c.quantity}`).join(', '),
    });

    session.step = 'COLLECTING_ROUTE';
    session.details.unifiedCart = [];
    delete session.details.cartDeliveryAddress;
    delete session.details.promoDiscount;
    delete session.details.redeemDiscount;
    delete session.details.redeemPointsUsed;
    delete session.details.redeemRewardVendorId;
    session.details.quickReplyButtons = [
      { id: 'CMD:MY_ORDERS', title: '📋 Oda Zangu' },
      { id: '00', title: '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);

    return (
      `🎉 *ODA YA KIKAPU IMEPOKELEWA!* (#${code})\n\n` +
      `🛒 *Vitu:* ${cart.map((c) => `${c.name} x${c.quantity}`).join(', ')}\n` +
      (discountTotal > 0 ? `🎁 *Punguzo:* -TZS ${discountTotal.toLocaleString()}/=\n` : '') +
      `💰 *Jumla:* *TZS ${finalTotal.toLocaleString()}/=*\n` +
      `💳 *Malipo:* ${payLabel}\n` +
      `📍 *Eneo:* ${deliveryAddress}\n\n` +
      `🔗 *Risiti & Ufuatiliaji:* ${verifyUrl}`
    );
  }

  if (isCatalogOpenCmd || session.step === 'CATALOG_BROWSE') {
    if (session.step === 'CATALOG_BROWSE' && (addCartMatch || /^\d{1,2}$/.test(trimmed))) {
      const options: any[] = Array.isArray(session.details.catalogBrowseOptions) ? session.details.catalogBrowseOptions : [];
      let picked: any = null;
      let qty = 1;
      if (addCartMatch && addCartMatch[1] && !trimmed.startsWith('CAT_ADD:') && !trimmed.startsWith('CMD:CAT_ADD:')) {
        picked = options[Number(addCartMatch[1]) - 1];
        qty = Math.max(1, Number(addCartMatch[2] || 1));
      } else if (trimmed.startsWith('CAT_ADD:') || trimmed.startsWith('CMD:CAT_ADD:')) {
        const pid = trimmed.replace(/^(?:CMD:)?CAT_ADD:/i, '');
        picked = options.find((p) => p.id === pid);
      } else {
        picked = options[Number(trimmed) - 1];
      }

      if (picked) {
        const cart = [...getCart()];
        const existing = cart.find((c) => c.id === picked.id);
        if (existing) existing.quantity += qty;
        else
          cart.push({
            id: picked.id,
            name: picked.name,
            price: Number(picked.price || 5000),
            quantity: qty,
            vendorId: picked.vendorId || 'papo-mall-official',
            vendorName: picked.vendorName || 'Papo Hapo Store',
          });
        session.details.unifiedCart = cart;
        const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
        session.details.quickReplyButtons = [
          { id: 'CMD:VIEW_CART', title: `🛒 Kikapu (${cart.length})` },
          { id: 'CMD:CHECKOUT_CART', title: '💳 Lipia Sasa' },
          { id: '00', title: '🏠 Menyu Kuu' },
        ];
        await deps.saveSession(session, dbAdmin);
        return (
          `✅ *${picked.name}* x${qty} imeongezwa kikapuni!\n` +
          `🛒 *Jumla ya Kikapu (${cart.length} bidhaa):* *TZS ${cartTotal.toLocaleString()}/=*\n\n` +
          `Andika namba nyingine kuongeza bidhaa, bonyeza *Kikapu*, au *Lipia Sasa*:`
        );
      }
    }

    if (!isCatalogOpenCmd) return null;

    const queryFilter = trimmed.replace(/^(?:🛍️\s*|📦\s*)?(?:katalogi|catalog|catalogue|duka\s*la\s*picha|nunua\s*nyingi|CMD:OPEN_CATALOG|OPEN_CATALOG)\s*/i, '').trim().toLowerCase();
    let products: any[] = [];
    if (dbAdmin) {
      try {
        const pSnap = await dbAdmin.collection('products').limit(50).get();
        products = (pSnap.docs || [])
          .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
          .filter((p: any) => p.inStock !== false && p.available !== false && (!queryFilter || String(p.name || '').toLowerCase().includes(queryFilter)));
      } catch {}
    }
    if (products.length === 0) {
      products = [
        { id: 'cat-1', name: 'Chips Kuku Choma + Soda', price: 9500, vendorId: 'papo-food-official', vendorName: 'PapoFast Food', imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80' },
        { id: 'cat-2', name: 'Biryani ya Ng\'ombe Special', price: 11000, vendorId: 'papo-food-official', vendorName: 'Swahili Cuisine', imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80' },
        { id: 'cat-3', name: 'Sneakers Classic Original', price: 45000, vendorId: 'papo-mall-official', vendorName: 'PapoMall Store', imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80' },
        { id: 'cat-4', name: 'Smart Watch Ultra Pro', price: 65000, vendorId: 'papo-mall-official', vendorName: 'PapoMall Store', imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80' },
      ];
    }

    const pickedList = products.slice(0, 6);
    if (Array.isArray(mediaCollector)) {
      for (let i = 0; i < Math.min(4, pickedList.length); i++) {
        const it = pickedList[i];
        const img = it.imageUrl || it.image || it.photoUrl;
        if (img && String(img).startsWith('http')) {
          mediaCollector.push({ url: img, caption: `*${i + 1}. ${it.name}* — TZS ${Number(it.price || 0).toLocaleString()}` });
        }
      }
    }

    session.step = 'CATALOG_BROWSE';
    session.details.catalogBrowseOptions = pickedList;
    const cartCount = getCart().length;
    session.details.quickReplyButtons = [
      ...(pickedList[0] ? [{ id: `CAT_ADD:${pickedList[0].id}`, title: `➕ ${String(pickedList[0].name).slice(0, 16)}` }] : []),
      ...(pickedList[1] ? [{ id: `CAT_ADD:${pickedList[1].id}`, title: `➕ ${String(pickedList[1].name).slice(0, 16)}` }] : []),
      { id: cartCount > 0 ? 'CMD:VIEW_CART' : '00', title: cartCount > 0 ? `🛒 Kikapu (${cartCount})` : '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);

    const listStr = pickedList.map((p, i) => `*${i + 1}. ${p.name}* — TZS ${Number(p.price || 0).toLocaleString()}/=`).join('\n');
    return (
      `🛍️ *KATALOGI YA PAPO HAPO (CHAGUA BIDHAA NYINGI)*\n\n` +
      `${listStr}\n\n` +
      `Andika namba (*1–${pickedList.length}*) au *ONGEZA 1 2* (namba + idadi) kuweka kikapuni, kisha bonyeza *Kikapu* kulipia kwa pamoja!`
    );
  }

  return null;
}

// ============================================================================
// 5C. OPT-IN PROMO TOGGLE & ADMIN PROMO BROADCAST SENDER
// ============================================================================
export async function handlePromoOptInToggle(params: {
  senderId: string;
  cleanInput: string;
  channel: PartnerMetaChannel;
  dbAdmin: any;
}): Promise<string | null> {
  const trimmed = params.cleanInput.trim();
  const stopMatch = /^(?:acha\s*matangazo|stop\s*promo|unsubscribe\s*promo|zima\s*ofa)$/i.test(trimmed);
  const startMatch = /^(?:ruhusu\s*ofa|ruhusu\s*matangazo|start\s*promo|subscribe\s*promo)$/i.test(trimmed);
  if (!stopMatch && !startMatch) return null;

  const optIn = startMatch;
  if (params.dbAdmin) {
    await params.dbAdmin
      .collection('meta_customers')
      .doc(`${params.channel}_${params.senderId}`)
      .set({ promoOptIn: optIn, updatedAt: new Date() }, { merge: true })
      .catch(() => {});
  }
  return optIn
    ? `🔔 *Umefungua Taarifa za Ofa!* Utapokea kuponi za punguzo na ofa za msimu kupitia WhatsApp.`
    : `🔕 *Umeondoa Taarifa za Matangazo.* Hutapokea ujumbe wa matangazo tena (andika *RUHUSU OFA* wakati wowote kurudisha).`;
}

export async function sendWhatsAppPromoBroadcast(
  dbAdmin: any,
  sendOutbound: PartnerBotDeps['sendOutbound'],
  params: {
    message: string;
    audience?: 'all' | 'customers' | 'drivers' | 'vendors';
    couponCode?: string;
    channel?: PartnerMetaChannel;
    dryRun?: boolean;
  }
): Promise<{
  totalTargets: number;
  sentCount: number;
  failedCount: number;
  templateFallbackCount: number;
  audience: string;
  recipientsPreview: string[];
}> {
  const cleanMsg = String(params.message || '').trim();
  if (!cleanMsg) throw new Error('Broadcast message is required');
  const audience = params.audience || 'all';
  const targetChannel: PartnerMetaChannel = params.channel || 'whatsapp';

  const targets = new Map<string, string>(); // phoneDigits -> name
  if (dbAdmin) {
    if (audience === 'all' || audience === 'customers') {
      const cSnap = await dbAdmin.collection('meta_customers').limit(150).get().catch(() => ({ docs: [] }));
      for (const d of cSnap.docs || []) {
        const c = d.data() || {};
        if (c.blocked === true || c.promoOptIn === false) continue;
        if (c.channel && c.channel !== targetChannel) continue;
        const rid = String(c.senderId || c.phone || '').trim();
        if (rid) targets.set(rid, c.name || 'Mteja');
      }
    }
    if (audience === 'all' || audience === 'drivers') {
      const uSnap = await dbAdmin.collection('users').limit(150).get().catch(() => ({ docs: [] }));
      for (const d of uSnap.docs || []) {
        const u = d.data() || {};
        if (u.role !== 'rider' && u.role !== 'driver') continue;
        const ph = normalizePartnerWaDigits(u.metaSenderId || u.whatsappNumber || u.phone);
        if (ph) targets.set(ph, u.name || 'Dereva');
      }
    }
    if (audience === 'all' || audience === 'vendors') {
      const vSnap = await dbAdmin.collection('vendors').limit(150).get().catch(() => ({ docs: [] }));
      for (const d of vSnap.docs || []) {
        const v = d.data() || {};
        const ph = normalizePartnerWaDigits(v.metaSenderId || v.whatsappNumber || v.phone);
        if (ph) targets.set(ph, v.businessName || v.name || 'Muuzaji');
      }
    }
  }

  const promoFooter = params.couponCode
    ? `\n\n🎟️ Tumia kuponi *${params.couponCode.toUpperCase()}* unapolipa kupitia WhatsApp (andika *KUPONI ${params.couponCode.toUpperCase()}*).`
    : `\n\n_Andika *ACHA MATANGAZO* kuacha kupokea taarifa hizi._`;

  const entries = Array.from(targets.entries()).slice(0, 120);
  let sentCount = 0;
  let failedCount = 0;
  let templateFallbackCount = 0;

  if (!params.dryRun) {
    for (const [rid, name] of entries) {
      const personalText = `🔥 *Habari ${name}!*\n\n${cleanMsg}${promoFooter}`;
      const r: any = await (sendOutbound as any)({
        channel: targetChannel,
        recipientId: rid,
        text: personalText,
        templateFallback: {
          category: 'marketing',
          bodyParams: [name, cleanMsg.slice(0, 220)],
        },
      }).catch(() => ({ sent: false }));
      if (r.sent) {
        sentCount += 1;
        if (r.usedTemplate) templateFallbackCount += 1;
      } else {
        failedCount += 1;
      }
    }

    if (dbAdmin) {
      await dbAdmin
        .collection('broadcast_logs')
        .add(
          cleanUndefined({
            channel: targetChannel,
            audience,
            message: cleanMsg,
            couponCode: params.couponCode || undefined,
            totalTargets: entries.length,
            sentCount,
            failedCount,
            templateFallbackCount,
            createdAt: new Date(),
          })
        )
        .catch(() => {});
    }
  }

  return {
    totalTargets: entries.length,
    sentCount: params.dryRun ? entries.length : sentCount,
    failedCount,
    templateFallbackCount,
    audience,
    recipientsPreview: entries.slice(0, 10).map(([rid, nm]) => `${nm} (${rid})`),
  };
}

// ============================================================================
// 6. META 24-HOUR WINDOW APPROVED TEMPLATE SETTINGS & FALLBACK CONFIG
// ============================================================================
export interface MetaTemplateSettings {
  enable24hTemplateFallback: boolean;
  templateLanguageCode: string;
  utilityTemplateName: string;
  marketingTemplateName: string;
  safetyTemplateName: string;
  updatedAt?: number;
}

export const DEFAULT_META_TEMPLATE_SETTINGS: MetaTemplateSettings = {
  enable24hTemplateFallback: true,
  templateLanguageCode: 'sw',
  utilityTemplateName: 'papohapo_order_update',
  marketingTemplateName: 'papohapo_promo_offer',
  safetyTemplateName: 'papohapo_safety_alert',
};

let cachedMetaTemplateSettings: MetaTemplateSettings | null = null;

function sanitizeMetaTemplateSettings(raw: any): MetaTemplateSettings {
  const src = raw && typeof raw === 'object' ? raw : {};
  const cleanName = (val: any, defVal: string) =>
    String(val ?? defVal)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 128) || defVal;
  return {
    enable24hTemplateFallback: src.enable24hTemplateFallback !== false,
    templateLanguageCode: String(src.templateLanguageCode || DEFAULT_META_TEMPLATE_SETTINGS.templateLanguageCode).trim() || 'sw',
    utilityTemplateName: cleanName(src.utilityTemplateName, DEFAULT_META_TEMPLATE_SETTINGS.utilityTemplateName),
    marketingTemplateName: cleanName(src.marketingTemplateName, DEFAULT_META_TEMPLATE_SETTINGS.marketingTemplateName),
    safetyTemplateName: cleanName(src.safetyTemplateName, DEFAULT_META_TEMPLATE_SETTINGS.safetyTemplateName),
    updatedAt: typeof src.updatedAt === 'number' ? src.updatedAt : Date.now(),
  };
}

export async function getMetaTemplateSettings(dbAdmin?: any): Promise<MetaTemplateSettings> {
  if (dbAdmin) {
    try {
      const snap = await dbAdmin.collection('config').doc('meta_templates').get();
      if (snap.exists) {
        const sanitized = sanitizeMetaTemplateSettings(snap.data());
        cachedMetaTemplateSettings = sanitized;
        return sanitized;
      }
    } catch {}
  }
  if (cachedMetaTemplateSettings) return cachedMetaTemplateSettings;
  try {
    const fs = await import('fs');
    const path = await import('path');
    const localPath = path.join(process.cwd(), 'meta_config.json');
    if (fs.existsSync(localPath)) {
      const parsed = JSON.parse(fs.readFileSync(localPath, 'utf8'));
      if (parsed?.templateSettings) {
        const sanitized = sanitizeMetaTemplateSettings(parsed.templateSettings);
        cachedMetaTemplateSettings = sanitized;
        return sanitized;
      }
    }
  } catch {}
  return sanitizeMetaTemplateSettings(DEFAULT_META_TEMPLATE_SETTINGS);
}

export async function saveMetaTemplateSettings(
  partial: Partial<MetaTemplateSettings>,
  dbAdmin?: any
): Promise<MetaTemplateSettings> {
  const current = await getMetaTemplateSettings(dbAdmin);
  const merged = sanitizeMetaTemplateSettings({
    ...current,
    ...partial,
    updatedAt: Date.now(),
  });
  cachedMetaTemplateSettings = merged;

  if (dbAdmin) {
    try {
      await dbAdmin.collection('config').doc('meta_templates').set(cleanUndefined(merged), { merge: true });
    } catch {}
  }
  try {
    const fs = await import('fs');
    const path = await import('path');
    const localPath = path.join(process.cwd(), 'meta_config.json');
    let existing: Record<string, any> = {};
    if (fs.existsSync(localPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(localPath, 'utf8')) || {};
      } catch {
        existing = {};
      }
    }
    existing.templateSettings = merged;
    fs.writeFileSync(localPath, JSON.stringify(existing, null, 2), 'utf8');
  } catch {}

  return merged;
}

export function buildMetaTemplateWirePayload(params: {
  recipientId: string;
  templateName: string;
  languageCode?: string;
  bodyParams?: string[];
}): Record<string, any> {
  const bodyParams = (params.bodyParams || []).map((v) => String(v || '').trim()).filter(Boolean);
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: params.recipientId,
    type: 'template',
    template: {
      name: params.templateName,
      language: { code: params.languageCode || 'sw' },
      ...(bodyParams.length > 0
        ? {
            components: [
              {
                type: 'body',
                parameters: bodyParams.slice(0, 6).map((txt) => ({
                  type: 'text',
                  text: txt.slice(0, 500),
                })),
              },
            ],
          }
        : {}),
    },
  };
}

// ============================================================================
// 7. ABANDONED CART & UNFINISHED BOOKING RECOVERY
// ============================================================================
const ABANDONED_CHECKOUT_STEPS = new Set([
  'SELECTING_VEHICLE',
  'CONFIRMING_TRIP',
  'SELECTING_PAYMENT_METHOD',
  'CART_WAIT_ADDRESS',
  'CART_WAIT_PAYMENT',
  'FOOD_DELIVERY_ADDRESS',
  'MALL_DELIVERY_ADDRESS',
  'SCHED_CONFIRM',
]);

export async function processAbandonedSessionsRecovery(
  dbAdmin: any,
  sendOutbound: PartnerBotDeps['sendOutbound'],
  options?: { minIdleMs?: number; maxIdleMs?: number; dryRun?: boolean }
): Promise<{
  checked: number;
  eligible: number;
  sentCount: number;
  preview: Array<{ sessionId: string; senderId: string; name: string; summary: string; idleMinutes: number }>;
}> {
  if (!dbAdmin) return { checked: 0, eligible: 0, sentCount: 0, preview: [] };
  const minIdleMs = Math.max(0, Number(options?.minIdleMs ?? 15 * 60 * 1000));
  const maxIdleMs = Math.max(minIdleMs + 60_000, Number(options?.maxIdleMs ?? 24 * 60 * 60 * 1000));
  const now = Date.now();

  let checked = 0;
  let eligible = 0;
  let sentCount = 0;
  const preview: Array<{ sessionId: string; senderId: string; name: string; summary: string; idleMinutes: number }> = [];

  try {
    let snap: any;
    try {
      snap = await dbAdmin
        .collection('meta_sessions')
        .where('lastUpdated', '>=', now - maxIdleMs)
        .limit(250)
        .get();
    } catch {
      snap = await dbAdmin.collection('meta_sessions').limit(250).get();
    }
    for (const d of snap.docs || []) {
      checked += 1;
      const s = d.data() || {};
      const senderId = String(s.senderId || '').trim();
      const channel = (s.channel === 'messenger' || s.channel === 'instagram' ? s.channel : 'whatsapp') as PartnerMetaChannel;
      if (!senderId) continue;

      const details = s.details || {};
      if (details.abandonedReminderSent === true || details.humanHandover === true) continue;

      const lastUpdated = normEpoch(s.lastUpdated);
      if (!lastUpdated) continue;
      const idleMs = now - lastUpdated;
      if (idleMs < minIdleMs || idleMs > maxIdleMs) continue;

      const unifiedCart: any[] = Array.isArray(details.unifiedCart) ? details.unifiedCart : [];
      const foodCart: any[] = Array.isArray(details.foodCart) ? details.foodCart : [];
      const hasCart = unifiedCart.length > 0 || foodCart.length > 0;
      const inPausedStep = ABANDONED_CHECKOUT_STEPS.has(String(s.step || ''));
      if (!hasCart && !inPausedStep) continue;

      eligible += 1;
      const custName = details.customerName || 'Mteja';
      const activeCart = unifiedCart.length > 0 ? unifiedCart : foodCart;
      let summaryText = '';
      let buttons: Array<{ id: string; title: string }> = [
        { id: '0', title: '▶️ Endelea' },
        { id: '00', title: '🏠 Menyu Kuu' },
      ];

      if (activeCart.length > 0) {
        const total = activeCart.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 1), 0);
        const firstItems = activeCart
          .slice(0, 2)
          .map((it) => `${it.name || it.productName} x${it.quantity || 1}`)
          .join(', ');
        summaryText = `Kikapu chako (${activeCart.length} bidhaa: ${firstItems}${activeCart.length > 2 ? ', ...' : ''}) chenye thamani ya *TZS ${total.toLocaleString()}/=*`;
        if (unifiedCart.length > 0) {
          buttons = [
            { id: 'CMD:VIEW_CART', title: '🛒 Fungua Kikapu' },
            { id: 'CMD:CHECKOUT_CART', title: '💳 Lipia Sasa' },
            { id: 'CMD:CLEAR_CART', title: '🧹 Safisha' },
          ];
        }
      } else if (details.pickup || details.schedPickup) {
        const pName = details.pickup?.name || details.schedPickup || 'Pickup';
        const dName = details.destination?.name || details.schedDest || 'Destination';
        summaryText = `Safari yako kutoka *${pName}* kwenda *${dName}*`;
      } else {
        summaryText = `Oda yako ya *${details.selectedVendorName || s.service || 'Papo Hapo'}*`;
      }

      preview.push({
        sessionId: d.id,
        senderId,
        name: custName,
        summary: summaryText.replace(/\*/g, ''),
        idleMinutes: Math.round(idleMs / 60000),
      });

      if (!options?.dryRun) {
        const msg =
          `👋 *Habari ${custName}! Bado tunakushikia nafasi yako...*\n\n` +
          `Ulianza kuagiza ${summaryText} lakini bado hujakamilisha.\n\n` +
          `💡 Bonyeza kitufe hapo chini kuendelea pale ulipoishia (au andika *00* kuanza upya):`;

        const interactive =
          channel === 'whatsapp'
            ? {
                type: 'button',
                body: { text: msg },
                action: {
                  buttons: buttons.slice(0, 3).map((b) => ({
                    type: 'reply',
                    reply: { id: b.id, title: b.title.slice(0, 20) },
                  })),
                },
              }
            : undefined;

        const res: any = await (sendOutbound as any)({
          channel,
          recipientId: senderId,
          text: msg,
          interactive,
          templateFallback: {
            category: 'utility',
            bodyParams: [custName, summaryText.replace(/\*/g, '').slice(0, 120)],
          },
        }).catch(() => ({ sent: false }));

        await dbAdmin
          .collection('meta_sessions')
          .doc(d.id)
          .set(
            {
              details: {
                ...details,
                abandonedReminderSent: true,
                abandonedReminderSentAt: now,
              },
            },
            { merge: true }
          )
          .catch(() => {});

        if (res?.sent) sentCount += 1;
      }
    }
  } catch (err) {
    console.warn('[Abandoned Recovery] Error:', err);
  }

  return {
    checked,
    eligible,
    sentCount: options?.dryRun ? eligible : sentCount,
    preview: preview.slice(0, 25),
  };
}

// ============================================================================
// 8. IN-RIDE SAFETY SOS & LIVE TRIP SHARE ("SOS" / "SHIRIKI SAFARI")
// ============================================================================
async function findLatestCustomerRide(dbAdmin: any, senderId: string, lookupPhone: string): Promise<any | null> {
  if (!dbAdmin) return null;
  const last9 = partnerPhoneLast9(lookupPhone || senderId);
  try {
    const snap = await dbAdmin.collection('rides').limit(80).get();
    const matches = (snap.docs || [])
      .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
      .filter((r: any) => {
        if (String(r.metaSenderId || '') === senderId) return true;
        if (String(r.customerId || '').includes(senderId)) return true;
        if (last9 && (partnerPhoneLast9(r.customerInfo?.phone) === last9 || partnerPhoneLast9(r.customerPhone) === last9)) return true;
        return false;
      });
    const activePriority = new Set(['on_trip', 'started', 'driver_arrived', 'arrived', 'accepted', 'driver_assigned', 'pending']);
    matches.sort((a: any, b: any) => {
      const aAct = activePriority.has(String(a.status || '').toLowerCase()) ? 1 : 0;
      const bAct = activePriority.has(String(b.status || '').toLowerCase()) ? 1 : 0;
      if (aAct !== bAct) return bAct - aAct;
      return normEpoch(b.updatedAt || b.createdAt) - normEpoch(a.updatedAt || a.createdAt);
    });
    return matches[0] || null;
  } catch {
    return null;
  }
}

async function getEmergencyContactForSender(
  dbAdmin: any,
  channel: PartnerMetaChannel,
  senderId: string,
  session: PartnerSessionLike
): Promise<string> {
  if (session.details?.emergencyContactPhone) {
    return String(session.details.emergencyContactPhone);
  }
  if (!dbAdmin) return '';
  for (const key of [`${channel}:${senderId}`, `${channel}_${senderId}`]) {
    const snap = await dbAdmin.collection('meta_customers').doc(key).get().catch(() => null);
    if (snap?.exists && snap.data()?.emergencyContactPhone) {
      return String(snap.data().emergencyContactPhone);
    }
  }
  return '';
}

export async function handleRideSafetySosOrShare(params: {
  senderId: string;
  cleanInput: string;
  channel: PartnerMetaChannel;
  dbAdmin: any;
  session: PartnerSessionLike;
  lang: 'sw' | 'en';
  knownPhone: string;
  defaultWaPhone: string;
  deps: PartnerBotDeps;
}): Promise<string | null> {
  const { senderId, cleanInput, channel, dbAdmin, session, lang, knownPhone, defaultWaPhone, deps } = params;
  const trimmed = cleanInput.trim();
  const isEn = lang === 'en';
  const lookupPhone = knownPhone || defaultWaPhone || senderId;

  const isSosCmd = /^(?:🆘\s*|🚨\s*)?(sos|dharura|emergency|msaada\s*wa\s*dharura|CMD:RIDE_SOS|RIDE_SOS)$/i.test(trimmed);
  const isShareTripCmd = /^(?:📍\s*|🔗\s*)?(shiriki\s*safari|share\s*(?:trip|ride)|tuma\s*safari|CMD:SHARE_TRIP|SHARE_TRIP)$/i.test(trimmed);
  const isSetContactCmd = /^(?:👨‍👩‍👧\s*|📞\s*)?(mtu\s*wa\s*dharura|emergency\s*contact|ongeza\s*ndugu|CMD:SET_SOS_CONTACT|SET_SOS_CONTACT)$/i.test(trimmed);

  // If user is in SOS_WAIT_CONTACT and sends a command rather than a phone number, exit step cleanly
  if (session.step === 'SOS_WAIT_CONTACT' && !isSosCmd && !isShareTripCmd && !isSetContactCmd) {
    if (/^(0|00|ruka|skip|menu|menyu|hi|habari|ghairi|cancel)$/i.test(trimmed)) {
      session.step = 'COLLECTING_ROUTE';
      delete session.details.pendingShareTripUrl;
      delete session.details.pendingSosAlertId;
      await deps.saveSession(session, dbAdmin);
      return null;
    }
    const digits = normalizePartnerWaDigits(trimmed);
    if (!digits || digits.length < 9) {
      // If user typed something unrelated (not digits), don't trap them: exit SOS_WAIT_CONTACT unless it looks like an attempted phone number
      if (trimmed.replace(/\D/g, '').length < 4) {
        session.step = 'COLLECTING_ROUTE';
        delete session.details.pendingShareTripUrl;
        delete session.details.pendingSosAlertId;
        await deps.saveSession(session, dbAdmin);
        return null;
      }
      return `⚠️ Andika namba sahihi ya simu ya ndugu/rafiki (mfano: *0712345678*), au andika *Ruka*.`;
    }

    const formattedContact = `+${digits}`;
    session.details.emergencyContactPhone = formattedContact;
    const pendingShareUrl = session.details.pendingShareTripUrl;
    const pendingAlertId = session.details.pendingSosAlertId;
    delete session.details.pendingShareTripUrl;
    delete session.details.pendingSosAlertId;
    session.step = 'COLLECTING_ROUTE';

    if (dbAdmin) {
      await dbAdmin
        .collection('meta_customers')
        .doc(`${channel}:${senderId}`)
        .set({ senderId, channel, emergencyContactPhone: formattedContact, updatedAt: new Date() }, { merge: true })
        .catch(() => {});
      if (pendingAlertId) {
        await dbAdmin
          .collection('sos_alerts')
          .doc(pendingAlertId)
          .set({ emergencyContactPhone: formattedContact, updatedAt: new Date() }, { merge: true })
          .catch(() => {});
      }
    }

    const custName = session.details.customerName || 'Mteja wa Papo Hapo';
    const ride = await findLatestCustomerRide(dbAdmin, senderId, lookupPhone);
    const liveUrl = pendingShareUrl || (ride ? `${getPublicAppBaseUrl()}/track/${encodeURIComponent(ride.id)}` : '');

    if (pendingAlertId || pendingShareUrl) {
      const driverName = ride?.driverInfo?.name || ride?.driverName || 'Dereva';
      const plate = ride?.driverInfo?.vehicle?.plate || '-';
      const contactMsg = pendingAlertId
        ? `🆘 *TAARIFA YA DHARURA (PAPO HAPO SAFETY)!*\n\nMpendwa wako *${custName}* (${normalizePhoneDisplay(lookupPhone)}) amebonyeza kitufe cha *SOS* akiwa safarini.\n🚖 *Dereva/Chombo:* ${driverName} (${plate})\n${liveUrl ? `📍 *Fuatilia Mahali Alipo Live:* ${liveUrl}` : ''}`
        : `📍 *${custName} AMESHIRIKI SAFARI YAKE NAWE!*\n\n🚖 *Dereva/Chombo:* ${driverName} (${plate})\n📍 *Njia:* ${ride?.pickup?.name || '-'} ➜ ${ride?.destination?.name || '-'}\n🔗 *Fuatilia Live:* ${liveUrl}`;
      await (deps.sendOutbound as any)({
        channel: 'whatsapp',
        recipientId: digits,
        text: contactMsg,
        templateFallback: {
          category: 'safety',
          bodyParams: [custName, liveUrl || 'Papo Hapo'],
        },
      }).catch(() => {});
    }

    session.details.quickReplyButtons = [
      { id: 'CMD:SHARE_TRIP', title: '📍 Shiriki Safari' },
      { id: '00', title: '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return (
      `✅ *Namba ya Dharura Imehifadhiwa:* ${formattedContact}\n` +
      (pendingAlertId || pendingShareUrl
        ? `📲 Tumemtumia ujumbe na kiungo cha safari yako kwenye WhatsApp sasa hivi!`
        : `Tutaitumia moja kwa moja pindi utakapobonyeza *SOS* au *Shiriki Safari*.`)
    );
  }

  if (isSetContactCmd) {
    session.step = 'SOS_WAIT_CONTACT';
    await deps.saveSession(session, dbAdmin);
    return `👨‍👩‍👧 *WEKA NAMBA YA MTU WA DHARURA (TRUSTED CONTACT)*\n\nAndika namba ya simu ya ndugu au rafiki wa karibu (mfano: *0712345678*):`;
  }

  if (!isSosCmd && !isShareTripCmd) return null;

  const custName = session.details.customerName || 'Mteja wa Papo Hapo';
  const custPhone = normalizePhoneDisplay(lookupPhone);
  const ride = await findLatestCustomerRide(dbAdmin, senderId, lookupPhone);
  const savedContact = await getEmergencyContactForSender(dbAdmin, channel, senderId, session);
  const baseUrl = getPublicAppBaseUrl();
  const trackUrl = ride ? `${baseUrl}/track/${encodeURIComponent(ride.id)}` : deps.buildOrdersTrackingUrl(custPhone);
  const bookingCode = ride ? String(ride.bookingId || ride.id.slice(-6)).toUpperCase() : 'PAPO-SOS';
  const driverName = ride?.driverInfo?.name || ride?.driverName || 'Haijatajwa';
  const driverPhone = ride?.driverInfo?.phone || '';
  const vehiclePlate = ride?.driverInfo?.vehicle?.plate || '-';
  const pickupName = ride?.pickup?.name || session.details?.lastLocation?.name || 'Eneo la Mteja';
  const destinationName = ride?.destination?.name || '-';

  if (isShareTripCmd) {
    let contactNotified = false;
    if (savedContact) {
      const contactDigits = normalizePartnerWaDigits(savedContact);
      if (contactDigits) {
        const sendRes: any = await (deps.sendOutbound as any)({
          channel: 'whatsapp',
          recipientId: contactDigits,
          text:
            `📍 *${custName} AMESHIRIKI SAFARI YAKE NAWE (PAPO HAPO)*\n\n` +
            `🔖 *Safari:* #${bookingCode}\n` +
            `🚖 *Dereva & Chombo:* ${driverName} (${vehiclePlate})${driverPhone ? ` • ${driverPhone}` : ''}\n` +
            `📍 *Njia:* ${pickupName} ➜ ${destinationName}\n\n` +
            `🗺️ *Fuatilia Live:* ${trackUrl}`,
          templateFallback: {
            category: 'safety',
            bodyParams: [custName, trackUrl],
          },
        }).catch(() => ({ sent: false }));
        contactNotified = Boolean(sendRes?.sent);
      }
    } else {
      session.step = 'SOS_WAIT_CONTACT';
      session.details.pendingShareTripUrl = trackUrl;
    }

    session.details.quickReplyButtons = [
      { id: 'CMD:RIDE_SOS', title: '🆘 SOS Dharura' },
      { id: '00', title: '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);

    return (
      `📍 *SHIRIKI SAFARI YAKO MUBASHARA (#${bookingCode})*\n\n` +
      `🚖 *Dereva:* ${driverName} (*${vehiclePlate}*)\n` +
      `📌 *Njia:* ${pickupName} ➜ ${destinationName}\n` +
      `🔗 *Kiungo cha Ramani (Fuatilia Live):*\n${trackUrl}\n\n` +
      (savedContact
        ? `✅ Tumetuma kiungo hiki moja kwa moja kwa mtu wako wa dharura (*${savedContact}*)${contactNotified ? '' : ' (imehifadhiwa)'}.`
        : `💡 _Mtumie ndugu/rafiki kiungo hiki au andika namba yake ya simu sasa (mf. *0712345678*) tumtumie moja kwa moja!_`)
    );
  }

  // SOS EMERGENCY TRIGGER
  let alertId = `sos-${Date.now()}`;
  if (dbAdmin) {
    try {
      const alertRef = await dbAdmin.collection('sos_alerts').add(
        cleanUndefined({
          status: 'open',
          severity: 'critical',
          channel,
          senderId,
          customerName: custName,
          customerPhone: custPhone,
          emergencyContactPhone: savedContact || undefined,
          rideId: ride?.id || undefined,
          bookingCode,
          driverId: ride?.driverId || undefined,
          driverName,
          driverPhone: driverPhone || undefined,
          vehiclePlate,
          pickupName,
          destinationName,
          trackUrl,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
      alertId = alertRef.id;

      await dbAdmin
        .collection('notifications')
        .add(
          cleanUndefined({
            title: '🆘 TAHADHARI YA DHARURA (SOS SAFARINI)!',
            message: `${custName} (${custPhone}) amewasha SOS safarini #${bookingCode} (${driverName} • ${vehiclePlate}).`,
            type: 'ride_sos_emergency',
            sosAlertId: alertId,
            rideId: ride?.id,
            senderId,
            read: false,
            createdAt: new Date(),
          })
        )
        .catch(() => {});

      await dbAdmin
        .collection('support_tickets')
        .add(
          cleanUndefined({
            channel,
            senderId,
            customerName: `🆘 ${custName}`,
            customerPhone: custPhone,
            status: 'open',
            priority: 'critical',
            sosAlertId: alertId,
            messages: [
              {
                sender: 'customer',
                text: `🆘 SOS DHARURA SAFARINI (#${bookingCode}) • Dereva: ${driverName} (${vehiclePlate}) • Track: ${trackUrl}`,
                timestamp: new Date().toISOString(),
              },
            ],
            lastMessage: `🆘 SOS DHARURA #${bookingCode} — ${driverName} (${vehiclePlate})`,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        )
        .catch(() => {});
    } catch {}
  }

  if (savedContact) {
    const contactDigits = normalizePartnerWaDigits(savedContact);
    if (contactDigits) {
      await (deps.sendOutbound as any)({
        channel: 'whatsapp',
        recipientId: contactDigits,
        text:
          `🆘 *TAHADHARI YA DHARURA (PAPO HAPO SOS)!*\n\n` +
          `Mpendwa wako *${custName}* (${custPhone}) amewasha kitufe cha *SOS* akiwa safarini (#${bookingCode}).\n` +
          `🚖 *Dereva & Chombo:* ${driverName} (*${vehiclePlate}*)${driverPhone ? ` • ${driverPhone}` : ''}\n` +
          `📍 *Njia:* ${pickupName} ➜ ${destinationName}\n` +
          `🔗 *Fuatilia Mahali Alipo Live:* ${trackUrl}`,
        templateFallback: {
          category: 'safety',
          bodyParams: [custName, trackUrl],
        },
      }).catch(() => {});
    }
  } else {
    session.step = 'SOS_WAIT_CONTACT';
    session.details.pendingSosAlertId = alertId;
  }

  session.details.quickReplyButtons = [
    { id: 'CMD:SHARE_TRIP', title: '📍 Shiriki Safari' },
    { id: 'CMD:HUMAN_HANDOVER', title: '🎧 Ongea na Mhudumu' },
  ];
  await deps.saveSession(session, dbAdmin);

  return isEn
    ? `[[EN_NATIVE]]🆘 *EMERGENCY SOS ACTIVATED!* (#${bookingCode})\n\n` +
        `🚨 Our Safety Desk has been alerted immediately with your trip & driver details (*${driverName}* • *${vehiclePlate}*).\n` +
        (savedContact ? `📲 Emergency alert sent to *${savedContact}*.\n` : '') +
        `📞 *Emergency Lines:* +255 775 985 358 • Police: *112*\n` +
        `🔗 Live Link: ${trackUrl}` +
        (!savedContact ? `\n\n_Reply with a trusted family/friend phone number (e.g. *0712345678*) to notify them now._` : '')
    : `🆘 *TAHADHARI YA DHARURA (SOS) IMEWASHWA!* (#${bookingCode})\n\n` +
        `🚨 Timu ya Usalama ya *Papo Hapo* imepokea tahadhari hii sasa hivi pamoja na taarifa za dereva (*${driverName}* • *${vehiclePlate}*).\n` +
        (savedContact ? `📲 Mtu wako wa dharura (*${savedContact}*) ametumiwa taarifa na ramani ya moja kwa moja.\n` : '') +
        `📞 *Piga Simu ya Haraka:* +255 775 985 358 • Polisi: *112*\n` +
        `🔗 *Ramani Live:* ${trackUrl}` +
        (!savedContact ? `\n\n_Andika namba ya ndugu/rafiki sasa (mfano: *0712345678*) tumtumie taarifa hizi mara moja!_` : '');
}

export async function listSosAlerts(dbAdmin: any): Promise<any[]> {
  if (!dbAdmin) return [];
  try {
    const snap = await dbAdmin.collection('sos_alerts').limit(60).get();
    return (snap.docs || [])
      .map((d: any) => {
        const data = d.data() || {};
        return {
          id: d.id,
          ...data,
          createdAt: normEpoch(data.createdAt),
          updatedAt: normEpoch(data.updatedAt) || normEpoch(data.createdAt),
        };
      })
      .sort((a: any, b: any) => (a.status === 'open' ? -1 : 1) - (b.status === 'open' ? -1 : 1) || b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function resolveSosAlert(
  dbAdmin: any,
  alertId: string,
  sendOutbound?: PartnerBotDeps['sendOutbound'],
  note?: string
): Promise<{ resolved: boolean; alert?: any }> {
  if (!dbAdmin || !alertId) return { resolved: false };
  const ref = dbAdmin.collection('sos_alerts').doc(alertId);
  const snap = await ref.get().catch(() => null);
  if (!snap?.exists) return { resolved: false };
  const data = snap.data() || {};
  await ref
    .set(
      cleanUndefined({
        status: 'resolved',
        resolvedBy: 'admin',
        resolvedNote: note || 'Imetatuliwa na Timu ya Usalama',
        resolvedAt: new Date(),
        updatedAt: new Date(),
      }),
      { merge: true }
    )
    .catch(() => {});

  if (sendOutbound && data.senderId) {
    await (sendOutbound as any)({
      channel: (data.channel || 'whatsapp') as PartnerMetaChannel,
      recipientId: data.senderId,
      text: `✅ *Hali ya Dharura (SOS) Imeshughulikiwa*\n\nTimu ya usalama ya *Papo Hapo* imethibitisha kufunga tahadhari yako ya dharura (#${data.bookingCode || 'SOS'}). Kama bado unahitaji msaada, andika *SOS* au *Mhudumu* muda wowote.`,
      templateFallback: { category: 'safety', bodyParams: [data.customerName || 'Mteja', data.bookingCode || 'SOS'] },
    }).catch(() => {});
  }
  return { resolved: true, alert: { id: alertId, ...data, status: 'resolved' } };
}

// ============================================================================
// 9. POST-ORDER VENDOR / FUNDI / STORE STAR RATING (1-5 NYOTA)
// ============================================================================
export async function handlePostOrderRating(params: {
  senderId: string;
  cleanInput: string;
  channel: PartnerMetaChannel;
  dbAdmin: any;
  session: PartnerSessionLike;
  lang: 'sw' | 'en';
  deps: PartnerBotDeps;
}): Promise<string | null> {
  const { senderId, cleanInput, channel, dbAdmin, session, lang, deps } = params;
  const trimmed = cleanInput.trim();
  const isEn = lang === 'en';

  // 1. Direct interactive button command: RATE_ORD:<orderId>:<1-5>
  const btnMatch = trimmed.match(/^(?:CMD:)?RATE_ORD:([A-Za-z0-9_-]+):([1-5])$/i);
  let targetOrderId = '';
  let stars = 0;
  let comment = '';

  if (btnMatch) {
    targetOrderId = btnMatch[1];
    stars = parseInt(btnMatch[2], 10);
  } else if (session.details?.ratingOrderId) {
    const lower = trimmed.toLowerCase();
    if (['skip', 'ruka', 'baadae', 'menu', 'menyu', 'hi', 'habari', 'mambo', 'hello', '0', '00', 'anza upya', 'restart'].includes(lower)) {
      delete session.details.ratingOrderId;
      delete session.details.ratingVendorId;
      delete session.details.ratingVendorName;
      delete session.details.ratingOrderCode;
      session.step = 'COLLECTING_ROUTE';
      await deps.saveSession(session, dbAdmin);
      return null;
    }
    const textRateMatch = trimmed.match(/^([1-5])(?:\s*(?:nyota|stars?|\/\s*5|\*))?(?:[\s:-]+(.+))?$/i);
    if (!textRateMatch) {
      return `⭐ Tafadhali tuma namba *1* hadi *5* kumpa tathmini *${session.details.ratingVendorName || 'Mtoa Huduma'}* (mfano: *5* au *5 Huduma safi!*), au andika *Menu* kuendelea.`;
    }
    targetOrderId = String(session.details.ratingOrderId);
    stars = parseInt(textRateMatch[1], 10);
    comment = (textRateMatch[2] || '').trim();
  } else {
    return null;
  }

  let vendorId = String(session.details?.ratingVendorId || '').trim();
  let vendorName = String(session.details?.ratingVendorName || '').trim();
  let orderCode = String(session.details?.ratingOrderCode || targetOrderId.slice(-6)).toUpperCase();
  const custName = session.details?.customerName || 'Mteja wa WhatsApp';

  if (dbAdmin && targetOrderId) {
    try {
      const oRef = dbAdmin.collection('orders').doc(targetOrderId);
      const oSnap = await oRef.get().catch(() => null);
      const oData = oSnap?.exists ? oSnap.data() || {} : {};
      vendorId = vendorId || String(oData.vendorId || oData.assignedFundiId || '').trim();
      vendorName = vendorName || String(oData.vendorName || oData.assignedFundiName || 'Duka / Mtoa Huduma');
      orderCode = String(oData.bookingCode || oData.bookingRef || targetOrderId.slice(-6)).toUpperCase();

      await oRef.set(
        cleanUndefined({
          rating: stars,
          ratedAt: new Date(),
          ...(comment ? { ratingComment: comment } : {}),
        }),
        { merge: true }
      );

      await dbAdmin.collection('reviews').add(
        cleanUndefined({
          orderId: targetOrderId,
          orderCode,
          vendorId: vendorId || 'papo-hapo-express',
          vendorName,
          customerId: `meta-client-${senderId}`,
          customerName: custName,
          rating: stars,
          comment: comment || undefined,
          type: 'order_review',
          channel,
          createdAt: new Date(),
        })
      );

      if (vendorId && vendorId !== 'papo-hapo-express') {
        const vRef = dbAdmin.collection('vendors').doc(vendorId);
        const vSnap = await vRef.get().catch(() => null);
        if (vSnap?.exists) {
          const revSnap = await dbAdmin.collection('reviews').where('vendorId', '==', vendorId).limit(100).get().catch(() => ({ docs: [] }));
          const ratingsList = (revSnap.docs || [])
            .map((d: any) => Number(d.data()?.rating || 0))
            .filter((n: number) => n >= 1 && n <= 5);
          const count = ratingsList.length || 1;
          const avg = ratingsList.length > 0
            ? Math.round((ratingsList.reduce((a: number, b: number) => a + b, 0) / ratingsList.length) * 10) / 10
            : stars;
          await vRef.set({ rating: avg, reviewCount: count, updatedAt: new Date() }, { merge: true }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[Post-Order Rating] Persist error:', err);
    }
  }

  delete session.details.ratingOrderId;
  delete session.details.ratingVendorId;
  delete session.details.ratingVendorName;
  delete session.details.ratingOrderCode;
  session.step = 'COLLECTING_ROUTE';
  delete session.service;
  session.details.quickReplyButtons = [
    { id: 'CMD:REORDER_LAST', title: isEn ? '🔁 Reorder' : '🔁 Agiza Tena' },
    { id: '00', title: isEn ? '🏠 Main Menu' : '🏠 Menyu Kuu' },
  ];
  await deps.saveSession(session, dbAdmin);

  const starIcons = '⭐'.repeat(stars);
  return isEn
    ? `[[EN_NATIVE]]🙏 Thank you *${custName}* for rating *${vendorName || 'this store'}* (#${orderCode}) ${starIcons} (*${stars}/5*)!`
    : `🙏 Asante sana *${custName}* kwa kumpa *${vendorName || 'mtoa huduma'}* (#${orderCode}) tathmini ya ${starIcons} (*${stars}/5*)!\n\nMaoni yako yanawasaidia wafanyabiashara wetu kukua. Andika *Menu* muda wowote! ✨`;
}

