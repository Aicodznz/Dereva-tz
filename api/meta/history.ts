import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    let chats: any[] = [];
    try {
      const { getFirestoreDb } = await import('../_lib/getFirestoreDb');
      const dbAdmin = getFirestoreDb();
      if (dbAdmin) {
        const snap = await dbAdmin.collection('meta_chats').get();
        if (snap && snap.exists && snap.data()) {
          const d = snap.data();
          if (Array.isArray(d.chats)) {
            chats = d.chats;
          }
        }
      }
    } catch (e) {
      console.warn("[Meta History Vercel] Firestore query warning:", e);
    }

    if (chats.length === 0) {
      chats = [
        {
          id: "m-mock-1",
          channel: "whatsapp",
          senderId: "+255716543210",
          message: "Naomba taxi kwenda Posta kutoka Mwenge",
          reply: "🚖 *Papo Hapo Taxi Service Router*:\n\nNjia uliyochagua: *POSTA KUTOKA MWENGE*\nTumepata madereva 3 karibu nawe:\n\n*1. Ally Rajabu (Passo - White)*\nBeji: ⭐ 4.9 (Uber Partner)\n💰 Bei: *TSH 7,500*\n\n*2. Salum Juma (Bajaji - Yellow)*\nBeji: ⭐ 4.8 (Fastest)\n💰 Bei: *TSH 4,500*\n\nAndika namba ya Dereva unayetaka kumuita sasa hivi:",
          timestamp: new Date(Date.now() - 5 * 60000).toISOString()
        }
      ];
    }

    return res.status(200).json({ chats });
  } catch (error: any) {
    console.error("[Meta History Vercel] Error:", error);
    return res.status(500).json({ error: "Failed to fetch history" });
  }
}
