import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import { buildAdminOpsBriefing, verifyOpsOrAdminRequest } from '../_lib/opsBriefing';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const db = getFirestoreDb();
    const auth = await verifyOpsOrAdminRequest(req, db);
    if (!auth.authorized) {
      return res.status(401).json({ ok: false, error: auth.error || 'Unauthorized' });
    }
    const briefing = await buildAdminOpsBriefing(db);
    return res.status(200).json({ ok: true, actor: auth.actor, ...briefing });
  } catch (err: any) {
    console.error('[Ops Briefing API] Error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Failed to build ops briefing' });
  }
}
