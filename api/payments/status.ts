import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import { isMongikeLiveConfigured, MONGIKE_TANZANIA_MOMO_ENDPOINT, PAPO_LIPA_NAMBA } from '../_lib/mongike';
import { getDaliPayConfig } from '../_lib/dalipay';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const dbAdmin = getFirestoreDb();
    const mongikeConfigured = isMongikeLiveConfigured();
    const dalipayCfg = getDaliPayConfig();
    const activeProvider = dalipayCfg.configured
      ? 'dalipay'
      : mongikeConfigured
      ? 'mongike'
      : 'sandbox';
    let recentCallbacks: any[] = [];

    if (dbAdmin) {
      try {
        const snap = await dbAdmin.collection('payment_callbacks').limit(15).get();
        recentCallbacks = (snap.docs || [])
          .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
          .sort((a: any, b: any) => {
            const ta = Date.parse(String(a.updated_at || 0)) || 0;
            const tb = Date.parse(String(b.updated_at || 0)) || 0;
            return tb - ta;
          })
          .slice(0, 8);
      } catch {}
    }

    return res.status(200).json({
      provider: activeProvider,
      configured: dalipayCfg.configured || mongikeConfigured,
      mode: dalipayCfg.configured
        ? dalipayCfg.mode === 'test'
          ? 'sandbox'
          : 'live'
        : mongikeConfigured
        ? 'live'
        : 'sandbox',
      endpoint: dalipayCfg.configured
        ? `${dalipayCfg.baseUrl}${dalipayCfg.collectionsPath}`
        : MONGIKE_TANZANIA_MOMO_ENDPOINT,
      webhookPath: dalipayCfg.configured ? '/webhooks/gateway' : '/api/payments/webhook',
      gatewayWebhookPath: '/webhooks/gateway',
      lipaNamba: PAPO_LIPA_NAMBA,
      dalipay: {
        configured: dalipayCfg.configured,
        mode: dalipayCfg.mode,
        hasCallbackSecret: dalipayCfg.hasCallbackSecret,
        collectionsEndpoint: `${dalipayCfg.baseUrl}${dalipayCfg.collectionsPath}`,
        disbursementsEndpoint: `${dalipayCfg.baseUrl}${dalipayCfg.disbursementsPath}`,
      },
      mongike: {
        configured: mongikeConfigured,
        mode: mongikeConfigured ? 'live' : 'sandbox',
      },
      recentCallbacks,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || 'Failed to read gateway status',
    });
  }
}
