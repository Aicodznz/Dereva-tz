import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import {
  getOpsAutomationSettings,
  saveOpsAutomationSettings,
  verifyOpsOrAdminRequest,
} from '../_lib/opsBriefing';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const db = getFirestoreDb();
    const auth = await verifyOpsOrAdminRequest(req, db);
    if (!auth.authorized) {
      return res.status(401).json({ ok: false, error: auth.error || 'Unauthorized' });
    }

    if (req.method === 'GET') {
      const settings = await getOpsAutomationSettings(db, true);
      return res.status(200).json({ ok: true, settings });
    }

    const body = (req.body || {}) as any;
    const settings = await saveOpsAutomationSettings(db, {
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      adminPhone: typeof body.adminPhone === 'string' ? body.adminPhone : undefined,
      intervalPreset: body.intervalPreset,
      realtimeTriggers: body.realtimeTriggers,
      resetScheduleFromNow: Boolean(body.resetScheduleFromNow),
    });

    return res.status(200).json({ ok: true, settings });
  } catch (err: any) {
    console.error('[Ops Schedule API] Error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Failed to handle ops schedule' });
  }
}
