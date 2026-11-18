import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import {
  getMetaWelcomeSettings,
  saveMetaWelcomeSettings,
  syncMetaConversationalAutomation,
  getMetaConversationalAutomationStatus,
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
      const settings = await getMetaWelcomeSettings(dbAdmin);
      const phoneId =
        typeof req.query.phoneNumberId === 'string'
          ? req.query.phoneNumberId
          : settings.phoneNumberId;
      const metaStatus = await getMetaConversationalAutomationStatus(phoneId);
      return res.status(200).json({ status: 'ok', settings, metaStatus });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const syncToMeta = body.syncToMeta !== false;
      if (syncToMeta) {
        const result = await syncMetaConversationalAutomation(body, dbAdmin);
        const metaStatus = await getMetaConversationalAutomationStatus(
          result.phoneNumberId || result.settings.phoneNumberId
        );
        return res.status(200).json({ status: 'ok', ...result, metaStatus });
      }
      const settings = await saveMetaWelcomeSettings(body, dbAdmin);
      const metaStatus = await getMetaConversationalAutomationStatus(settings.phoneNumberId);
      return res.status(200).json({
        status: 'ok',
        settings,
        synced: false,
        message: 'Mipangilio ya ujumbe wa karibu imehifadhiwa kwenye mfumo.',
        metaStatus,
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('[Meta Welcome Config Vercel] Error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to handle welcome config',
    });
  }
}
