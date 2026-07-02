import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { senderId, message, channel } = req.body || {};
    if (!senderId || !message || !channel) {
      return res.status(400).json({ error: "senderId, message, and channel are required" });
    }

    console.log(`[Meta Simulator Vercel] Simulation from ${channel}:${senderId}: "${message}"`);

    const { getFirestoreDb } = await import('../_lib/getFirestoreDb');
    const { handleMetaInput } = await import('../../src/lib/metaBot');

    const dbAdmin = getFirestoreDb();
    const reply = await handleMetaInput(senderId, message, channel, dbAdmin);

    if (dbAdmin) {
      try {
        await dbAdmin.collection('meta_chats').add({
          channel,
          senderId,
          message,
          reply,
          timestamp: new Date()
        });
      } catch (err) {
        console.warn("[Meta Simulator Vercel] Could not write chat to Firestore:", err);
      }
    }

    return res.status(200).json({ reply, status: "success" });
  } catch (error: any) {
    console.error("[Meta Simulator Vercel] Processing error:", error);
    return res.status(500).json({ error: "Failed to simulate Meta response", details: error?.message || String(error) });
  }
}
