import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const dbAdmin = getFirestoreDb();
    let chats: any[] = [];

    if (dbAdmin) {
      try {
        const snap = await dbAdmin.collection('meta_chats')
          .orderBy('timestamp', 'desc')
          .limit(50)
          .get();

        snap.forEach((doc: any) => {
          const d = doc.data();
          chats.push({
            id: doc.id,
            channel: d.channel,
            senderId: d.senderId,
            message: d.message,
            reply: d.reply,
            timestamp: d.timestamp ? d.timestamp.toDate() : new Date()
          });
        });
      } catch (e) {
        console.warn("[Meta History Vercel] Firestore query failed:", e);
      }
    }

    if (chats.length === 0) {
      chats = [
        {
          id: "m-mock-1",
          channel: "whatsapp",
          senderId: "+255716543210",
          message: "Naomba taxi kwenda Posta kutoka Mwenge",
          reply: "🚖 *Papo Hapo Taxi Service Router*:\n\nNjia uliyochagua: *POSTA KUTOKA MWENGE*\nTumepata madereva 3 karibu nawe:\n\n*1. Ally Rajabu (Passo - White)*\nBeji: ⭐ 4.9 (Uber Partner)\n💰 Bei: *TSH 7,500*\n\n*2. Salum Juma (Bajaji - Yellow)*\nBeji: ⭐ 4.8 (Fastest)\n💰 Bei: *TSH 4,500*\n\nAndika namba ya Dereva unayetaka kumuita sasa hivi:",
          timestamp: new Date(Date.now() - 5 * 60000)
        }
      ];
    }

    return res.status(200).json({ chats });
  } catch (error: any) {
    console.error("[Meta History Vercel] Error:", error);
    return res.status(500).json({ error: "Failed to fetch history" });
  }
}
