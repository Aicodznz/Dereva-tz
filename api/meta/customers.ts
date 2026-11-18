import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import {
  listMetaCustomersForAdmin,
  setMetaCustomerBlockedState,
  deleteMetaCustomerCompletely,
} from '../_lib/metaBot';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const dbAdmin = getFirestoreDb();

    if (req.method === 'GET') {
      const channel = typeof req.query.channel === 'string' ? req.query.channel : 'all';
      const search = typeof req.query.search === 'string' ? req.query.search : '';
      const customers = await listMetaCustomersForAdmin(dbAdmin, { channel, search });
      return res.status(200).json({ status: 'ok', customers });
    }

    if (req.method === 'POST') {
      const { action, channel = 'whatsapp', senderId, blocked, reason } = req.body || {};
      const cleanSenderId = String(senderId || '').trim();
      const validChannel = (channel === 'messenger' || channel === 'instagram' ? channel : 'whatsapp') as
        | 'whatsapp'
        | 'messenger'
        | 'instagram';

      if (!cleanSenderId) {
        return res.status(400).json({ error: 'senderId is required' });
      }

      if (action === 'delete') {
        const result = await deleteMetaCustomerCompletely(
          { channel: validChannel, senderId: cleanSenderId },
          dbAdmin
        );
        return res.status(200).json({ status: 'ok', action: 'delete', ...result });
      }

      if (action === 'block' || action === 'unblock' || typeof blocked === 'boolean') {
        const nextBlocked = action === 'block' ? true : action === 'unblock' ? false : Boolean(blocked);
        const customer = await setMetaCustomerBlockedState(
          {
            channel: validChannel,
            senderId: cleanSenderId,
            blocked: nextBlocked,
            reason,
          },
          dbAdmin
        );
        return res.status(200).json({
          status: 'ok',
          action: nextBlocked ? 'block' : 'unblock',
          customer,
        });
      }

      return res.status(400).json({ error: 'Unsupported action. Use block, unblock, or delete.' });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('[Meta Customers Vercel] Error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to manage customers',
    });
  }
}
