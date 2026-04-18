import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin for server-side updates
if (!getApps().length) {
  initializeApp({
    // We assume the service account or default credentials are provided in the environment via standard GOOGLE_APPLICATION_CREDENTIALS
    // or we just rely on the environment being already authenticated for Firestore
  });
}

const db = getFirestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Mongike sends the order_id and status in the body
  const { order_id, status, gateway_ref } = req.body;

  console.log(`Received webhook for order ${order_id}: ${status}`);

  if (!order_id) {
    return res.status(200).json({ message: 'No order ID provided' });
  }

  try {
    // Find the order in Firestore and update its payment status
    // Note: status from Mongike is usually "COMPLETED" or similar for paid orders
    if (status === 'COMPLETED' || status === 'SUCCESS' || status === 'PAID') {
      const orderRef = db.collection('orders').doc(order_id);
      await orderRef.update({
        paymentStatus: 'paid',
        updatedAt: new Date().toISOString(),
        gatewayRef: gateway_ref || null
      });
      console.log(`Order ${order_id} marked as paid via webhook`);
    }

    return res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    // Still return 200 to Mongike to stop retries, but log the error
    return res.status(200).json({ status: 'error', message: 'Internal processing failed' });
  }
}
