import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import { initiateMongikePayment } from '../_lib/mongike';
import { notifyMongikePaymentPaidToWhatsApp } from '../_lib/metaBot';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { order_id, amount, buyer_phone, fee_payer, collection } = req.body || {};
  const dbAdmin = getFirestoreDb();

  const result = await initiateMongikePayment(
    {
      orderId: String(order_id || ''),
      amount: Number(amount) || 0,
      buyerPhone: String(buyer_phone || ''),
      feePayer: fee_payer === 'CUSTOMER' ? 'CUSTOMER' : 'MERCHANT',
      collection: collection === 'rides' ? 'rides' : 'orders',
    },
    dbAdmin,
    {
      autoSimulateWebhook: true,
      onSimulatedPaid: (info) => notifyMongikePaymentPaidToWhatsApp(info, dbAdmin),
    }
  );

  if (result.status === 'error') {
    return res.status(result.httpStatus || 500).json(result.error || { status: 'error', message: result.message });
  }

  return res.status(result.httpStatus || 201).json({
    status: result.status,
    message: result.message,
    sandbox: result.sandbox,
    data: result.data,
  });
}
