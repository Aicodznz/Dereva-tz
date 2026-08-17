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

