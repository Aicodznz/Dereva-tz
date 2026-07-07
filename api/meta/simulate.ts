import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import { handleMetaInput } from '../_lib/metaBot';
import { addMessageToHistory } from '../_lib/historyStore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Support CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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

    const dbAdmin = getFirestoreDb();
    const reply = await handleMetaInput(senderId, message, channel, dbAdmin);

    // Persist log locally in history file
    addMessageToHistory(channel, senderId, message, reply);

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
