import { cleanUndefined } from './getFirestoreDb.js';
export { cleanUndefined };

export type PartnerMetaChannel = 'whatsapp' | 'messenger' | 'instagram';

export interface PartnerSessionLike {
  senderId: string;
  channel: PartnerMetaChannel;
  step: string;
  service?: string;
  details: Record<string, any>;
  history?: any[];
  lastPrompt?: string;
  lastUpdated: number;
}

export interface PartnerBotDeps {
  saveSession: (session: any, dbAdmin: any) => Promise<void>;
  sendOutbound: (params: {
    channel: PartnerMetaChannel;
    recipientId: string;
    text: string;
    phoneNumberId?: string;
    media?: Array<{ url: string; caption?: string }>;
    interactive?: any;
  }) => Promise<{ sent: boolean; reason?: string }>;
  notifyRideStatus?: (
    params: { rideId: string; status: string; driverInfo?: any; driverLocation?: any; rideData?: any },
    dbAdmin: any
  ) => Promise<any>;
  notifyCustomerOrderStatus?: (
    params: { orderId: string; status: string; orderData?: any; vendorName?: string; reason?: string },
    dbAdmin: any
  ) => Promise<any>;
  triggerAutomatedOrder?: (
    dbAdmin: any,
    vendorId: string,
    category: string,
    items: any[],
    total: number,
    customerPhone: string,
    customerName: string,
    notes: string,
    source: PartnerMetaChannel,
    extraFields?: Record<string, any>
  ) => Promise<string | null>;
  buildOrdersTrackingUrl: (phone?: string, code?: string) => string;
}

export function partnerPhoneLast9(raw: any): string {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

export function normalizePartnerWaDigits(raw: any): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0') && digits.length === 10) return `255${digits.slice(1)}`;
  if (digits.length === 9 && (digits.startsWith('6') || digits.startsWith('7'))) return `255${digits}`;
  return digits;
}

function normalizeEpoch(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val?.toMillis === 'function') return val.toMillis();
  if (typeof val?._seconds === 'number') return val._seconds * 1000;
  const parsed = Date.parse(String(val));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isSameDayLocal(tsMs: number): boolean {
  if (!tsMs) return false;
  const d = new Date(tsMs);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export async function findVendorForWhatsAppSender(dbAdmin: any, senderId: string): Promise<any | null> {
  if (!dbAdmin) return null;
  const targetLast9 = partnerPhoneLast9(senderId);
  try {
    const directSnap = await dbAdmin
      .collection('vendors')
      .where('metaSenderId', '==', senderId)
      .limit(5)
      .get()
      .catch(() => null);
    if (directSnap && !directSnap.empty) {
      const d = directSnap.docs[0];
      return { id: d.id, ...(d.data() || {}) };
    }
  } catch {}

  if (!targetLast9 || targetLast9.length < 9) return null;
  try {
    const snap = await dbAdmin.collection('vendors').limit(250).get();
    const candidates: any[] = [];
    for (const d of snap.docs || []) {
      const v = d.data() || {};
      const phones = [
        v.whatsappNumber,
        v.phoneNumber,
        v.phone,
        v.socialLinks?.whatsapp,
        v.ownerInfo?.whatsapp,
        v.ownerInfo?.phone,
        v.metaSenderId,
      ];
      if (phones.some((p) => partnerPhoneLast9(p) === targetLast9)) {
        candidates.push({ id: d.id, ...v });
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const aAct = a.status === 'active' ? 1 : 0;
      const bAct = b.status === 'active' ? 1 : 0;
      if (aAct !== bAct) return bAct - aAct;
      return normalizeEpoch(b.updatedAt || b.createdAt) - normalizeEpoch(a.updatedAt || a.createdAt);
    });
    return candidates[0];
  } catch {
    return null;
  }
}

export async function findDriverForWhatsAppSender(dbAdmin: any, senderId: string): Promise<any | null> {
  if (!dbAdmin) return null;
  const targetLast9 = partnerPhoneLast9(senderId);
  try {
    const directSnap = await dbAdmin
      .collection('users')
      .where('metaSenderId', '==', senderId)
      .limit(5)
      .get()
      .catch(() => null);
    if (directSnap && !directSnap.empty) {
      for (const d of directSnap.docs) {
        const u = d.data() || {};
        if (u.role === 'rider' || u.role === 'driver') {
          return { id: d.id, ...u };
        }
      }
    }
  } catch {}

  if (!targetLast9 || targetLast9.length < 9) return null;
  try {
    const snap = await dbAdmin
      .collection('users')
      .where('role', 'in', ['rider', 'driver'])
      .limit(250)
      .get();
    const candidates: any[] = [];
    for (const d of snap.docs || []) {
      const u = d.data() || {};
      const phones = [u.whatsappNumber, u.phoneNumber, u.phone, u.metaSenderId];
      if (phones.some((p) => partnerPhoneLast9(p) === targetLast9)) {
        candidates.push({ id: d.id, ...u });
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const aApp = a.approvalStatus === 'approved' ? 1 : 0;
      const bApp = b.approvalStatus === 'approved' ? 1 : 0;
      if (aApp !== bApp) return bApp - aApp;
      return normalizeEpoch(b.updatedAt || b.createdAt) - normalizeEpoch(a.updatedAt || a.createdAt);
    });
    return candidates[0];
  } catch {
    return null;
  }
}

const notifiedApprovedPartners = new Set<string>();

export async function notifyPartnerApprovedToWhatsApp(
  params: { partnerType: 'vendor' | 'driver'; partnerId: string; partnerData?: any },
  dbAdmin: any,
  sendOutbound: PartnerBotDeps['sendOutbound']
): Promise<{ notified: boolean; reason?: string }> {
  const { partnerType, partnerId, partnerData } = params;
  if (!partnerId || !dbAdmin) return { notified: false, reason: 'Missing partnerId or dbAdmin' };
  const dedupKey = `${partnerType}:${partnerId}`;
  if (notifiedApprovedPartners.has(dedupKey)) {
    return { notified: false, reason: 'Already notified in memory' };
  }

  const col = partnerType === 'vendor' ? 'vendors' : 'users';
  let rec = partnerData;
  try {
    const snap = await dbAdmin.collection(col).doc(partnerId).get();
    if (snap?.exists) {
      rec = { ...(partnerData || {}), ...(snap.data() || {}) };
    }
  } catch {}

  if (!rec) return { notified: false, reason: 'Partner record not found' };
  if (rec.approvalWaNotified === true) {
    notifiedApprovedPartners.add(dedupKey);
    return { notified: false, reason: 'Already notified in DB' };
  }

  const recipientDigits =
    normalizePartnerWaDigits(rec.metaSenderId) ||
    normalizePartnerWaDigits(rec.whatsappNumber) ||
    normalizePartnerWaDigits(rec.socialLinks?.whatsapp) ||
    normalizePartnerWaDigits(rec.ownerInfo?.whatsapp) ||
    normalizePartnerWaDigits(rec.phoneNumber) ||
    normalizePartnerWaDigits(rec.phone);

  if (!recipientDigits || recipientDigits.length < 9) {
    return { notified: false, reason: 'No valid WhatsApp number on partner record' };
  }

  notifiedApprovedPartners.add(dedupKey);

  if (partnerType === 'vendor') {
    const shopName = rec.businessName || rec.name || 'Duka Lako';
    const isFundi = String(rec.category || '').toLowerCase() === 'handyman';
    const text = isFundi
      ? `🎉 *HONGERA! USAJILI WAKO WA UFUNDI UMEIDHINISHWA!* ✅\n\n` +
        `🛠️ *Jina:* ${shopName}\n` +
        `🟢 *Hali:* Hewani Sasa (Wateja wanaweza kukuomba kazi moja kwa moja!)\n\n` +
        `💡 Bonyeza *Ufundi Wangu* hapa chini kupokea kazi mpya, kutuma bei, na kudhibiti upatikanaji wako:`
      : `🎉 *HONGERA! DUKA LAKO LIMEIDHINISHWA!* ✅\n\n` +
        `🏪 *Biashara:* ${shopName}\n` +
        `🟢 *Hali:* Hewani Sasa (Wateja wanaweza kuagiza WhatsApp & App!)\n\n` +
        `💡 Unaweza kuongeza bidhaa, kufunga/kufungua duka, na kuona mauzo ya leo moja kwa moja hapa WhatsApp kwa kuandika *"Duka Langu"*:`;
    const res = await sendOutbound({
      channel: 'whatsapp',
      recipientId: recipientDigits,
      text,
      interactive: {
        type: 'button',
        body: { text },
        footer: { text: 'Papo Hapo Partner Hub' },
        action: {
          buttons: isFundi
            ? [
                { type: 'reply', reply: { id: 'CMD:FUNDI_HUB', title: '🛠️ Ufundi Wangu' } },
                { type: 'reply', reply: { id: 'CMD:FUNDI_JOBS', title: '📋 Kazi Mpya' } },
                { type: 'reply', reply: { id: '00', title: '🏠 Menyu Kuu' } },
              ]
            : [
                { type: 'reply', reply: { id: 'CMD:MY_SHOP', title: '🏪 Duka Langu' } },
                { type: 'reply', reply: { id: 'CMD:VENDOR_ADD_PRODUCT', title: '➕ Ongeza Bidhaa' } },
                { type: 'reply', reply: { id: '00', title: '🏠 Menyu Kuu' } },
              ],
        },
      },
    });
    await dbAdmin
      .collection('vendors')
      .doc(partnerId)
      .set(
        {
          isApproved: true,
          approvalWaNotified: true,
          approvalWaNotifiedAt: new Date().toISOString(),
        },
        { merge: true }
      )
      .catch(() => {});
    return { notified: res.sent, reason: res.reason };
  }

  const drvName = rec.displayName || rec.name || 'Dereva';
  const text =
    `🎉 *HONGERA ${drvName.toUpperCase()}! USAJILI WAKO UMEIDHINISHWA!* ✅\n\n` +
    `🚖 *Chombo:* ${rec.driverType || rec.vehicleType || 'Usafiri'} (${rec.plateNumber || rec.vehicleNumber || '-'})\n` +
    `🟢 Sasa unaweza kuingia *Online* na kupokea kazi za abiria au mizigo moja kwa moja hapa *WhatsApp*!\n\n` +
    `Bonyeza hapo chini kuanza kupokea kazi:`;

  const res = await sendOutbound({
    channel: 'whatsapp',
    recipientId: recipientDigits,
    text,
    interactive: {
      type: 'button',
      body: { text },
      footer: { text: 'Papo Hapo Driver Dispatch' },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'CMD:DRIVER_TOGGLE_ONLINE', title: '🟢 Ingia Online' } },
          { type: 'reply', reply: { id: 'CMD:DRIVER_HUB', title: '🚖 Kazi Zangu' } },
          { type: 'reply', reply: { id: '00', title: '🏠 Menyu Kuu' } },
        ],
      },
    },
  });

  await dbAdmin
    .collection('users')
    .doc(partnerId)
    .set(
      {
        approvalWaNotified: true,
        approvalWaNotifiedAt: new Date().toISOString(),
      },
      { merge: true }
    )
    .catch(() => {});

  return { notified: res.sent, reason: res.reason };
}

const notifiedDriverJobs = new Set<string>();

export async function notifyDriversNewJobToWhatsApp(
  params: { jobType: 'ride' | 'order'; jobId: string; jobData: any },
  dbAdmin: any,
  sendOutbound: PartnerBotDeps['sendOutbound']
): Promise<{ sentCount: number }> {
  const { jobType, jobId, jobData } = params;
  if (!dbAdmin || !jobId || !jobData) return { sentCount: 0 };
  const dedupKey = `${jobType}:${jobId}`;
  if (notifiedDriverJobs.has(dedupKey) || jobData.driverWaDispatched === true) {
    return { sentCount: 0 };
  }
  if (jobData.driverId) return { sentCount: 0 };

  notifiedDriverJobs.add(dedupKey);

  try {
    const snap = await dbAdmin
      .collection('users')
      .where('role', 'in', ['rider', 'driver'])
      .limit(80)
      .get();

    const rawDrivers = (snap.docs || []).map((d: any) => ({ id: d.id, ...(d.data() || {}) }));
    const reqVeh = String(jobData.vehicleType || '').toLowerCase();
    const eligible = rawDrivers.filter((u: any) => {
      if (u.approvalStatus !== 'approved') return false;
      const phone = normalizePartnerWaDigits(u.metaSenderId || u.whatsappNumber || u.phone || u.phoneNumber);
      if (!phone || phone.length < 9) return false;
      return true;
    });

    // Prioritize Online + matching vehicleType
    eligible.sort((a: any, b: any) => {
      const aOnline = a.isOnline === true ? 2 : a.isOnline === false ? 0 : 1;
      const bOnline = b.isOnline === true ? 2 : b.isOnline === false ? 0 : 1;
      if (aOnline !== bOnline) return bOnline - aOnline;
      const aMatch = reqVeh && String(a.driverType || a.vehicleType || '').toLowerCase().includes(reqVeh) ? 1 : 0;
      const bMatch = reqVeh && String(b.driverType || b.vehicleType || '').toLowerCase().includes(reqVeh) ? 1 : 0;
      return bMatch - aMatch;
    });

    const targets = eligible.slice(0, 5);
    if (targets.length === 0) return { sentCount: 0 };

    let cardText = '';
    if (jobType === 'ride') {
      const code = String(jobData.bookingId || jobId.slice(-6)).toUpperCase();
      const pickup = jobData.pickup?.name || jobData.pickup?.address || 'Pickup';
      const dest = jobData.destination?.name || jobData.destination?.address || 'Destination';
      const fare = Number(jobData.fare || 0);
      const dist = jobData.distance ? `${jobData.distance} km` : '';
      cardText =
        `🔔 *SAFARI MPYA INASUBIRI! (#${code})*\n\n` +
        `🚖 *Chombo:* ${String(jobData.vehicleType || 'Usafiri').toUpperCase()}\n` +
        `📍 *Kutoka:* ${pickup}\n` +
        `🏁 *Kwenda:* ${dest}\n` +
        (dist ? `📏 *Umbali:* ${dist}\n` : '') +
        `💰 *Nauli:* *TZS ${fare.toLocaleString()}/=*\n\n` +
        `Bonyeza *Chukua Kazi* haraka kabla haijachukuliwa:`;
    } else {
      const code = String(jobData.bookingCode || jobId.slice(-6)).toUpperCase();
      const vendor = jobData.vendorName || 'Duka la Papo Hapo';
      const dropoff = jobData.deliveryAddress || 'Mteja';
      const total = Number(jobData.totalAmount || jobData.total || 0);
      cardText =
        `📦 *MZIGO WA DELIVERY UKO TAYARI! (#${code})*\n\n` +
        `🏪 *Chukua Kwa:* ${vendor}\n` +
        `📍 *Peleka Kwa:* ${dropoff}\n` +
        `💵 *Thamani:* TZS ${total.toLocaleString()}/=\n\n` +
        `Bonyeza *Chukua Kazi* kufanya delivery hii:`;
    }

    let sentCount = 0;
    for (const drv of targets) {
      const drvPhone = normalizePartnerWaDigits(drv.metaSenderId || drv.whatsappNumber || drv.phone || drv.phoneNumber);
      if (!drvPhone) continue;
      const res = await sendOutbound({
        channel: 'whatsapp',
        recipientId: drvPhone,
        text: cardText,
        interactive: {
          type: 'button',
          body: { text: cardText },
          footer: { text: 'Papo Hapo Driver Dispatch' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: `DRV_CLAIM:${jobType}:${jobId}`, title: '✅ Chukua Kazi' } },
              { type: 'reply', reply: { id: `DRV_SKIP:${jobType}:${jobId}`, title: '⏭️ Ruka' } },
            ],
          },
        },
      });
      if (res.sent) sentCount += 1;
    }

    const colName = jobType === 'ride' ? 'rides' : 'orders';
    await dbAdmin
      .collection(colName)
      .doc(jobId)
      .set({ driverWaDispatched: true, driverWaDispatchedAt: new Date().toISOString() }, { merge: true })
      .catch(() => {});

    return { sentCount };
  } catch (err) {
    console.warn('[Driver WA Dispatch] Error:', err);
    return { sentCount: 0 };
  }
}

export async function handleVendorHubOrManagement(
  params: {
    senderId: string;
    cleanInput: string;
    channel: PartnerMetaChannel;
    dbAdmin: any;
    session: PartnerSessionLike;
    lang: 'sw' | 'en';
    deps: PartnerBotDeps;
  }
): Promise<string | null> {
  const { senderId, cleanInput, dbAdmin, session, lang, deps } = params;
  const trimmed = cleanInput.trim();
  const isEn = lang === 'en';

  const isMyShopCmd = /^(?:🏪\s*)?(duka\s*langu|biashara\s*yangu|my\s*shop|my\s*store|vendor\s*hub|CMD:MY_SHOP|MY_SHOP)$/i.test(trimmed);
  const isToggleOpenCmd = /^(?:CMD:)?VENDOR_TOGGLE_OPEN$/i.test(trimmed) || /^(funga\s*duka|fungua\s*duka)$/i.test(trimmed);
  const isAddProdCmd = /^(?:➕\s*)?(ongeza\s*bidhaa|add\s*product|CMD:VENDOR_ADD_PRODUCT|VENDOR_ADD_PRODUCT)$/i.test(trimmed);
  const isVendorOrdersCmd = /^(?:📦\s*)?(oda\s*za\s*duka|vendor\s*orders|CMD:VENDOR_ORDERS|VENDOR_ORDERS)$/i.test(trimmed);
  const isVendorMoreCmd = /^(?:CMD:)?VENDOR_MORE$/i.test(trimmed);
  const isToggleStockCmd = /^(?:📦\s*)?(badili\s*stock|stock\s*ya\s*duka|manage\s*stock|CMD:VENDOR_TOGGLE_STOCK|VENDOR_TOGGLE_STOCK)$/i.test(trimmed);
  const prodToggleMatch = trimmed.match(/^(?:CMD:)?PRD_TOGGLE:([A-Za-z0-9_-]+)$/i);
  const vendorReadyMatch = trimmed.match(/^(?:CMD:)?VENDOR_READY:([A-Za-z0-9_-]+)$/i);

  // Active add-product steps
  if (session.step === 'VENDOR_ADD_PROD_PHOTO') {
    const isSkip = /^(ruka|skip|next|hakuna|hapana|2|⏭️.*)$/i.test(trimmed);
    const isPhotoUploaded = trimmed.startsWith('__WA_PHOTO_UPLOADED__');
    if (isPhotoUploaded) {
      const cap = trimmed.slice('__WA_PHOTO_UPLOADED__'.length).replace(/^:/, '').trim();
      session.step = 'VENDOR_ADD_PROD_DETAIL';
      if (cap && cap.includes('-')) {
        // User uploaded image WITH "Name - Price" in the caption! Save immediately!
        return await saveWhatsAppMerchantProduct(cap, session, dbAdmin, lang, deps);
      }
      await deps.saveSession(session, dbAdmin);
      return isEn
        ? `[[EN_NATIVE]]📸 *Photo saved!* Now enter the *Product Name & Price* _(e.g. Chicken Pilau - 7500)_:`
        : `📸 *Picha imehifadhiwa!* Sasa andika *Jina la Bidhaa na Bei* _(mfano: Pilau Kuku - 7500)_:`;
    }
    if (isSkip) {
      delete session.details.pendingProductPhoto;
      session.step = 'VENDOR_ADD_PROD_DETAIL';
      await deps.saveSession(session, dbAdmin);
      return isEn
        ? `🏷️ Enter the *Product Name & Price* _(e.g. Chicken Pilau - 7500)_:`
        : `🏷️ Andika *Jina la Bidhaa na Bei* _(mfano: Pilau Kuku - 7500)_:`;
    }
    // If they typed "Name - Price" directly without skipping, process it right away!
    if (/\d{3,}/.test(trimmed) && trimmed.length >= 4) {
      return await saveWhatsAppMerchantProduct(trimmed, session, dbAdmin, lang, deps);
    }
    session.details.quickReplyButtons = [
      { id: 'RUKA', title: isEn ? '⏭️ Skip Photo' : '⏭️ Ruka Picha' },
      { id: '00', title: isEn ? '🏠 Main Menu' : '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return isEn
      ? `[[EN_NATIVE]]⚠️ Please send a *product photo*, tap *Skip Photo*, or type *"Name - Price"* directly:`
      : `⚠️ Tafadhali tuma *picha ya bidhaa*, bonyeza *Ruka Picha*, au andika *"Jina - Bei"* moja kwa moja:`;
  }

  if (session.step === 'VENDOR_ADD_PROD_DETAIL') {
    if (trimmed.length < 3) {
      return isEn
        ? `[[EN_NATIVE]]⚠️ Enter a valid product name and price (e.g. *Chicken Biryani - 8000*):`
        : `⚠️ Andika jina sahihi la bidhaa na bei (mfano: *Biryani Kuku - 8000*):`;
    }
    return await saveWhatsAppMerchantProduct(trimmed, session, dbAdmin, lang, deps);
  }

  if (session.step === 'VENDOR_STOCK_TOGGLE') {
    const list: any[] = Array.isArray(session.details.vendorProductsList) ? session.details.vendorProductsList : [];
    const pickIdx = /^\d{1,2}$/.test(trimmed) ? parseInt(trimmed, 10) - 1 : -1;
    const picked = prodToggleMatch
      ? list.find((p) => p.id === prodToggleMatch[1])
      : pickIdx >= 0
      ? list[pickIdx]
      : null;
    if (picked && dbAdmin) {
      const currentlyHidden = picked.hidden === true || picked.status === 'out_of_stock';
      const nextHidden = !currentlyHidden;
      const nextStatus = nextHidden ? 'out_of_stock' : 'available';
      await dbAdmin
        .collection('products')
        .doc(picked.id)
        .set({ hidden: nextHidden, status: nextStatus, updatedAt: new Date() }, { merge: true })
        .catch(() => {});
      session.step = 'COLLECTING_ROUTE';
      delete session.service;
      session.details.quickReplyButtons = [
        { id: 'CMD:VENDOR_TOGGLE_STOCK', title: '📦 Badili Nyingine' },
        { id: 'CMD:MY_SHOP', title: '🏪 Duka Langu' },
        { id: '00', title: '🏠 Menyu Kuu' },
      ];
      await deps.saveSession(session, dbAdmin);
      return nextHidden
        ? `🔴 *${picked.name}* imewekwa kama *IMEISHA (Out of Stock)* na haitaonekana kwa wateja kwa sasa.`
        : `🟢 *${picked.name}* imerudishwa *INAPATIKANA (Available)* sasa!`;
    }
  }

  // Handle VENDOR_READY:<orderId>
  if (vendorReadyMatch && dbAdmin) {
    const orderId = vendorReadyMatch[1];
    const orderSnap = await dbAdmin.collection('orders').doc(orderId).get().catch(() => null);
    if (!orderSnap?.exists) {
      return `⚠️ Samahani, oda hii haikupatikana tena.`;
    }
    const orderDoc = orderSnap.data() || {};
    const vendor = await findVendorForWhatsAppSender(dbAdmin, senderId);
    if (vendor && orderDoc.vendorId && vendor.id !== orderDoc.vendorId) {
      return `⚠️ Huna ruhusa ya kubadilisha hali ya oda hii.`;
    }
    await dbAdmin.collection('orders').doc(orderId).update({
      status: 'ready',
      readyAt: new Date(),
      updatedAt: new Date(),
    });
    const shortCode = String(orderDoc.bookingCode || orderId.slice(-6)).toUpperCase();
    if (deps.notifyCustomerOrderStatus) {
      await deps.notifyCustomerOrderStatus(
        { orderId, status: 'ready', orderData: { ...orderDoc, status: 'ready' }, vendorName: vendor?.businessName || orderDoc.vendorName },
        dbAdmin
      ).catch(() => {});
    }
    let pingedDrivers = 0;
    if (orderDoc.orderType !== 'pickup' && !orderDoc.isTableBooking) {
      const drvRes = await notifyDriversNewJobToWhatsApp(
        { jobType: 'order', jobId: orderId, jobData: { ...orderDoc, status: 'ready' } },
        dbAdmin,
        deps.sendOutbound
      );
      pingedDrivers = drvRes.sentCount;
    }
    session.details.quickReplyButtons = [
      { id: 'CMD:VENDOR_ORDERS', title: '📦 Oda Zingine' },
      { id: 'CMD:MY_SHOP', title: '🏪 Duka Langu' },
      { id: '00', title: '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return (
      `🍲 *Oda #${shortCode} Iko Tayari!*\n\n` +
      `📲 Mteja amejulishwa kuwa oda yake iko tayari.` +
      (pingedDrivers > 0 ? `\n🛵 Madereva *${pingedDrivers}* wa karibu wametumiwa arifa kuja kuchukua mzigo.` : '')
    );
  }

  if (
    !isMyShopCmd &&
    !isToggleOpenCmd &&
    !isAddProdCmd &&
    !isVendorOrdersCmd &&
    !isVendorMoreCmd &&
    !isToggleStockCmd &&
    !prodToggleMatch
  ) {
    return null;
  }

  const vendor = await findVendorForWhatsAppSender(dbAdmin, senderId);
  if (!vendor) {
    session.details.quickReplyButtons = [
      { id: 'CMD:REGISTER_SHOP', title: isEn ? '🏪 Register Shop' : '🏪 Sajili Duka' },
      { id: '00', title: isEn ? '🏠 Main Menu' : '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return isEn
      ? `[[EN_NATIVE]]ℹ️ No registered shop was found on this WhatsApp number yet.\n\nTap *Register Shop* below to list your business in 1 minute:`
      : `ℹ️ Hatujapata duka lililosajiliwa kwenye namba hii bado.\n\nBonyeza *Sajili Duka* chini kuweka biashara yako ndani ya dakika 1:`;
  }

  if (isToggleOpenCmd) {
    const nextOpen = vendor.isOpen === false;
    await dbAdmin
      .collection('vendors')
      .doc(vendor.id)
      .set({ isOpen: nextOpen, updatedAt: new Date() }, { merge: true })
      .catch(() => {});
    session.details.quickReplyButtons = [
      { id: 'CMD:MY_SHOP', title: '🏪 Duka Langu' },
      { id: 'CMD:VENDOR_ADD_PRODUCT', title: '➕ Ongeza Bidhaa' },
      { id: '00', title: '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return nextOpen
      ? `🟢 *DUKA LIMEFUNGULIWA!* (*${vendor.businessName || vendor.name}*)\n\nWateja wanaweza kuagiza bidhaa zako sasa hivi.`
      : `🔴 *DUKA LIMEFUNGWA KWA MUDA!* (*${vendor.businessName || vendor.name}*)\n\nOda mpya zimesitishwa hadi utakapofungua tena.`;
  }

  if (isAddProdCmd) {
    if (vendor.status === 'suspended') {
      return `⛔ Samahani, duka lako limezuiliwa na Admin. Wasiliana na Huduma kwa Wateja.`;
    }
    session.details.activeVendorId = vendor.id;
    session.details.activeVendorName = vendor.businessName || vendor.name || 'Duka';
    session.details.activeVendorCategory = vendor.category || 'ecommerce';
    delete session.details.pendingProductPhoto;
    session.step = 'VENDOR_ADD_PROD_PHOTO';
    session.details.quickReplyButtons = [
      { id: 'RUKA', title: isEn ? '⏭️ Skip Photo' : '⏭️ Ruka Picha' },
      { id: '00', title: isEn ? '🏠 Main Menu' : '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return isEn
      ? `[[EN_NATIVE]]➕ *ADD PRODUCT — ${session.details.activeVendorName}*\n\n📸 Send a *photo* of the product (or tap *Skip Photo* to type Name & Price directly):`
      : `➕ *ONGEZA BIDHAA — ${session.details.activeVendorName}*\n\n📸 Tuma *picha ya bidhaa* hapa (au bonyeza *Ruka Picha* kuandika Jina & Bei moja kwa moja):`;
  }

  if (isToggleStockCmd || prodToggleMatch) {
    const pSnap = await dbAdmin.collection('products').where('vendorId', '==', vendor.id).limit(20).get();
    const prods = (pSnap.docs || []).map((d: any) => ({ id: d.id, ...(d.data() || {}) }));
    if (prods.length === 0) {
      session.details.quickReplyButtons = [
        { id: 'CMD:VENDOR_ADD_PRODUCT', title: '➕ Ongeza Bidhaa' },
        { id: 'CMD:MY_SHOP', title: '🏪 Duka Langu' },
      ];
      await deps.saveSession(session, dbAdmin);
      return `📦 Duka lako bado halina bidhaa. Bonyeza *Ongeza Bidhaa* kuanza kuweka menyu yako:`;
    }
    if (prodToggleMatch) {
      const target = prods.find((p: any) => p.id === prodToggleMatch[1]);
      if (target) {
        const nextHidden = !(target.hidden === true || target.status === 'out_of_stock');
        await dbAdmin
          .collection('products')
          .doc(target.id)
          .set({ hidden: nextHidden, status: nextHidden ? 'out_of_stock' : 'available', updatedAt: new Date() }, { merge: true })
          .catch(() => {});
        session.details.quickReplyButtons = [
          { id: 'CMD:VENDOR_TOGGLE_STOCK', title: '📦 Badili Nyingine' },
          { id: 'CMD:MY_SHOP', title: '🏪 Duka Langu' },
        ];
        await deps.saveSession(session, dbAdmin);
        return nextHidden
          ? `🔴 *${target.name}* imewekwa *IMEISHA (Out of Stock)*.`
          : `🟢 *${target.name}* imewashwa *INAPATIKANA*.`;
      }
    }
    session.details.vendorProductsList = prods.slice(0, 9);
    session.step = 'VENDOR_STOCK_TOGGLE';
    await deps.saveSession(session, dbAdmin);
    const lines = prods.slice(0, 9).map((p: any, idx: number) => {
      const out = p.hidden === true || p.status === 'out_of_stock';
      return `${idx + 1}. ${out ? '🔴 Imeisha' : '🟢 Wazi'} — *${p.name}* (TZS ${Number(p.price || 0).toLocaleString()})`;
    });
    return (
      `📦 *DHIBITI STOCK YA DUKA — ${vendor.businessName || vendor.name}*\n\n` +
      `Chagua bidhaa (*1–${Math.min(9, prods.length)}*) kubadili kati ya *🟢 Wazi* na *🔴 Imeisha*:\n\n` +
      lines.join('\n')
    );
  }

  if (isVendorOrdersCmd) {
    const oSnap = await dbAdmin.collection('orders').where('vendorId', '==', vendor.id).limit(40).get();
    const allOrds = (oSnap.docs || []).map((d: any) => ({ id: d.id, ...(d.data() || {}) }));
    const activeOrds = allOrds
      .filter((o: any) => ['pending', 'accepted', 'preparing'].includes(String(o.status || '').toLowerCase()))
      .sort((a: any, b: any) => normalizeEpoch(b.createdAt) - normalizeEpoch(a.createdAt));

    if (activeOrds.length === 0) {
      session.details.quickReplyButtons = [
        { id: 'CMD:MY_SHOP', title: '🏪 Duka Langu' },
        { id: '00', title: '🏠 Menyu Kuu' },
      ];
      await deps.saveSession(session, dbAdmin);
      return `✅ Hakuna oda inayosubiri kwa sasa kwenye *${vendor.businessName || vendor.name}*.`;
    }
    const top = activeOrds[0];
    const topCode = String(top.bookingCode || top.id.slice(-6)).toUpperCase();
    const lines = activeOrds.slice(0, 5).map((o: any, i: number) => {
      const code = String(o.bookingCode || o.id.slice(-6)).toUpperCase();
      return `${i + 1}. *#${code}* • ${o.customerName || 'Mteja'} — TZS ${Number(o.totalAmount || 0).toLocaleString()} (*${o.status}*)`;
    });
    const isPending = String(top.status).toLowerCase() === 'pending';
    session.details.quickReplyButtons = isPending
      ? [
          { id: `VENDOR_ACCEPT:${top.id}`, title: `✅ Kubali #${topCode}`.slice(0, 20) },
          { id: `VENDOR_REJECT:${top.id}`, title: `❌ Kataa #${topCode}`.slice(0, 20) },
          { id: 'CMD:MY_SHOP', title: '🏪 Duka Langu' },
        ]
      : [
          { id: `CMD:VENDOR_READY:${top.id}`, title: `📦 Tayari #${topCode}`.slice(0, 20) },
          { id: 'CMD:MY_SHOP', title: '🏪 Duka Langu' },
          { id: '00', title: '🏠 Menyu Kuu' },
        ];
    await deps.saveSession(session, dbAdmin);
    return (
      `📦 *ODA ZINAZOHITAJI HATUA — ${vendor.businessName || vendor.name}*\n\n` +
      lines.join('\n') +
      `\n\nBonyeza kitufe hapo chini kushughulikia oda *#${topCode}*: `
    );
  }

  if (isVendorMoreCmd) {
    await deps.saveSession(session, dbAdmin);
    return (
      `🏪 *USIMAMIZI WA DUKA — ${vendor.businessName || vendor.name}*\n\n` +
      `1. 📦 Oda Zinazosubiri\n` +
      `2. 🏷️ Dhibiti Stock (Imeisha / Wazi)\n` +
      `3. ➕ Ongeza Bidhaa Mpya\n` +
      `4. 🏪 Rudi Kwenye Takwimu\n\n` +
      `_Andika neno (mfano: *Oda za duka*, *Badili stock*, *Ongeza bidhaa*):_`
    );
  }

  // Default: Duka Langu Dashboard Summary
  const [oSnap, pSnap] = await Promise.all([
    dbAdmin.collection('orders').where('vendorId', '==', vendor.id).limit(80).get().catch(() => ({ docs: [] })),
    dbAdmin.collection('products').where('vendorId', '==', vendor.id).limit(80).get().catch(() => ({ docs: [] })),
  ]);
  const orders = (oSnap.docs || []).map((d: any) => d.data() || {});
  const productsCount = (pSnap.docs || []).length;
  const todayOrders = orders.filter((o: any) => isSameDayLocal(normalizeEpoch(o.createdAt)) && o.status !== 'cancelled');
  const todayRevenue = todayOrders.reduce((acc: number, o: any) => acc + Number(o.totalAmount || o.total || 0), 0);
  const pendingCount = orders.filter((o: any) => ['pending', 'preparing', 'accepted'].includes(String(o.status || '').toLowerCase())).length;

  const approvalLabel =
    vendor.status === 'active'
      ? '✅ Imeidhinishwa (Hewani)'
      : vendor.status === 'suspended'
      ? '⛔ Imesitishwa'
      : '⏳ Inasubiri Uthibitisho wa Admin';
  const openLabel = vendor.isOpen === false ? '🔴 Imefungwa' : '🟢 Lipo Wazi';

  session.details.quickReplyButtons = [
    { id: 'CMD:VENDOR_ADD_PRODUCT', title: '➕ Ongeza Bidhaa' },
    { id: 'CMD:VENDOR_TOGGLE_OPEN', title: vendor.isOpen === false ? '🟢 Fungua Duka' : '🔴 Funga Duka' },
    { id: 'CMD:VENDOR_ORDERS', title: `📦 Oda (${pendingCount})` },
  ];
  await deps.saveSession(session, dbAdmin);

  return (
    `🏪 *DUKA LANGU — ${vendor.businessName || vendor.name}*\n\n` +
    `📌 *Usajili:* ${approvalLabel}\n` +
    `🚪 *Hali ya Sasa:* ${openLabel}\n` +
    `🏷️ *Bidhaa Zilizopo:* ${productsCount}\n` +
    `📊 *Mauzo ya Leo:* *TZS ${todayRevenue.toLocaleString()}/=* (Oda ${todayOrders.length})\n` +
    `⏳ *Oda Zinazosubiri:* ${pendingCount}\n\n` +
    `_Tip: Andika *"Badili stock"* kuzima bidhaa zilizoisha._`
  );
}

async function saveWhatsAppMerchantProduct(
  rawDetail: string,
  session: PartnerSessionLike,
  dbAdmin: any,
  lang: 'sw' | 'en',
  deps: PartnerBotDeps
): Promise<string> {
  const vendorId = session.details.activeVendorId || '';
  const vendorName = session.details.activeVendorName || 'Duka';
  const vendorCat = session.details.activeVendorCategory || 'ecommerce';
  const trimmed = rawDetail.trim();
  const priceMatch = trimmed.match(/(?:[-–:|]|\btzs\b|\btsh\b)\s*([\d,]{3,})\s*$/i) || trimmed.match(/(\d{3,})\s*$/);
  const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 0;
  const itemName = priceMatch
    ? trimmed.slice(0, priceMatch.index).replace(/[-–:|]+$/, '').trim()
    : trimmed;

  if (!itemName || price <= 0) {
    return lang === 'en'
      ? `[[EN_NATIVE]]⚠️ Please include both name and price (e.g. *Pilau Nyama - 7000*):`
      : `⚠️ Tafadhali weka jina na bei (mfano: *Pilau Nyama - 7000*):`;
  }

  const prodId = `wa-prd-${Date.now().toString(36)}-${Math.floor(10 + Math.random() * 89)}`;
  const imageUrl =
    session.details.pendingProductPhoto ||
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';

  if (dbAdmin && vendorId) {
    await dbAdmin
      .collection('products')
      .doc(prodId)
      .set(
        cleanUndefined({
          id: prodId,
          vendorId,
          vendorName,
          vendorCategory: vendorCat,
          name: itemName,
          price,
          imageUrl,
          description: `${itemName} kutoka ${vendorName}`,
          status: 'available',
          hidden: false,
          source: 'whatsapp_merchant',
          createdAt: new Date(),
        })
      )
      .catch(() => {});
  }

  delete session.details.pendingProductPhoto;
  session.step = 'COLLECTING_ROUTE';
  delete session.service;
  session.details.quickReplyButtons = [
    { id: 'CMD:VENDOR_ADD_PRODUCT', title: '➕ Ongeza Nyingine' },
    { id: 'CMD:MY_SHOP', title: '🏪 Duka Langu' },
    { id: '00', title: '🏠 Menyu Kuu' },
  ];
  await deps.saveSession(session, dbAdmin);

  return (
    `✅ *BIDHAA IMEONGEZWA HEWANI!*\n\n` +
    `🏪 *Duka:* ${vendorName}\n` +
    `🏷️ *Bidhaa:* ${itemName}\n` +
    `💰 *Bei:* TZS ${price.toLocaleString()}/=\n\n` +
    `Wateja wanaweza kuiona na kuiagiza sasa hivi!`
  );
}

export async function handleDriverHubOrAction(
  params: {
    senderId: string;
    cleanInput: string;
    dbAdmin: any;
    session: PartnerSessionLike;
    lang: 'sw' | 'en';
    deps: PartnerBotDeps;
  }
): Promise<string | null> {
  const { senderId, cleanInput, dbAdmin, session, deps } = params;
  const trimmed = cleanInput.trim();

  const isDriverHubCmd = /^(?:🚖\s*)?(dereva|kazi\s*zangu|driver\s*hub|bodaboda\s*hub|CMD:DRIVER_HUB|DRIVER_HUB)$/i.test(trimmed);
  const isToggleOnlineCmd = /^(?:CMD:)?DRIVER_TOGGLE_ONLINE$/i.test(trimmed) || /^(ingia\s*online|nenda\s*offline)$/i.test(trimmed);
  const isJobsCmd = /^(?:CMD:)?DRIVER_JOBS$/i.test(trimmed) || /^kazi\s*mpya$/i.test(trimmed);

  const claimMatch = trimmed.match(/^(?:CMD:)?DRV_CLAIM:(ride|order):([A-Za-z0-9_-]+)$/i);
  const skipMatch = trimmed.match(/^(?:CMD:)?DRV_SKIP:(ride|order):([A-Za-z0-9_-]+)$/i);
  const rideStageMatch = trimmed.match(/^(?:CMD:)?DRV_RIDE_(ARRIVED|START|DONE):([A-Za-z0-9_-]+)$/i);
  const ordStageMatch = trimmed.match(/^(?:CMD:)?DRV_ORD_(PICKED|ARRIVED|POD|DONE):([A-Za-z0-9_-]+)$/i);
  const isPodPhotoStep = session.step === 'DRV_POD_PHOTO' && Boolean(session.details?.pendingPodOrderId);

  if (
    !isDriverHubCmd &&
    !isToggleOnlineCmd &&
    !isJobsCmd &&
    !claimMatch &&
    !skipMatch &&
    !rideStageMatch &&
    !ordStageMatch &&
    !isPodPhotoStep
  ) {
    return null;
  }

  if (skipMatch) {
    return `⏭️ Umeruka kazi hii. Tutakutumia kazi nyingine inayofuata karibu nawe!`;
  }

  const driver = await findDriverForWhatsAppSender(dbAdmin, senderId);
  if (!driver) {
    session.details.quickReplyButtons = [
      { id: 'CMD:REGISTER_DRIVER', title: '🚖 Sajili Dereva' },
      { id: '00', title: '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return (
      `ℹ️ Hatujapata akaunti ya dereva/bodaboda iliyosajiliwa kwenye namba hii.\n\n` +
      `Bonyeza *Sajili Dereva* hapa chini kujiunga na kuanza kupokea kazi WhatsApp:`
    );
  }

  if (driver.approvalStatus !== 'approved') {
    return (
      `⏳ *Akaunti Yako Bado Inahakikiwa*\n\n` +
      `Habari *${driver.displayName || driver.name || 'Dereva'}*, ombi lako lipo kwa Msimamizi (*Admin*). Utapokea ujumbe wa pongezi hapa WhatsApp pindi litakapoidhinishwa!`
    );
  }

  const drvName = driver.displayName || driver.name || 'Dereva wa Papo Hapo';
  const drvPhone = driver.phone || driver.phoneNumber || senderId;

  if (isToggleOnlineCmd) {
    const nextOnline = !(driver.isOnline === true);
    await dbAdmin
      .collection('users')
      .doc(driver.id)
      .set({ isOnline: nextOnline, status: nextOnline ? 'online' : 'offline', updatedAt: new Date() }, { merge: true })
      .catch(() => {});
    session.details.quickReplyButtons = [
      { id: 'CMD:DRIVER_JOBS', title: '📡 Kazi Mpya' },
      { id: 'CMD:DRIVER_HUB', title: '🚖 Kazi Zangu' },
      { id: '00', title: '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return nextOnline
      ? `🟢 *UMEINGIA ONLINE!* Utapokea arifa za abiria na mizigo ya karibu hapa hapa WhatsApp.`
      : `🔴 *UMETOKA OFFLINE!* Hautapokea arifa mpya za kazi hadi utakaporudi Online.`;
  }

  if (claimMatch && dbAdmin) {
    const jobType = claimMatch[1].toLowerCase() as 'ride' | 'order';
    const jobId = claimMatch[2];
    const col = jobType === 'ride' ? 'rides' : 'orders';
    const snap = await dbAdmin.collection(col).doc(jobId).get().catch(() => null);
    if (!snap?.exists) return `⚠️ Samahani, kazi hii haikupatikana tena.`;
    const rec = snap.data() || {};
    if (rec.driverId && rec.driverId !== driver.id) {
      return `⚠️ Kazi hii tayari imeshachukuliwa na dereva mwingine. Endelea kuwa Online kwa kazi zijazo!`;
    }

    const driverInfoObj = {
      id: driver.id,
      name: drvName,
      phone: drvPhone,
      rating: Number(driver.rating || 4.9),
      vehicle: {
        model: driver.driverType || driver.vehicleType || 'Usafiri',
        plate: driver.plateNumber || driver.vehicleNumber || '-',
      },
    };

    if (jobType === 'ride') {
      await dbAdmin.collection('rides').doc(jobId).update({
        status: 'accepted',
        driverId: driver.id,
        driverName: drvName,
        driverInfo: driverInfoObj,
        acceptedVia: 'whatsapp',
        updatedAt: new Date(),
      });
      if (deps.notifyRideStatus) {
        await deps.notifyRideStatus(
          { rideId: jobId, status: 'accepted', driverInfo: driverInfoObj, rideData: { ...rec, status: 'accepted', driverInfo: driverInfoObj } },
          dbAdmin
        ).catch(() => {});
      }
      const code = String(rec.bookingId || jobId.slice(-6)).toUpperCase();
      session.details.quickReplyButtons = [
        { id: `DRV_RIDE_ARRIVED:${jobId}`, title: '📍 Nimefika Pickup' },
        { id: `DRV_RIDE_START:${jobId}`, title: '🚀 Anza Safari' },
      ];
      await deps.saveSession(session, dbAdmin);
      return (
        `✅ *UMESHIKA SAFARI #${code}!*\n\n` +
        `👤 *Mteja:* ${rec.customerInfo?.name || rec.customerName || 'Mteja'} (${rec.customerInfo?.phone || rec.customerPhone || '-'})\n` +
        `📍 *Pickup:* ${rec.pickup?.name || rec.pickup?.address || '-'}\n` +
        `🏁 *Destination:* ${rec.destination?.name || rec.destination?.address || '-'}\n` +
        `💰 *Nauli:* *TZS ${Number(rec.fare || 0).toLocaleString()}/=*\n\n` +
        `Mteja amejulishwa kuwa uko njiani!`
      );
    }

    await dbAdmin.collection('orders').doc(jobId).update({
      status: 'out_for_delivery',
      driverId: driver.id,
      driverName: drvName,
      driverPhone: drvPhone,
      driverInfo: driverInfoObj,
      updatedAt: new Date(),
    });
    if (deps.notifyCustomerOrderStatus) {
      await deps.notifyCustomerOrderStatus(
        { orderId: jobId, status: 'out_for_delivery', orderData: { ...rec, status: 'out_for_delivery' }, vendorName: rec.vendorName },
        dbAdmin
      ).catch(() => {});
    }
    const code = String(rec.bookingCode || jobId.slice(-6)).toUpperCase();
    session.details.quickReplyButtons = [
      { id: `DRV_ORD_PICKED:${jobId}`, title: '📦 Nimechukua Mzigo' },
      { id: `DRV_ORD_ARRIVED:${jobId}`, title: '📍 Nimefika Mlangoni' },
      { id: `DRV_ORD_POD:${jobId}`, title: '📸 Picha & Maliza' },
    ];
    await deps.saveSession(session, dbAdmin);
    return (
      `✅ *UMESHIKA DELIVERY #${code}!*\n\n` +
      `🏪 *Chukua Kwa:* ${rec.vendorName || 'Duka'}\n` +
      `👤 *Mteja:* ${rec.customerName || 'Mteja'} (${rec.customerPhone || '-'})\n` +
      `📍 *Peleka:* ${rec.deliveryAddress || '-'}\n\n` +
      `Bonyeza hapo chini ukishachukua mzigo, ukifika mlangoni, au ukitaka kupiga picha ya makabidhiano:`
    );
  }

  if (rideStageMatch && dbAdmin) {
    const stage = rideStageMatch[1].toUpperCase();
    const rideId = rideStageMatch[2];
    const snap = await dbAdmin.collection('rides').doc(rideId).get().catch(() => null);
    if (!snap?.exists) return `⚠️ Safari haikupatikana.`;
    const rec = snap.data() || {};
    const code = String(rec.bookingId || rideId.slice(-6)).toUpperCase();

    if (stage === 'ARRIVED') {
      await dbAdmin.collection('rides').doc(rideId).update({ status: 'driver_arrived', updatedAt: new Date() });
      if (deps.notifyRideStatus) {
        await deps.notifyRideStatus({ rideId, status: 'driver_arrived', rideData: { ...rec, status: 'driver_arrived' } }, dbAdmin).catch(() => {});
      }
      session.details.quickReplyButtons = [{ id: `DRV_RIDE_START:${rideId}`, title: '🚀 Anza Safari' }];
      await deps.saveSession(session, dbAdmin);
      return `📍 Umejulisha mteja wa *#${code}* kuwa umefika Pickup! Bonyeza *Anza Safari* mkiondoka:`;
    }

    if (stage === 'START') {
      await dbAdmin.collection('rides').doc(rideId).update({ status: 'on_trip', startedAt: new Date(), updatedAt: new Date() });
      if (deps.notifyRideStatus) {
        await deps.notifyRideStatus({ rideId, status: 'on_trip', rideData: { ...rec, status: 'on_trip' } }, dbAdmin).catch(() => {});
      }
      session.details.quickReplyButtons = [{ id: `DRV_RIDE_DONE:${rideId}`, title: '🏁 Maliza Safari' }];
      await deps.saveSession(session, dbAdmin);
      return `🚀 Safari *#${code}* imeanza! Endesha kwa usalama. Bonyeza *Maliza Safari* mkifika:`;
    }

    await dbAdmin.collection('rides').doc(rideId).update({ status: 'completed', completedAt: new Date(), updatedAt: new Date() });
    if (deps.notifyRideStatus) {
      await deps.notifyRideStatus({ rideId, status: 'completed', rideData: { ...rec, status: 'completed' } }, dbAdmin).catch(() => {});
    }
    session.details.quickReplyButtons = [
      { id: 'CMD:DRIVER_JOBS', title: '📡 Kazi Mpya' },
      { id: 'CMD:DRIVER_HUB', title: '🚖 Kazi Zangu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return `🏁 *Safari #${code} Imekamilika!* 🎉\n💰 Nauli: *TZS ${Number(rec.fare || 0).toLocaleString()}/=*\n\nHongera kwa kazi nzuri!`;
  }

  if (isPodPhotoStep && dbAdmin) {
    const orderId = String(session.details.pendingPodOrderId || '');
    if (/^(0|00|ghairi|cancel|menu|menyu)$/i.test(trimmed)) {
      session.step = 'COLLECTING_ROUTE';
      delete session.details.pendingPodOrderId;
      delete session.details.pendingPodPhoto;
      await deps.saveSession(session, dbAdmin);
      return `❎ Umehairi upakiaji wa picha ya makabidhiano. Andika *Dereva* kuona kazi zako.`;
    }
    const isPhotoReady = trimmed.startsWith('__WA_PHOTO_UPLOADED__');
    const isSkipPhoto = /^(ruka|skip|maliza|done)$/i.test(trimmed);
    if (!isPhotoReady && !isSkipPhoto) {
      session.details.quickReplyButtons = [
        { id: `DRV_ORD_DONE:${orderId}`, title: '⏭️ Maliza Bila Picha' },
        { id: '00', title: '🏠 Menyu Kuu' },
      ];
      await deps.saveSession(session, dbAdmin);
      return `📸 Tafadhali tuma *picha* ya makabidhiano ya mzigo hapa WhatsApp, au bonyeza *Maliza Bila Picha* kukamilisha oda.`;
    }

    const podPhotoUrl = isPhotoReady ? String(session.details.pendingPodPhoto || '').trim() : '';
    const snap = await dbAdmin.collection('orders').doc(orderId).get().catch(() => null);
    const rec = snap?.exists ? snap.data() || {} : {};
    const code = String(rec.bookingCode || orderId.slice(-6)).toUpperCase();

    await dbAdmin
      .collection('orders')
      .doc(orderId)
      .set(
        cleanUndefined({
          status: 'completed',
          deliveredAt: new Date(),
          proofOfDelivery: Boolean(podPhotoUrl),
          ...(podPhotoUrl ? { podPhotoUrl } : {}),
          podDriverName: drvName,
          updatedAt: new Date(),
        }),
        { merge: true }
      )
      .catch(() => {});

    delete session.details.pendingPodOrderId;
    delete session.details.pendingPodPhoto;
    session.step = 'COLLECTING_ROUTE';

    if (deps.notifyCustomerOrderStatus) {
      await deps
        .notifyCustomerOrderStatus(
          {
            orderId,
            status: 'completed',
            orderData: { ...rec, status: 'completed', ...(podPhotoUrl ? { podPhotoUrl } : {}) },
            vendorName: rec.vendorName,
          },
          dbAdmin
        )
        .catch(() => {});
    }

    session.details.quickReplyButtons = [
      { id: 'CMD:DRIVER_JOBS', title: '📡 Kazi Mpya' },
      { id: 'CMD:DRIVER_HUB', title: '🚖 Kazi Zangu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return podPhotoUrl
      ? `📸🏁 *Delivery #${code} Imekamilika na Picha ya Makabidhiano (POD)!* ✅\n\nPicha na uthibitisho wa kupokea mzigo vimetumwa kwa mteja. Hongera kwa kazi nzuri!`
      : `🏁 *Delivery #${code} Imekamilika!* 🎉 Asante kwa huduma ya uhakika!`;
  }

  if (ordStageMatch && dbAdmin) {
    const stage = ordStageMatch[1].toUpperCase();
    const orderId = ordStageMatch[2];
    const snap = await dbAdmin.collection('orders').doc(orderId).get().catch(() => null);
    if (!snap?.exists) return `⚠️ Oda haikupatikana.`;
    const rec = snap.data() || {};
    const code = String(rec.bookingCode || orderId.slice(-6)).toUpperCase();

    if (stage === 'PICKED') {
      await dbAdmin.collection('orders').doc(orderId).update({ status: 'out_for_delivery', pickedUpAt: new Date(), updatedAt: new Date() });
      if (deps.notifyCustomerOrderStatus) {
        await deps.notifyCustomerOrderStatus(
          { orderId, status: 'out_for_delivery', orderData: { ...rec, status: 'out_for_delivery' }, vendorName: rec.vendorName },
          dbAdmin
        ).catch(() => {});
      }
      session.details.quickReplyButtons = [
        { id: `DRV_ORD_ARRIVED:${orderId}`, title: '📍 Nimefika Mlangoni' },
        { id: `DRV_ORD_POD:${orderId}`, title: '📸 Picha & Maliza' },
        { id: `DRV_ORD_DONE:${orderId}`, title: '🏁 Nimefikisha' },
      ];
      await deps.saveSession(session, dbAdmin);
      return `📦 Mzigo *#${code}* uko mikononi mwako. Mteja amepokea taarifa kuwa uko njiani!`;
    }

    if (stage === 'ARRIVED') {
      await dbAdmin
        .collection('orders')
        .doc(orderId)
        .set({ driverArrivedAtDropoff: true, driverArrivedAtDropoffAt: new Date(), updatedAt: new Date() }, { merge: true })
        .catch(() => {});
      const custRecipient = normalizePartnerWaDigits(rec.metaSenderId || rec.customerPhone || '');
      if (custRecipient) {
        await (deps.sendOutbound as any)({
          channel: (rec.metaChannel || 'whatsapp') as PartnerMetaChannel,
          recipientId: custRecipient,
          text:
            `📍 *DEREVA AMEFIKA MLANGONI / ENEO LAKO!* (#${code})\n\n` +
            `🛵 Dereva *${drvName}* ameshawasili na mzigo wako kutoka *${rec.vendorName || 'Duka'}*. Tafadhali toka upokee oda yako! 📦✨`,
          templateFallback: {
            category: 'utility',
            bodyParams: [code, rec.vendorName || 'Papo Hapo', 'arrived'],
          },
        }).catch(() => {});
      }
      session.details.quickReplyButtons = [
        { id: `DRV_ORD_POD:${orderId}`, title: '📸 Picha & Maliza' },
        { id: `DRV_ORD_DONE:${orderId}`, title: '🏁 Nimefikisha' },
      ];
      await deps.saveSession(session, dbAdmin);
      return `📍 *Mteja wa #${code} amejulishwa kuwa umefika mlangoni!* Piga picha ya makabidhiano au bonyeza *Nimefikisha* ukimkabidhi:`;
    }

    if (stage === 'POD') {
      session.step = 'DRV_POD_PHOTO';
      session.details.pendingPodOrderId = orderId;
      delete session.details.pendingPodPhoto;
      session.details.quickReplyButtons = [
        { id: `DRV_ORD_DONE:${orderId}`, title: '⏭️ Maliza Bila Picha' },
        { id: '00', title: '🏠 Menyu Kuu' },
      ];
      await deps.saveSession(session, dbAdmin);
      return `📸 *PICHA YA MAKABIDHIANO (POD) — #${code}*\n\nPiga na utume *picha* ya mzigo umeshafika kwa mteja sasa hivi (au bonyeza *Maliza Bila Picha*):`;
    }

    delete session.details.pendingPodOrderId;
    delete session.details.pendingPodPhoto;
    if (session.step === 'DRV_POD_PHOTO') session.step = 'COLLECTING_ROUTE';
    await dbAdmin.collection('orders').doc(orderId).update({ status: 'completed', deliveredAt: new Date(), updatedAt: new Date() });
    if (deps.notifyCustomerOrderStatus) {
      await deps.notifyCustomerOrderStatus(
        { orderId, status: 'completed', orderData: { ...rec, status: 'completed' }, vendorName: rec.vendorName },
        dbAdmin
      ).catch(() => {});
    }
    session.details.quickReplyButtons = [
      { id: 'CMD:DRIVER_JOBS', title: '📡 Kazi Mpya' },
      { id: 'CMD:DRIVER_HUB', title: '🚖 Kazi Zangu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return `🏁 *Delivery #${code} Imekamilika!* 🎉 Asante kwa huduma ya uhakika!`;
  }

  if (isJobsCmd && dbAdmin) {
    const [rSnap, oSnap] = await Promise.all([
      dbAdmin.collection('rides').where('status', '==', 'pending').limit(10).get().catch(() => ({ docs: [] })),
      dbAdmin.collection('orders').where('status', '==', 'ready').limit(10).get().catch(() => ({ docs: [] })),
    ]);
    const openRides = (rSnap.docs || []).map((d: any) => ({ id: d.id, type: 'ride' as const, ...(d.data() || {}) })).filter((r: any) => !r.driverId);
    const openOrders = (oSnap.docs || []).map((d: any) => ({ id: d.id, type: 'order' as const, ...(d.data() || {}) })).filter((o: any) => !o.driverId && o.orderType !== 'pickup');
    const combined = [...openRides, ...openOrders];
    if (combined.length === 0) {
      session.details.quickReplyButtons = [
        { id: 'CMD:DRIVER_HUB', title: '🚖 Kazi Zangu' },
        { id: '00', title: '🏠 Menyu Kuu' },
      ];
      await deps.saveSession(session, dbAdmin);
      return `📡 Hakuna kazi wazi kwa sekunde hii. Hakikisha uko *🟢 Online* ili upokee kazi papo hapo!`;
    }
    const first = combined[0];
    const fCode = String(first.bookingId || first.bookingCode || first.id.slice(-6)).toUpperCase();
    const listLines = combined.slice(0, 5).map((j: any, i: number) => {
      if (j.type === 'ride') {
        return `${i + 1}. 🚖 *#${String(j.bookingId || j.id.slice(-6)).toUpperCase()}*: ${j.pickup?.name || '-'} ➜ ${j.destination?.name || '-'} (*TZS ${Number(j.fare || 0).toLocaleString()}*)`;
      }
      return `${i + 1}. 📦 *#${String(j.bookingCode || j.id.slice(-6)).toUpperCase()}*: ${j.vendorName || 'Duka'} ➜ ${j.deliveryAddress || 'Mteja'}`;
    });
    session.details.quickReplyButtons = [
      { id: `DRV_CLAIM:${first.type}:${first.id}`, title: `✅ Chukua #${fCode}`.slice(0, 20) },
      { id: 'CMD:DRIVER_HUB', title: '🚖 Kazi Zangu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return `📡 *KAZI ZINAZOSUBIRI (${combined.length})*\n\n${listLines.join('\n')}\n\nBonyeza kuchukua kazi ya kwanza *#${fCode}*:`;
  }

  // Default: Driver Hub Overview
  const [myRidesSnap, pendingSnap] = await Promise.all([
    dbAdmin.collection('rides').where('driverId', '==', driver.id).limit(50).get().catch(() => ({ docs: [] })),
    dbAdmin.collection('rides').where('status', '==', 'pending').limit(15).get().catch(() => ({ docs: [] })),
  ]);
  const myRides = (myRidesSnap.docs || []).map((d: any) => d.data() || {});
  const doneToday = myRides.filter((r: any) => r.status === 'completed' && isSameDayLocal(normalizeEpoch(r.completedAt || r.createdAt)));
  const earnToday = doneToday.reduce((s: number, r: any) => s + Number(r.fare || 0), 0);
  const openCount = (pendingSnap.docs || []).filter((d: any) => !d.data()?.driverId).length;
  const isOnline = driver.isOnline === true;

  session.details.quickReplyButtons = [
    { id: 'CMD:DRIVER_TOGGLE_ONLINE', title: isOnline ? '🔴 Nenda Offline' : '🟢 Ingia Online' },
    { id: 'CMD:DRIVER_JOBS', title: `📡 Kazi Mpya (${openCount})` },
    { id: '00', title: '🏠 Menyu Kuu' },
  ];
  await deps.saveSession(session, dbAdmin);

  return (
    `🚖 *KAZI ZANGU — ${drvName}*\n\n` +
    `📌 *Hali:* ${isOnline ? '🟢 Online (Unapokea Kazi)' : '🔴 Offline'}\n` +
    `🛵 *Chombo:* ${driver.driverType || driver.vehicleType || 'Usafiri'} (${driver.plateNumber || driver.vehicleNumber || '-'})\n` +
    `💰 *Mapato ya Leo:* *TZS ${earnToday.toLocaleString()}/=* (Safari ${doneToday.length})\n` +
    `📡 *Kazi Zinazosubiri Karibu:* ${openCount}`
  );
}

const DRIVER_VEHICLES = [
  { num: '1', type: 'boda', labelSw: '🏍️ Bodaboda (Pikipiki)', labelEn: '🏍️ Bodaboda (Motorbike)' },
  { num: '2', type: 'bajaji', labelSw: '🛺 Bajaji', labelEn: '🛺 Bajaji (TukTuk)' },
  { num: '3', type: 'taxi', labelSw: '🚖 Teksi / Gari la Abiria', labelEn: '🚖 Taxi / Ride Car' },
  { num: '4', type: 'kirikuu', labelSw: '🚚 Kirikuu / Gari la Mizigo', labelEn: '🚚 Cargo / Kirikuu Truck' },
];

const FUNDI_SPECIALTIES = [
  { num: '1', key: 'Fundi Umeme', labelSw: '⚡ Fundi Umeme (Electrical)' },
  { num: '2', key: 'Fundi Bomba', labelSw: '🚰 Fundi Bomba (Plumbing)' },
  { num: '3', key: 'Fundi AC & Friji', labelSw: '❄️ Fundi AC & Friji' },
  { num: '4', key: 'Seremala & Rangi', labelSw: '🪚 Seremala & Rangi' },
  { num: '5', key: 'Usafi & Bustani', labelSw: '🧹 Usafi & Bustani' },
  { num: '6', key: 'Fundi Mkuu Mwingine', labelSw: '🔧 Ufundi Mwingine' },
];

export async function handlePartnerSelfRegFlow(
  params: {
    senderId: string;
    cleanInput: string;
    channel: PartnerMetaChannel;
    dbAdmin: any;
    session: PartnerSessionLike;
    lang: 'sw' | 'en';
    defaultWaPhone: string;
    knownPhone: string;
    deps: PartnerBotDeps;
  }
): Promise<string | null> {
  const { senderId, cleanInput, channel, dbAdmin, session, lang, defaultWaPhone, knownPhone, deps } = params;
  const trimmed = cleanInput.trim();
  const isEn = lang === 'en';
  const waDigits = normalizePartnerWaDigits(defaultWaPhone || senderId);

  const isDriverRegCmd = /^(?:🚖\s*)?(sajili\s*(?:dereva|bodaboda|boda|bajaji|rider)|kuwa\s*dereva|register\s*(?:driver|rider)|CMD:REGISTER_DRIVER|REGISTER_DRIVER)$/i.test(trimmed);
  const isFundiRegCmd = /^(?:🛠️\s*)?(sajili\s*fundi|kuwa\s*fundi|register\s*(?:fundi|handyman)|CMD:REGISTER_FUNDI|REGISTER_FUNDI)$/i.test(trimmed);

  // Start Driver Reg
  if (isDriverRegCmd) {
    session.step = 'DRV_REG_VEHICLE';
    delete session.service;
    session.details = {
      ...(session.details.customerName ? { customerName: session.details.customerName } : {}),
      ...(session.details.phone ? { phone: session.details.phone } : {}),
      ...(session.details.lang ? { lang: session.details.lang } : {}),
      welcomedFirstOpen: true,
    };
    await deps.saveSession(session, dbAdmin);
    const lines = DRIVER_VEHICLES.map((v) => `${v.num}. ${isEn ? v.labelEn : v.labelSw}`).join('\n');
    return isEn
      ? `[[EN_NATIVE]]🚖 *DRIVER / RIDER REGISTRATION*\n\nJoin *Papo Hapo* & receive trip requests directly on *WhatsApp*!\n\nPick your vehicle (*1–4*):\n\n${lines}`
      : `🚖 *SAJILI DEREVA / BODABODA PAPO HAPO*\n\nJiunge upokee oda za abiria & mizigo moja kwa moja *WhatsApp*!\n\nChagua aina ya chombo chako (*1–4*):\n\n${lines}`;
  }

  // Start Fundi Reg
  if (isFundiRegCmd) {
    session.step = 'FUNDI_REG_SPECIALTY';
    delete session.service;
    session.details = {
      ...(session.details.customerName ? { customerName: session.details.customerName } : {}),
      ...(session.details.phone ? { phone: session.details.phone } : {}),
      ...(session.details.lang ? { lang: session.details.lang } : {}),
      welcomedFirstOpen: true,
    };
    await deps.saveSession(session, dbAdmin);
    const lines = FUNDI_SPECIALTIES.map((f) => `${f.num}. ${f.labelSw}`).join('\n');
    return (
      `🛠️ *SAJILI UFUNDI WAKO (PAPOFIX)*\n\n` +
      `Pata wateja wanaotafuta fundi wa karibu kwenye *WhatsApp* na *Papo Hapo App*!\n\n` +
      `Chagua fani yako (*1–6*):\n\n${lines}`
    );
  }

  // Driver Steps
  if (session.step === 'DRV_REG_VEHICLE') {
    const picked = DRIVER_VEHICLES.find((v) => v.num === trimmed || trimmed.toLowerCase().includes(v.type));
    if (!picked) {
      return `⚠️ Tafadhali chagua namba *1* (Bodaboda), *2* (Bajaji), *3* (Teksi), au *4* (Kirikuu):`;
    }
    session.details.drvRegVehicle = picked.type;
    session.details.drvRegVehicleLabel = isEn ? picked.labelEn : picked.labelSw;
    session.step = 'DRV_REG_NAME';
    await deps.saveSession(session, dbAdmin);
    return `✅ Chombo: *${picked.labelSw}*\n\n👤 Andika *Jina lako kamili* _(mfano: Musa Hamisi)_:`;
  }

  if (session.step === 'DRV_REG_NAME') {
    if (trimmed.length < 3 || /^\d+$/.test(trimmed)) {
      return `⚠️ Tafadhali andika jina lako kamili _(mfano: Musa Hamisi)_:`;
    }
    session.details.drvRegName = trimmed;
    session.step = 'DRV_REG_PLATE';
    await deps.saveSession(session, dbAdmin);
    return `👤 Jina: *${trimmed}*\n\n🔢 Andika *Namba ya Chombo (Plate Number)* _(mfano: MC 482 DQR au T 341 EFG)_:`;
  }

  if (session.step === 'DRV_REG_PLATE') {
    if (trimmed.length < 3) {
      return `⚠️ Andika namba sahihi ya plate ya chombo chako _(mfano: MC 482 DQR)_:`;
    }
    session.details.drvRegPlate = trimmed.toUpperCase();
    session.step = 'DRV_REG_AREA';
    session.details.forceAskGpsPin = true;
    await deps.saveSession(session, dbAdmin);
    return `🔢 Plate: *${session.details.drvRegPlate}*\n\n📍 Unafanyia kazi *mtaa / stendi gani*? Bonyeza *Send Location* au andika jina la stendi/eneo:`;
  }

  if (session.step === 'DRV_REG_AREA') {
    if (trimmed.length < 2) {
      return `⚠️ Andika jina la stendi au mtaa unaofanyia kazi _(mfano: Mwenge Stendi)_:`;
    }
    session.details.drvRegArea = trimmed;
    session.step = 'DRV_REG_DOC';
    session.details.quickReplyButtons = [
      { id: 'RUKA', title: isEn ? '⏭️ Skip & Submit' : '⏭️ Ruka & Tuma' },
      { id: '00', title: isEn ? '🏠 Main Menu' : '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return `📍 Stendi/Eneo: *${trimmed}*\n\n🪪 _(Hiari)_ Tuma *picha ya Leseni / NIDA*, andika namba yako ya *NIDA/Leseni*, au bonyeza *Ruka & Tuma*:`;
  }

  if (session.step === 'DRV_REG_DOC') {
    const isPhoto = trimmed.startsWith('__WA_PHOTO_UPLOADED__');
    const isSkip = /^(ruka|skip|2|finish|kamilisha|⏭️.*)$/i.test(trimmed);
    const nidaVal = isPhoto ? 'PHOTO_ATTACHED' : isSkip ? 'PENDING' : trimmed;
    const photoUrl = isPhoto ? session.details.pendingDocPhoto || '' : '';

    const drvName = session.details.drvRegName || 'Dereva Mpya';
    const vehType = session.details.drvRegVehicle || 'boda';
    const plate = session.details.drvRegPlate || '-';
    const area = session.details.drvRegArea || 'Dar es Salaam';
    const coords = session.details.drvRegCoords || { lat: -6.7924, lng: 39.2083 };
    const drvPhone = knownPhone || defaultWaPhone || senderId;
    const drvId = `wa-drv-${Date.now().toString(36)}-${Math.floor(100 + Math.random() * 900)}`;
    const drvCode = `DRV-${Math.floor(1000 + Math.random() * 9000)}`;

    if (dbAdmin) {
      await dbAdmin
        .collection('users')
        .doc(drvId)
        .set(
          cleanUndefined({
            id: drvId,
            uid: drvId,
            bookingCode: drvCode,
            displayName: drvName,
            name: drvName,
            role: 'rider',
            driverType: vehType,
            vehicleType: vehType,
            plateNumber: plate,
            vehicleNumber: plate,
            areaName: area,
            location: coords,
            nidaNumber: nidaVal,
            licensePhotoUrl: photoUrl || undefined,
            phone: drvPhone,
            phoneNumber: drvPhone,
            whatsappNumber: waDigits,
            metaSenderId: senderId,
            metaChannel: channel,
            approvalStatus: 'pending',
            isOnline: false,
            rating: 5.0,
            source: 'whatsapp_self_reg',
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        )
        .catch(() => {});

      await dbAdmin
        .collection('notifications')
        .add(
          cleanUndefined({
            type: 'driver_registration',
            title: `🚖 Dereva Mpya Kutoka WhatsApp: ${drvName}`,
            message: `${drvName} (${vehType.toUpperCase()} • ${plate}) kutoka ${area} • Simu: ${drvPhone} (#${drvCode})`,
            userId: drvId,
            bookingCode: drvCode,
            read: false,
            createdAt: new Date(),
          })
        )
        .catch(() => {});
    }

    delete session.details.pendingDocPhoto;
    session.step = 'COLLECTING_ROUTE';
    delete session.service;
    session.details.quickReplyButtons = [
      { id: 'CMD:DRIVER_HUB', title: '🚖 Kazi Zangu' },
      { id: '00', title: '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);

    return (
      `🎉 *OMBI LA UDEREVA LIMEPOKELEWA!* (#${drvCode})\n\n` +
      `👤 *Jina:* ${drvName}\n` +
      `🚖 *Chombo:* ${session.details.drvRegVehicleLabel || vehType} (${plate})\n` +
      `📍 *Stendi/Eneo:* ${area}\n` +
      `📞 *WhatsApp:* ${drvPhone}\n\n` +
      `✅ Msimamizi (*Admin*) amepokea ombi lako. Ukishaidhinishwa utapokea ujumbe wa pongezi hapa hapa *WhatsApp* na kuanza kupokea kazi!`
    );
  }

  // Fundi Steps
  if (session.step === 'FUNDI_REG_SPECIALTY') {
    const picked = FUNDI_SPECIALTIES.find((f) => f.num === trimmed || trimmed.toLowerCase().includes(f.key.toLowerCase()));
    if (!picked) {
      return `⚠️ Chagua namba ya fani yako (*1–6*):`;
    }
    session.details.fundiSpec = picked.key;
    session.details.fundiSpecLabel = picked.labelSw;
    session.step = 'FUNDI_REG_NAME';
    await deps.saveSession(session, dbAdmin);
    return `✅ Fani: *${picked.labelSw}*\n\n🛠️ Andika *Jina lako au Jina la Kampuni yako ya Ufundi* _(mfano: Fundi Juma Umeme)_:`;
  }

  if (session.step === 'FUNDI_REG_NAME') {
    if (trimmed.length < 3 || /^\d+$/.test(trimmed)) {
      return `⚠️ Andika jina sahihi la huduma yako _(mfano: Fundi Juma Umeme)_:`;
    }
    session.details.fundiName = trimmed;
    session.step = 'FUNDI_REG_AREA';
    session.details.forceAskGpsPin = true;
    await deps.saveSession(session, dbAdmin);
    return `🛠️ Jina: *${trimmed}*\n\n📍 Unafanyia kazi *mtaa / eneo gani*? Bonyeza *Send Location* au andika eneo:`;
  }

  if (session.step === 'FUNDI_REG_AREA') {
    if (trimmed.length < 2) {
      return `⚠️ Andika jina la mtaa au eneo unalopatikana _(mfano: Sinza Mori)_:`;
    }
    session.details.fundiArea = trimmed;
    const candPhone = knownPhone || defaultWaPhone;
    if (candPhone) session.details.vendorRegCandidatePhone = candPhone;
    session.step = 'FUNDI_REG_PHONE';
    session.details.quickReplyButtons = candPhone
      ? [
          { id: '1', title: '📱 Tumia Namba Hii' },
          { id: '00', title: '🏠 Menyu Kuu' },
        ]
      : [{ id: '00', title: '🏠 Menyu Kuu' }];
    await deps.saveSession(session, dbAdmin);
    return candPhone
      ? `📍 Eneo: *${trimmed}*\n\n📞 Thibitisha *Namba ya Simu / WhatsApp* kwa wateja:\n1. 📱 Tumia *${candPhone}*\n_Au andika namba nyingine:_`
      : `📍 Eneo: *${trimmed}*\n\n📞 Andika *Namba ya Simu / WhatsApp* kwa wateja:`;
  }

  if (session.step === 'FUNDI_REG_PHONE') {
    let p = trimmed;
    if ((p === '1' || p.toLowerCase() === 'ndio') && (session.details.vendorRegCandidatePhone || waDigits)) {
      p = session.details.vendorRegCandidatePhone || `+${waDigits}`;
    }
    if (p.replace(/\D/g, '').length < 9) {
      return `⚠️ Weka namba sahihi ya simu _(mfano: 0712345678)_:`;
    }
    session.details.fundiPhone = p;
    session.step = 'FUNDI_REG_RATE';
    session.details.quickReplyButtons = [
      { id: 'RUKA', title: '⏭️ Ruka & Tuma' },
      { id: '00', title: '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);
    return `📞 Simu: *${p}*\n\n💰 _(Hiari)_ Andika *Huduma na Bei ya Kuanzia* _(mfano: Kutengeneza AC - 20000)_ au bonyeza *Ruka & Tuma*:`;
  }

  if (session.step === 'FUNDI_REG_RATE') {
    const isSkip = /^(ruka|skip|2|kamilisha|⏭️.*)$/i.test(trimmed);
    const priceMatch = trimmed.match(/(?:[-–:|]|\btzs\b|\btsh\b)\s*([\d,]{3,})\s*$/i) || trimmed.match(/(\d{3,})\s*$/);
    const rateAmt = !isSkip && priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 15000;
    const svcDesc = !isSkip && trimmed.length >= 2
      ? (priceMatch ? trimmed.slice(0, priceMatch.index).replace(/[-–:|]+$/, '').trim() : trimmed)
      : session.details.fundiSpec || 'Ufundi wa Uhakika';

    const fName = session.details.fundiName || 'Fundi Papo Hapo';
    const fArea = session.details.fundiArea || 'Dar es Salaam';
    const fCoords = session.details.fundiCoords || { lat: -6.7924, lng: 39.2083 };
    const fPhone = session.details.fundiPhone || defaultWaPhone || senderId;
    const fId = `wa-fnd-${Date.now().toString(36)}-${Math.floor(100 + Math.random() * 900)}`;
    const fCode = `FND-${Math.floor(1000 + Math.random() * 9000)}`;

    if (dbAdmin) {
      await dbAdmin
        .collection('vendors')
        .doc(fId)
        .set(
          cleanUndefined({
            id: fId,
            bookingCode: fCode,
            ownerUid: `meta-${channel}-${senderId.replace(/[^a-zA-Z0-9]/g, '')}`,
            businessName: fName,
            category: 'handyman',
            specialty: session.details.fundiSpec,
            description: `${session.details.fundiSpecLabel || 'Fundi'} • ${svcDesc} (Kuanzia TZS ${rateAmt.toLocaleString()})`,
            address: fArea,
            location: fCoords,
            status: 'pending',
            isApproved: false,
            isOpen: true,
            phoneNumber: fPhone,
            whatsappNumber: normalizePartnerWaDigits(fPhone) || waDigits,
            metaSenderId: senderId,
            metaChannel: channel,
            socialLinks: { whatsapp: normalizePartnerWaDigits(fPhone) || fPhone },
            rating: 5.0,
            source: 'whatsapp_self_reg',
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        )
        .catch(() => {});

      await dbAdmin
        .collection('products')
        .doc(`wa-prd-${Date.now().toString(36)}`)
        .set(
          cleanUndefined({
            vendorId: fId,
            vendorName: fName,
            vendorCategory: 'handyman',
            name: `${svcDesc || session.details.fundiSpec} (${fName})`,
            price: rateAmt,
            description: `${session.details.fundiSpecLabel} • Eneo: ${fArea}`,
            status: 'available',
            hidden: false,
            source: 'whatsapp_self_reg',
            createdAt: new Date(),
          })
        )
        .catch(() => {});

      await dbAdmin
        .collection('notifications')
        .add(
          cleanUndefined({
            type: 'vendor_registration',
            title: `🛠️ Fundi Mpya Kutoka WhatsApp: ${fName}`,
            message: `${fName} (${session.details.fundiSpec}) kutoka ${fArea} • Simu: ${fPhone} (#${fCode})`,
            vendorId: fId,
            bookingCode: fCode,
            read: false,
            createdAt: new Date(),
          })
        )
        .catch(() => {});
    }

    session.step = 'COLLECTING_ROUTE';
    delete session.service;
    session.details.quickReplyButtons = [
      { id: 'CMD:MY_SHOP', title: '🏪 Akaunti Yangu' },
      { id: '00', title: '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);

    return (
      `🎉 *OMBI LA UFUNDI LIMEPOKELEWA!* (#${fCode})\n\n` +
      `🛠️ *Jina:* ${fName}\n` +
      `📂 *Fani:* ${session.details.fundiSpecLabel}\n` +
      `📍 *Eneo:* ${fArea}\n` +
      `💰 *Kuanzia:* TZS ${rateAmt.toLocaleString()}/=\n\n` +
      `✅ Limewasilishwa kwa Msimamizi (*Admin*) kwa uthibitisho wa haraka. Likishaidhinishwa utapokea ujumbe WhatsApp!`
    );
  }

  return null;
}

export async function validatePromoCodeForWhatsApp(
  dbAdmin: any,
  params: { code: string; vendorId?: string; subtotal: number }
): Promise<{ valid: boolean; couponId?: string; code?: string; discountAmount: number; reason?: string }> {
  const cleanCode = params.code.trim().toUpperCase().replace(/^#/, '');
  if (!cleanCode || !dbAdmin) {
    return { valid: false, discountAmount: 0, reason: 'Kodi si sahihi.' };
  }
  try {
    const snap = await dbAdmin.collection('coupons').where('code', '==', cleanCode).limit(10).get();
    if (snap.empty) {
      return { valid: false, discountAmount: 0, reason: `Kuponi *${cleanCode}* haipatikani.` };
    }
    const docs = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() || {}) }));
    const matched =
      docs.find((c: any) => !params.vendorId || c.vendorId === params.vendorId || !c.vendorId || c.vendorId === 'global') ||
      docs[0];

    if (matched.status && matched.status !== 'active') {
      return { valid: false, discountAmount: 0, reason: `Kuponi *${cleanCode}* haifanyi kazi kwa sasa.` };
    }
    if (matched.maxUsage && Number(matched.usageCount || 0) >= Number(matched.maxUsage)) {
      return { valid: false, discountAmount: 0, reason: `Kuponi *${cleanCode}* imekwisha matumizi yake.` };
    }
    const minOrder = Number(matched.minOrderAmount || 0);
    if (minOrder > 0 && params.subtotal < minOrder) {
      return {
        valid: false,
        discountAmount: 0,
        reason: `Kuponi *${cleanCode}* inahitaji oda ya angalau *TZS ${minOrder.toLocaleString()}*.`,
      };
    }

    const val = Number(matched.discountValue || 0);
    const discountAmount =
      matched.discountType === 'percentage'
        ? Math.min(params.subtotal, Math.round((params.subtotal * val) / 100))
        : Math.min(params.subtotal, val);

    if (discountAmount <= 0) {
      return { valid: false, discountAmount: 0, reason: `Kuponi *${cleanCode}* haina thamani ya punguzo.` };
    }

    return { valid: true, couponId: matched.id, code: cleanCode, discountAmount };
  } catch {
    return { valid: false, discountAmount: 0, reason: 'Imeshindikana kuhakiki kuponi.' };
  }
}

export async function awardWhatsAppOrderLoyalty(
  dbAdmin: any,
  params: {
    vendorId?: string;
    customerPhone?: string;
    customerName?: string;
    orderTotal: number;
    couponId?: string;
    redeemPointsVendorId?: string;
  }
): Promise<{ earnedPoints: number; currentPoints: number; earnedReward: boolean } | null> {
  if (!dbAdmin || !params.customerPhone) return null;
  const cleanPhone = String(params.customerPhone).replace(/\D/g, '');
  if (cleanPhone.length < 9) return null;
  const targetVendorId = params.vendorId || 'papo-hapo-express';
  const last9 = cleanPhone.slice(-9);

  try {
    if (params.couponId) {
      const cSnap = await dbAdmin.collection('coupons').doc(params.couponId).get().catch(() => null);
      if (cSnap?.exists) {
        await dbAdmin
          .collection('coupons')
          .doc(params.couponId)
          .update({ usageCount: Number(cSnap.data()?.usageCount || 0) + 1 })
          .catch(() => {});
      }
    }

    const cardsSnap = await dbAdmin
      .collection('vendors')
      .doc(targetVendorId)
      .collection('loyalty_cards')
      .limit(50)
      .get()
      .catch(() => ({ docs: [] }));

    let existingDoc: any = null;
    for (const d of cardsSnap.docs || []) {
      const cd = d.data() || {};
      if (partnerPhoneLast9(cd.customerPhone) === last9) {
        existingDoc = { id: d.id, ...cd };
        break;
      }
    }

    const earnedPoints = Math.max(5, Math.floor((Math.max(0, params.orderTotal) / 1000) * 10));
    let currentStamps = Number(existingDoc?.currentStamps || 0) + 1;
    let availableRewards = Number(existingDoc?.availableRewards || 0);
    let currentPoints = Number(existingDoc?.currentPoints || 0) + earnedPoints;
    if (params.redeemPointsVendorId === targetVendorId && availableRewards > 0) {
      availableRewards = Math.max(0, availableRewards - 1);
    }

    let earnedReward = false;
    if (currentStamps >= 5) {
      availableRewards += 1;
      currentStamps = 0;
      earnedReward = true;
    }

    const payload = cleanUndefined({
      vendorId: targetVendorId,
      customerPhone: cleanPhone,
      customerName: params.customerName || existingDoc?.customerName || 'Mteja',
      currentStamps,
      totalStampsEarned: Number(existingDoc?.totalStampsEarned || 0) + 1,
      availableRewards,
      currentPoints,
      totalPointsEarned: Number(existingDoc?.totalPointsEarned || 0) + earnedPoints,
      redeemedRewardsCount: Number(existingDoc?.redeemedRewardsCount || 0),
      lastOrderDate: new Date(),
      updatedAt: new Date(),
    });

    if (existingDoc?.id) {
      await dbAdmin.collection('vendors').doc(targetVendorId).collection('loyalty_cards').doc(existingDoc.id).set(payload, { merge: true });
    } else {
      await dbAdmin.collection('vendors').doc(targetVendorId).collection('loyalty_cards').add({ ...payload, createdAt: new Date() });
    }

    return { earnedPoints, currentPoints, earnedReward };
  } catch {
    return null;
  }
}

export async function handleLoyaltyAndReorderCommands(
  params: {
    senderId: string;
    cleanInput: string;
    channel: PartnerMetaChannel;
    dbAdmin: any;
    session: PartnerSessionLike;
    lang: 'sw' | 'en';
    knownPhone: string;
    defaultWaPhone: string;
    deps: PartnerBotDeps;
  }
): Promise<string | null> {
  const { senderId, cleanInput, channel, dbAdmin, session, lang, knownPhone, defaultWaPhone, deps } = params;
  const trimmed = cleanInput.trim();
  const isEn = lang === 'en';
  const lookupPhone = knownPhone || defaultWaPhone || senderId;
  const targetLast9 = partnerPhoneLast9(lookupPhone);

  const isLoyaltyCmd = /^(?:🎁\s*)?(pointi(\s*zangu)?|zawadi(\s*zangu)?|loyalty|kuponi|promo\s*codes?|CMD:LOYALTY_INFO|LOYALTY_INFO)$/i.test(trimmed);
  const isReorderCmd = /^(?:🔁\s*)?(agiza\s*tena|rudia\s*oda|reorder|CMD:REORDER_LAST|REORDER_LAST)$/i.test(trimmed);
  const promoApplyMatch = trimmed.match(/^(?:kuponi|promo|coupon|code)\s+#?([A-Za-z0-9_-]{3,24})$/i);

  // Allow applying a promo code mid-checkout (SELECTING_PAYMENT_METHOD / CONFIRMING_TRIP / CART_WAIT_PAYMENT)
  if (
    promoApplyMatch &&
    (session.step === 'SELECTING_PAYMENT_METHOD' ||
      session.step === 'CONFIRMING_TRIP' ||
      session.step === 'CART_WAIT_PAYMENT')
  ) {
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
    const res = await validatePromoCodeForWhatsApp(dbAdmin, {
      code: promoApplyMatch[1],
      vendorId: session.details?.selectedVendorId,
      subtotal: Math.max(0, subtotal),
    });
    if (!res.valid) {
      return `⚠️ ${res.reason}\n\nEndelea kuchagua malipo (*1–4*) au jaribu kodi nyingine:`;
    }
    session.details.appliedPromoCode = res.code;
    session.details.appliedCouponId = res.couponId;
    session.details.promoDiscount = res.discountAmount;
    const redeemDiscount = Number(session.details?.redeemDiscount || 0);
    const netTotal = Math.max(0, subtotal - res.discountAmount - redeemDiscount);
    await deps.saveSession(session, dbAdmin);
    return (
      `🎁 *KUPONI IMETUMIKA: ${res.code}!*\n` +
      `✂️ *Punguzo:* -TZS ${res.discountAmount.toLocaleString()}/=\n` +
      `💰 *Kiasi Kipya cha Kulipa:* *TZS ${netTotal.toLocaleString()}/=*\n\n` +
      `Sasa chagua njia ya malipo (*1. Cash, 2. M-Pesa, 3. Tigo Pesa, 4. Airtel Money*) au andika *Ndio* kuthibitisha:`
    );
  }

  // Handle Loyalty & Coupons summary
  if (isLoyaltyCmd) {
    let totalPoints = 0;
    let totalRewards = 0;
    const shopSummaries: string[] = [];
    const activeCoupons: string[] = [];

    if (dbAdmin) {
      try {
        const [vSnap, cSnap] = await Promise.all([
          dbAdmin.collection('vendors').limit(60).get().catch(() => ({ docs: [] })),
          dbAdmin.collection('coupons').limit(20).get().catch(() => ({ docs: [] })),
        ]);
        const vendorTargets: Array<{ id: string; label: string }> = (vSnap.docs || []).map((vd: any) => ({
          id: vd.id,
          label: vd.data()?.businessName || vd.data()?.name || 'Duka',
        }));
        if (!vendorTargets.some((v) => v.id === 'papo-hapo-express')) {
          vendorTargets.push({ id: 'papo-hapo-express', label: 'Papo Hapo Express / Safari' });
        }
        const vendorChecks = vendorTargets.map(async (vt) => {
          const cardsSnap = await dbAdmin.collection('vendors').doc(vt.id).collection('loyalty_cards').limit(30).get().catch(() => ({ docs: [] }));
          for (const cd of cardsSnap.docs || []) {
            const c = cd.data() || {};
            if (partnerPhoneLast9(c.customerPhone) === targetLast9) {
              const pts = Number(c.currentPoints || 0);
              const rw = Number(c.availableRewards || 0);
              totalPoints += pts;
              totalRewards += rw;
              shopSummaries.push(`• *${vt.label}*: ${pts} Pointi • Stempu ${c.currentStamps || 0}/5${rw > 0 ? ` 🎁 (${rw} Zawadi Bure!)` : ''}`);
            }
          }
        });
        await Promise.all(vendorChecks);

        for (const cDoc of cSnap.docs || []) {
          const c = cDoc.data() || {};
          if (c.status && c.status !== 'active') continue;
          const desc = c.discountType === 'percentage' ? `${c.discountValue}% OFF` : `TZS ${Number(c.discountValue || 0).toLocaleString()} OFF`;
          activeCoupons.push(`• *${c.code}* — ${desc}${c.minOrderAmount ? ` _(Oda kuanzia TZS ${Number(c.minOrderAmount).toLocaleString()})_` : ''}`);
        }
      } catch {}
    }

    session.details.quickReplyButtons = [
      { id: 'CMD:REDEEM_POINTS', title: isEn ? '💎 Redeem Points' : '💎 Komboa Pointi' },
      { id: 'CMD:REFERRAL_INFO', title: isEn ? '🤝 Invite Friend' : '🤝 Alika Rafiki' },
      { id: '00', title: isEn ? '🏠 Main Menu' : '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);

    const pointsValueTzs = totalPoints * 20;
    return (
      `🎁 *POINTI ZAKO & KUPONI ZA PUNGUZO*\n\n` +
      `⭐ *Jumla ya Pointi:* ${totalPoints} pts *(~TZS ${pointsValueTzs.toLocaleString()}/=)*\n` +
      `🏆 *Zawadi za Bure Tayari:* ${totalRewards}\n` +
      (shopSummaries.length > 0 ? `\n*Kadi Zako za Uaminifu:*\n${shopSummaries.join('\n')}\n` : `\n_Agiza chakula au bidhaa kukusanya stempu na pointi za bure!_\n`) +
      (activeCoupons.length > 0 ? `\n🎟️ *Kuponi Zinazotumika Sasa:*\n${activeCoupons.slice(0, 5).join('\n')}\n` : '') +
      `\n💡 _Unapolipa oda WhatsApp, andika *KUPONI KODI* au *KOMBOA* kupata punguzo papo hapo!_`
    );
  }

  // Handle Reorder confirmation buttons
  if (session.step === 'REORDER_CONFIRM') {
    const target = session.details.lastReorderTarget;
    if (!target) {
      session.step = 'COLLECTING_ROUTE';
      await deps.saveSession(session, dbAdmin);
      return `⚠️ Taarifa za oda ya kurudia hazikupatikana. Andika *Menu* kuanza oda mpya.`;
    }
    const isCash = /^(?:1|cash|REORDER_CONF_CASH)$/i.test(trimmed);
    const isMomo = /^(?:2|mpesa|momo|REORDER_CONF_MOMO)$/i.test(trimmed);
    if (!isCash && !isMomo) {
      session.details.quickReplyButtons = [
        { id: 'REORDER_CONF_CASH', title: '💵 Agiza (Cash)' },
        { id: 'REORDER_CONF_MOMO', title: '📱 Agiza (Simu)' },
        { id: '00', title: '🏠 Menyu Kuu' },
      ];
      await deps.saveSession(session, dbAdmin);
      return `⚠️ Chagua *💵 Agiza (Cash)* au *📱 Agiza (Simu)* kuthibitisha kurudia oda ya *${target.vendorName}*:`;
    }

    const prefix = target.type === 'restaurant' || target.type === 'food' ? 'FD' : 'ML';
    const newCode = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    const custName = session.details.customerName || 'Mteja wa WhatsApp';
    const payMethod = isCash ? 'cash' : 'mpesa';
    const payLabel = isCash ? 'Cash (Pesa Taslimu) 💵' : 'Mobile Money (Mongike Push) 📱';

    if (deps.triggerAutomatedOrder) {
      await deps.triggerAutomatedOrder(
        dbAdmin,
        target.vendorId || 'papo-hapo-express',
        target.type || 'ecommerce',
        target.items || [],
        Number(target.totalAmount || 0),
        lookupPhone,
        custName,
        `Reorder #${newCode} from #${target.code || ''}`,
        channel,
        {
          bookingCode: newCode,
          vendorName: target.vendorName,
          deliveryAddress: target.deliveryAddress || 'Dar es Salaam',
          orderType: 'delivery',
          paymentMethod: payMethod,
          paymentMethodLabel: payLabel,
          metaSenderId: senderId,
          metaChannel: channel,
        }
      );
    }

    await awardWhatsAppOrderLoyalty(dbAdmin, {
      vendorId: target.vendorId,
      customerPhone: lookupPhone,
      customerName: custName,
      orderTotal: Number(target.totalAmount || 0),
    });

    session.step = 'COLLECTING_ROUTE';
    delete session.service;
    session.details.quickReplyButtons = [
      { id: 'CMD:MY_ORDERS', title: '📋 Oda Zangu' },
      { id: '00', title: '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);

    return (
      `🎉 *ODA IMERUDIWA PAPO HAPO!* (#${newCode})\n\n` +
      `🏪 *Biashara:* ${target.vendorName}\n` +
      `🛒 *Vitu:* ${(target.items || []).map((it: any) => `${it.name} x${it.quantity || 1}`).join(', ')}\n` +
      `💰 *Jumla:* *TZS ${Number(target.totalAmount || 0).toLocaleString()}/=*\n` +
      `💳 *Malipo:* ${payLabel}\n\n` +
      `🔗 *Fuatilia:* ${deps.buildOrdersTrackingUrl(lookupPhone, newCode)}`
    );
  }

  // Initiate Reorder Last
  if (isReorderCmd && dbAdmin) {
    let target = session.details.lastReorderTarget;
    if (!target) {
      const oSnap = await dbAdmin.collection('orders').limit(80).get().catch(() => ({ docs: [] }));
      const matches = (oSnap.docs || [])
        .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
        .filter((o: any) => {
          if (String(o.status || '').toLowerCase() === 'cancelled') return false;
          if (!Array.isArray(o.items) || o.items.length === 0) return false;
          return partnerPhoneLast9(o.customerPhone) === targetLast9 || String(o.customerId || '').includes(senderId);
        })
        .sort((a: any, b: any) => normalizeEpoch(b.createdAt) - normalizeEpoch(a.createdAt));

      if (matches.length > 0) {
        const latest = matches[0];
        target = {
          orderId: latest.id,
          code: String(latest.bookingCode || latest.id.slice(-6)).toUpperCase(),
          vendorId: latest.vendorId,
          vendorName: latest.vendorName || 'Duka',
          items: latest.items,
          totalAmount: Number(latest.totalAmount || latest.total || 0),
          deliveryAddress: latest.deliveryAddress || 'Dar es Salaam',
          type: latest.type || 'ecommerce',
        };
      }
    }

    if (!target) {
      session.details.quickReplyButtons = [{ id: '00', title: '🏠 Menyu Kuu' }];
      await deps.saveSession(session, dbAdmin);
      return `ℹ️ Hatujapata oda ya zamani ya kurudia kwenye namba hii bado. Bonyeza *Menyu Kuu* kuanza oda mpya!`;
    }

    session.details.lastReorderTarget = target;
    session.step = 'REORDER_CONFIRM';
    session.details.quickReplyButtons = [
      { id: 'REORDER_CONF_CASH', title: '💵 Agiza (Cash)' },
      { id: 'REORDER_CONF_MOMO', title: '📱 Agiza (Simu)' },
      { id: '00', title: '🏠 Menyu Kuu' },
    ];
    await deps.saveSession(session, dbAdmin);

    const itemLines = (target.items || []).map((it: any) => `• ${it.name} x${it.quantity || 1}`).join('\n');
    return (
      `🔁 *AGIZA TENA — ODA #${target.code}*\n\n` +
      `🏪 *Duka/Mgahawa:* ${target.vendorName}\n` +
      `${itemLines}\n` +
      `📍 *Eneo:* ${target.deliveryAddress || '-'}\n` +
      `💰 *Jumla:* *TZS ${Number(target.totalAmount || 0).toLocaleString()}/=*\n\n` +
      `Thibitisha njia ya malipo kuagiza mara moja:`
    );
  }

  return null;
}
