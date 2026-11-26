import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import { getPapoWalletSummaryAndStatement } from '../_lib/papoWalletSettlement';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ found: false, error: 'Method Not Allowed' });
  }

  try {
    const dbAdmin = getFirestoreDb();
    const phone = String(req.query.phone || '').trim();
    const uid = String(req.query.uid || '').trim();
    if (phone.replace(/\D/g, '').length < 9 && !uid) {
      return res.status(200).json({
        found: false,
        walletId: '',
        walletBalance: 0,
        points: 0,
        isCardFrozen: false,
        transactions: [],
      });
    }
    const summary = await getPapoWalletSummaryAndStatement(dbAdmin, phone, uid || undefined);
    return res.status(200).json({
      found: summary.found,
      uid: summary.uid || null,
      walletId: summary.walletId,
      walletBalance: summary.walletBalance,
      points: summary.points,
      isCardFrozen: summary.isCardFrozen,
      displayName: summary.displayName || null,
      phone: summary.phone || null,
      transactions: summary.transactions || [],
    });
  } catch {
    return res.status(200).json({
      found: false,
      walletId: '',
      walletBalance: 0,
      points: 0,
      isCardFrozen: false,
      transactions: [],
    });
  }
}
