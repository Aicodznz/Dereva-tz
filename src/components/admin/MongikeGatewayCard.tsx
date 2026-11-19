import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  Webhook,
} from 'lucide-react';

interface CallbackRecord {
  id: string;
  order_id?: string;
  status?: string;
  reference_id?: string;
  amount?: number;
  mode?: string;
  updated_at?: string;
}

interface MongikeStatusPayload {
  provider: string;
  configured: boolean;
  mode: 'live' | 'sandbox';
  endpoint: string;
  webhookPath: string;
  recentCallbacks: CallbackRecord[];
}

export const MongikeGatewayCard: React.FC = () => {
  const [statusData, setStatusData] = useState<MongikeStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const originUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://your-app-domain.com';
  const webhookUrl = `${originUrl}${statusData?.webhookPath || '/api/payments/webhook'}`;

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payments/status');
      if (!res.ok) throw new Error('Imeshindwa kupakia hali ya Mongike');
      const data = await res.json();
      setStatusData(data);
    } catch (err: any) {
      toast.error(err?.message || 'Imeshindwa kusoma hali ya Mongike');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      toast.success('Webhook URL imenakiliwa! Ibandike kwenye dashibodi yako ya Mongike.');
      setTimeout(() => setCopiedWebhook(false), 2500);
    } catch {
      toast.error('Imeshindwa kunakili URL');
    }
  };

  const isLive = statusData?.configured === true;

  return (
    <Card className="rounded-[2rem] border border-neutral-200/80 dark:border-neutral-800 shadow-lg bg-white dark:bg-neutral-950">
      <CardHeader className="pb-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-neutral-900 dark:text-neutral-100 flex items-center gap-2 flex-wrap">
                <span>Muunganisho wa Mongike Mobile Money</span>
                {loading ? (
                  <Badge className="bg-neutral-100 text-neutral-600 border-none text-[10px]">
                    Inakagua...
                  </Badge>
                ) : isLive ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none text-[10px] font-black uppercase">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    LIVE CONNECTED
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-none text-[10px] font-black uppercase">
                    <ShieldAlert className="w-3 h-3 mr-1" />
                    SANDBOX MODE
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                M-Pesa, Tigo Pesa (Mixx by Yas), Airtel Money &amp; HaloPesa kwa oda za App na WhatsApp Bot kupitia mongike.com.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://mongike.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
            >
              <span>Fungua Mongike</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchStatus}
              disabled={loading}
              className="h-8 text-xs font-bold rounded-xl"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Kagua Upya
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-neutral-800 dark:text-neutral-200">
              <Webhook className="w-4 h-4 text-orange-500" />
              <span>Webhook URL (Weka Kwenye Mongike Dashboard)</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] font-mono bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-neutral-700 dark:text-neutral-300 truncate">
                {webhookUrl}
              </code>
              <Button
                type="button"
                size="sm"
                onClick={handleCopyWebhook}
                className="h-9 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shrink-0"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                {copiedWebhook ? 'Imenakiliwa' : 'Nakili'}
              </Button>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Mteja akilipa kwenye simu, Mongike hutuma taarifa kwenye anwani hii ili oda iwekwe <b>IMELIPWA</b> na mteja pamoja na mwenye duka wajuliswe WhatsApp moja kwa moja.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800 space-y-2">
            <div className="text-xs font-black uppercase tracking-wide text-neutral-800 dark:text-neutral-200">
              Hatua za Kuwasha Malipo Halisi (Live)
            </div>
            <ol className="text-[11px] text-neutral-600 dark:text-neutral-400 space-y-1.5 list-decimal pl-4">
              <li>
                Ingia kwenye akaunti yako ya <b>mongike.com</b> kisha chukua <b>API Key</b> yako.
              </li>
              <li>
                Weka ufunguo huo kwenye <b>Secrets</b> ya mfumo kwa jina la <code className="font-mono font-bold text-neutral-800 dark:text-neutral-200">MONGIKE_API_KEY</code>.
              </li>
              <li>
                Nakili <b>Webhook URL</b> upande wa kushoto uibandike kwenye mipangilio ya Webhook ndani ya <b>mongike.com</b>.
              </li>
            </ol>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
            Miamala ya Hivi Karibuni Kupitia Mongike ({statusData?.recentCallbacks?.length || 0})
          </div>
          {!statusData?.recentCallbacks?.length ? (
            <div className="text-xs text-neutral-500 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl p-4 text-center">
              Bado hakuna taarifa ya muamala wa Mongike iliyopokelewa hivi karibuni.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-100 dark:border-neutral-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-900/60 border-b border-neutral-200/60 dark:border-neutral-800 text-[10px] font-black uppercase text-neutral-500">
                    <th className="py-2.5 px-3">Oda</th>
                    <th className="py-2.5 px-3">Kumbukumbu (Ref)</th>
                    <th className="py-2.5 px-3">Kiasi</th>
                    <th className="py-2.5 px-3">Hali</th>
                    <th className="py-2.5 px-3">Muda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                  {statusData.recentCallbacks.map((cb) => {
                    const paid = ['COMPLETED', 'SUCCESS', 'PAID', 'SETTLED'].includes(
                      String(cb.status || '').toUpperCase()
                    );
                    return (
                      <tr key={cb.id}>
                        <td className="py-2 px-3 font-mono font-bold text-neutral-800 dark:text-neutral-200">
                          {cb.order_id || cb.id}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-neutral-500">
                          {cb.reference_id || '-'}
                        </td>
                        <td className="py-2 px-3 font-bold">
                          TZS {Number(cb.amount || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3">
                          <Badge
                            className={`border-none text-[10px] font-black uppercase ${
                              paid
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {cb.status || 'PENDING'}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-neutral-400">
                          {cb.updated_at ? new Date(cb.updated_at).toLocaleString() : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
