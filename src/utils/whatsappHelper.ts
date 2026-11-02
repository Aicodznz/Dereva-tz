import { Order } from '../types';

/**
 * Normalizes any Tanzanian / East African phone number to clean international format (e.g. 255712345678)
 */
export function formatPhoneForWhatsApp(phone?: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith('0')) {
    cleaned = '255' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('255') && cleaned.length === 9) {
    cleaned = '255' + cleaned;
  }
  return cleaned;
}

/**
 * Builds a WhatsApp URL with formatted digital receipt for the customer
 */
export function buildCustomerReceiptWhatsAppUrl(
  order: any, 
  vendorName: string, 
  targetCustomerPhone?: string
): string {
  const phone = formatPhoneForWhatsApp(targetCustomerPhone || order.customerPhone || order.buyerPhone);
  const itemsText = (order.items || [])
    .map((it: any, idx: number) => {
      const name = it.name || it.productName || 'Chakula/Kinywaji';
      const qty = it.quantity || 1;
      const price = (it.price || 0) * qty;
      const notes = it.selectedAddons?.length ? ` (${it.selectedAddons.join(', ')})` : '';
      return `${idx + 1}. *${name}* x${qty}${notes} - TZS ${price.toLocaleString()}`;
    })
    .join('\n');

  const discountText = order.discountAmount && order.discountAmount > 0 
    ? `\n🎉 *Punguzo (${order.couponCode || 'Ofa'}):* -TZS ${order.discountAmount.toLocaleString()}`
    : '';

  const tableText = order.tableNumber 
    ? `🍽️ *Meza:* #${order.tableNumber}\n` 
    : (order.orderType === 'delivery' ? '🛵 *Aina:* Delivery (Usafirishaji)\n' : '🛍️ *Aina:* Kujichukulia (Pickup)\n');

  const message = `🧾 *STAKABADHI YA KIDIGITALI - PAPO HAPO*
━━━━━━━━━━━━━━━━━━━━
🏪 *Mgahawa/Duka:* *${vendorName || 'Papo Hapo'}*
🔢 *Nambari ya Oda:* #${order.id ? String(order.id).slice(-6).toUpperCase() : 'REC-' + Date.now().toString().slice(-4)}
📅 *Tarehe:* ${new Date().toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
${tableText}👤 *Mteja:* ${order.customerName || 'Mteja Mpendwa'}
━━━━━━━━━━━━━━━━━━━━
*ORODHA YA VYAKULA / BIDHAA:*
${itemsText}
━━━━━━━━━━━━━━━━━━━━
💰 *Jumla Ndogo (Subtotal):* TZS ${(order.originalSubtotal || order.subtotal || order.totalAmount).toLocaleString()}${discountText}
${order.deliveryFee ? `🛵 *Usafiri:* TZS ${order.deliveryFee.toLocaleString()}\n` : ''}💵 *JUMLA KUU:* *TZS ${order.totalAmount?.toLocaleString()}*
💳 *Hali ya Malipo:* ${order.paymentStatus === 'paid' ? '✅ LIMELIPWA' : '⏳ INASUBIRI MALIPO'}
━━━━━━━━━━━━━━━━━━━━
✨ *Asante kwa kutuchagua! Karibu tena ${vendorName || 'Papo Hapo'}!*
🌐 Agiza tena kupitia: ${window.location.origin}`;

  const encoded = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
}

/**
 * Builds a WhatsApp URL for immediate kitchen / cashier order dispatch
 */
export function buildKitchenOrderWhatsAppUrl(
  kitchenPhone: string,
  order: any,
  vendorName: string
): string {
  const phone = formatPhoneForWhatsApp(kitchenPhone);
  const itemsText = (order.items || [])
    .map((it: any, idx: number) => {
      const name = it.name || it.productName || 'Bidhaa';
      const qty = it.quantity || 1;
      const notes = it.notes || it.specialInstructions ? `\n   ⚠️ _Maagizo: ${it.notes || it.specialInstructions}_` : '';
      const addons = it.selectedAddons?.length ? `\n   ➕ _Nyongeza: ${it.selectedAddons.join(', ')}_` : '';
      return `👉 *${qty}x* *${name}*${addons}${notes}`;
    })
    .join('\n');

  const tableOrType = order.tableNumber 
    ? `🍽️ *MEZA #${order.tableNumber}*` 
    : (order.orderType === 'delivery' ? '🛵 *DELIVERY ODA*' : '🛍️ *TAKEAWAY / PICKUP*');

  const message = `🔔 *ODA MPYA YA JIKONI (KITCHEN ALERT)*
━━━━━━━━━━━━━━━━━━━━
🏪 *${vendorName || 'JIKONI'}*
📌 *ENEO:* ${tableOrType}
🔢 *Oda ID:* #${order.id ? String(order.id).slice(-6).toUpperCase() : 'NEW'}
⏰ *Muda:* ${new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}
👤 *Mteja:* ${order.customerName || 'Mteja'} (${order.customerPhone || 'Bila Namba'})
━━━━━━━━━━━━━━━━━━━━
👨‍🍳 *VYAKULA VYA KUANDAA:*
${itemsText}
━━━━━━━━━━━━━━━━━━━━
${order.specialInstructions ? `📝 *Maelezo ya Ziada:* ${order.specialInstructions}\n━━━━━━━━━━━━━━━━━━━━\n` : ''}💰 *Jumla:* TZS ${order.totalAmount?.toLocaleString()} | *Hali:* ${order.paymentStatus === 'paid' ? '✅ IMELIPWA' : '⏳ HAIJALIPWA'}`;

  const encoded = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
}

/**
 * Builds a WhatsApp URL for daily revenue and order summary to the manager
 */
export function buildDailySummaryWhatsAppUrl(
  managerPhone: string,
  vendorName: string,
  stats: {
    totalRevenue: number;
    paidOrdersCount: number;
    pendingOrdersCount: number;
    topItems: { name: string; count: number }[];
    dateStr?: string;
  }
): string {
  const phone = formatPhoneForWhatsApp(managerPhone);
  const topText = (stats.topItems || []).slice(0, 5)
    .map((item, idx) => `  ${idx + 1}. *${item.name}* (${item.count} zimeuzwa)`)
    .join('\n');

  const message = `📊 *RIPOTI YA MAUZO YA SIKU - ${vendorName || 'MGAHAWA'}*
━━━━━━━━━━━━━━━━━━━━
📅 *Tarehe:* ${stats.dateStr || new Date().toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric' })}
💰 *Jumla ya Mauzo Leo:* *TZS ${stats.totalRevenue.toLocaleString()}*
✅ *Oda Zilizolipwa:* ${stats.paidOrdersCount}
⏳ *Oda Zisizolipwa:* ${stats.pendingOrdersCount}
━━━━━━━━━━━━━━━━━━━━
🔥 *VYAKULA VILIVYOONGOZA LEO:*
${topText || '  (Bado hakuna data ya kutosha)'}
━━━━━━━━━━━━━━━━━━━━
🚀 _Imetengenezwa kiotomatiki na Papo Hapo Super App_`;

  const encoded = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
}

/**
 * Builds an official WhatsApp Digital Ride Receipt for passengers or drivers
 */
export function buildRideReceiptWhatsAppUrl(
  ride: any,
  targetPhone?: string,
  isDriverCopy: boolean = false
): string {
  const phone = formatPhoneForWhatsApp(targetPhone || (isDriverCopy ? ride.driverPhone : (ride.customerPhone || ride.customerInfo?.phone)));
  const rideId = ride.id ? String(ride.id).slice(-6).toUpperCase() : 'SAF-' + Date.now().toString().slice(-4);
  const dateFormatted = new Date().toLocaleDateString('sw-TZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const pickupName = ride.pickup?.name || ride.pickupAddress || 'Mahali pa Kuanzia';
  const destName = ride.destination?.name || ride.destAddress || ride.destinationAddress || 'Mahali pa Kufika';
  const driverName = ride.driverName || ride.driverInfo?.name || 'Dereva wa Papo Hapo';
  const vehiclePlate = ride.vehiclePlate || ride.driverInfo?.vehiclePlate || ride.driverInfo?.plateNumber || 'TZ-REG';
  const vehicleType = ride.vehicleType || ride.rideType || 'Gari (Taxi)';
  const customerName = ride.customerName || ride.customerInfo?.name || 'Mteja';
  const fare = (ride.fare || ride.totalFare || ride.amount || 0).toLocaleString();
  const paymentMethod = ride.paymentMethod === 'wallet' ? 'Pochi ya Kidigitali' : (ride.paymentMethod === 'mobile_money' ? 'Lipa Namba / M-Pesa' : 'Pesa Taslimu (Cash)');

  const message = `🧾 *RISITI YA SAFARI - PAPO HAPO TANZANIA*
━━━━━━━━━━━━━━━━━━━━
🆔 *Namba ya Safari:* #${rideId}
📅 *Tarehe:* ${dateFormatted}
${isDriverCopy ? `👤 *Nakala ya:* DEREVA (${driverName})` : `👤 *Mteja:* ${customerName}`}
━━━━━━━━━━━━━━━━━━━━
📍 *Kuanzia:* ${pickupName}
🏁 *Kuelekea:* ${destName}
${ride.distance ? `📏 *Umbali:* ${typeof ride.distance === 'number' ? ride.distance.toFixed(1) : ride.distance} km\n` : ''}🚗 *Chombo:* ${vehicleType} (${vehiclePlate})
👨‍✈️ *Dereva:* ${driverName}
━━━━━━━━━━━━━━━━━━━━
💵 *JUMLA YA NAULI:* *TZS ${fare}*
💳 *Njia ya Malipo:* ${paymentMethod}
✅ *Hali:* IMETHIBITISHWA & KUKAMILIKA
━━━━━━━━━━━━━━━━━━━━
✨ *Asante kwa kusafiri nasi salama!*
🌐 Pakua stakabadhi au weka nafasi tena: ${window.location.origin}`;

  const encoded = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
}

/**
 * Builds a WhatsApp URL for requesting a ride via the WhatsApp AI Assistant
 */
export function buildRideRequestWhatsAppUrl(
  assistantPhone: string = '255712345678',
  params: {
    pickup?: string;
    destination?: string;
    vehicleType?: string;
  } = {}
): string {
  const phone = formatPhoneForWhatsApp(assistantPhone);
  const p = params.pickup || 'Mahali nilipo';
  const d = params.destination || 'Mjini Posta';
  const v = params.vehicleType || 'Gari';

  const message = `Habari Papo Hapo AI Assistant! 🚗
Nahitaji usafiri wa *${v}*:
📍 *Kuanzia (Pickup):* ${p}
🏁 *Kuelekea (Destination):* ${d}

Tafadhali nisaidie makadirio ya nauli na dereva aliyepo karibu sasa hivi. Asante!`;

  const encoded = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
}

/**
 * Builds a WhatsApp URL for inquiring about a shop product or ordering via WhatsApp
 */
export function buildProductInquiryWhatsAppUrl(
  assistantOrShopPhone: string = '255712345678',
  productName: string,
  price?: number,
  shopName: string = 'Duka la Papo Hapo'
): string {
  const phone = formatPhoneForWhatsApp(assistantOrShopPhone);
  const priceText = price ? ` kwa TZS ${price.toLocaleString()}` : '';

  const message = `Habari ${shopName}! 🛍️
Nimeona bidhaa hii kwenye mfumo:
👉 *${productName}*${priceText}

Je, ipo stoo? Naomba utaratibu wa kulipia na kuletewa (Delivery). Asante!`;

  const encoded = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
}


