import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getHistory } from '../_lib/historyStore';
import fs from 'fs';
import path from 'path';

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
    let chats: any[] = getHistory();
    const clearedPath = path.join(process.cwd(), 'logs_cleared.txt');
    const isCleared = fs.existsSync(clearedPath);

    if (chats.length === 0 && !isCleared) {
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
