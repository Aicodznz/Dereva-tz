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
  ShieldCheck,
  Store,
  Webhook,
} from 'lucide-react';

interface CallbackRecord {
  id: string;
  order_id?: string;
  provider?: string;
  kind?: string;
  network?: string;
  status?: string;
  reference_id?: string;
  amount?: number;
  mode?: string;
  error_message?: string;
  updated_at?: string;
}

interface GatewayStatusPayload {
  provider: string;
  configured: boolean;
  mode: 'live' | 'sandbox';
  endpoint: string;
  webhookPath: string;
  gatewayWebhookPath?: string;
  lipaNamba?: string;
  dalipay?: {
    configured: boolean;
    mode: 'live' | 'test' | 'unconfigured';
    hasCallbackSecret: boolean;
    collectionsEndpoint: string;
    disbursementsEndpoint: string;
  };
  mongike?: {
    configured: boolean;
    mode: 'live' | 'sandbox';
  };
  recentCallbacks: CallbackRecord[];
}

export const MongikeGatewayCard: React.FC = () => {
  const [statusData, setStatusData] = useState<GatewayStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const originUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://your-app-domain.com';
  const gatewayWebhookUrl = `${originUrl}${statusData?.gatewayWebhookPath || '/webhooks/gateway'}`;

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payments/status');
      if (!res.ok) throw new Error('Imeshindwa kupakia hali ya mfumo wa malipo');
      const data = await res.json();
      setStatusData(data);
    } catch (err: any) {
      toast.error(err?.message || 'Imeshindwa kusoma hali ya malipo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(gatewayWebhookUrl);
      setCopiedWebhook(true);
      toast.success('Webhook URL imenakiliwa! Ibandike kwenye DaliPay Settings → Webhook URL.');
      setTimeout(() => setCopiedWebhook(false), 2500);
    } catch {
      toast.error('Imeshindwa kunakili URL');
    }
  };

  const dali = statusData?.dalipay;
  const daliConfigured = Boolean(dali?.configured);
  const daliLive = daliConfigured && dali?.mode === 'live';
  const daliTest = daliConfigured && dali?.mode === 'test';
  const mongikeLive = Boolean(statusData?.mongike?.configured);
  const lipaNamba = statusData?.lipaNamba || '5656565';

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
                <span>Kituo cha Malipo: DaliPay, Mongike &amp; Lipa Namba {lipaNamba}</span>
                {loading ? (
                  <Badge className="bg-neutral-100 text-neutral-600 border-none text-[10px]">
                    Inakagua...
                  </Badge>
                ) : daliLive ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none text-[10px] font-black uppercase">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    DALIPAY LIVE
                  </Badge>
                ) : daliTest ? (
                  <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-none text-[10px] font-black uppercase">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    DALIPAY TEST MODE
                  </Badge>
                ) : mongikeLive ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none text-[10px] font-black uppercase">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    MONGIKE LIVE
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-none text-[10px] font-black uppercase">
                    <ShieldAlert className="w-3 h-3 mr-1" />
                    LIPA NAMBA {lipaNamba} + SANDBOX
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Collections &amp; Disbursements za M-Pesa, Mixx by Yas, Airtel Money &amp; HaloPesa kupitia DaliPay, Mongike na Lipa Namba {lipaNamba}.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://app.dalipay.co.tz/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
            >
              <span>Fungua DaliPay</span>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
              1. DaliPay Collections &amp; Payouts
            </div>
            <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              {daliLive ? (
                <span className="text-emerald-600 dark:text-emerald-400">Live Production Active</span>
              ) : daliTest ? (
                <span className="text-sky-600 dark:text-sky-400">Test Keys Connected (Subiri KYC Live)</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">Bado Haijawashwa (Weka Keys)</span>
              )}
            </div>
            <div className="text-[11px] text-neutral-500">
              HMAC X-Signature: {dali?.hasCallbackSecret ? 'Imelindwa ✅' : 'Bado Callback Secret'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
              2. Lipa Namba ({lipaNamba})
            </div>
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5" />
              <span>Active • Papo Hapo Super App</span>
            </div>
            <div className="text-[11px] text-neutral-500">
              Mbadala wa papo hapo + Uthibitisho wa Admin.
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
              3. Mongike Legacy Push
            </div>
            <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
              {mongikeLive ? 'Live Key Ipo' : 'Inactive / Backup'}
            </div>
            <div className="text-[11px] text-neutral-500">
              DaliPay hupewa kipaumbele ikiwa imeunganishwa.
            </div>
          </div>
        </div>

        {!daliLive && statusData?.recentCallbacks?.some((cb) =>
          /not\s*activated|suspended|access\s*denied/i.test(String(cb.error_message || ''))
        ) && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div className="text-xs space-y-1 leading-relaxed">
              <div className="font-black uppercase tracking-wide">
                DaliPay Ndiyo Njia Mpya ya Kiotomatiki (Badala ya Mongike Iliyosimamishwa)
              </div>
              <p>
                Weka funguo zako za DaliPay (<code className="font-mono font-bold">DALIPAY_PUBLIC_KEY</code>, <code className="font-mono font-bold">DALIPAY_SECRET_KEY</code>, na <code className="font-mono font-bold">DALIPAY_CALLBACK_SECRET</code>) kwenye <b>Secrets</b> za seva. KYC ya NIDA ikishapitishwa, weka funguo za <i>Production</i> na malipo yataingia kiotomatiki. Kwa sasa wateja bado wanaweza kulipa kwa <b>Lipa Namba {lipaNamba}</b>.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-neutral-800 dark:text-neutral-200">
              <Webhook className="w-4 h-4 text-emerald-500" />
              <span>Webhook URL (Weka Kwenye DaliPay Settings)</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] font-mono bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-neutral-700 dark:text-neutral-300 truncate">
                {gatewayWebhookUrl}
              </code>
              <Button
                type="button"
                size="sm"
                onClick={handleCopyWebhook}
                className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                {copiedWebhook ? 'Imenakiliwa' : 'Nakili'}
              </Button>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Nakili anwani hii uibandike kwenye <b>DaliPay → Settings → Webhook URL</b>. Seva inahakiki sahihi ya <b>HMAC-SHA256 (<code className="font-mono">X-Signature</code>)</b> kiotomatiki kabla ya kukamilisha oda au kutoa pesa.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800 space-y-2">
            <div className="text-xs font-black uppercase tracking-wide text-neutral-800 dark:text-neutral-200">
              Vigezo vya Seva (Server Secrets)
            </div>
            <ol className="text-[11px] text-neutral-600 dark:text-neutral-400 space-y-1.5 list-decimal pl-4">
              <li>
                <code className="font-mono font-bold text-neutral-800 dark:text-neutral-200">DALIPAY_PUBLIC_KEY</code> (inatuma header <code className="font-mono">X-Public-Key</code>)
              </li>
              <li>
                <code className="font-mono font-bold text-neutral-800 dark:text-neutral-200">DALIPAY_SECRET_KEY</code> (inatuma header <code className="font-mono">X-Secret-Key</code>)
              </li>
              <li>
                <code className="font-mono font-bold text-neutral-800 dark:text-neutral-200">DALIPAY_CALLBACK_SECRET</code> (inahakiki webhook <code className="font-mono">X-Signature</code>)
              </li>
              <li>
                Hiari: <code className="font-mono font-bold text-neutral-800 dark:text-neutral-200">DALIPAY_BASE_URL</code> (ikibidi kubadili endpoint ya API ya DaliPay).
              </li>
            </ol>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
            Miamala &amp; Webhooks za Hivi Karibuni ({statusData?.recentCallbacks?.length || 0})
          </div>
          {!statusData?.recentCallbacks?.length ? (
            <div className="text-xs text-neutral-500 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl p-4 text-center">
              Bado hakuna taarifa ya muamala wa gateway iliyopokelewa hivi karibuni.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-100 dark:border-neutral-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-900/60 border-b border-neutral-200/60 dark:border-neutral-800 text-[10px] font-black uppercase text-neutral-500">
                    <th className="py-2.5 px-3">Oda / Ref</th>
                    <th className="py-2.5 px-3">Gateway</th>
                    <th className="py-2.5 px-3">Kumbukumbu</th>
                    <th className="py-2.5 px-3">Kiasi</th>
                    <th className="py-2.5 px-3">Hali</th>
                    <th className="py-2.5 px-3">Muda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                  {statusData.recentCallbacks.map((cb) => {
                    const paid = ['COMPLETED', 'SUCCESS', 'PAID', 'SETTLED', 'SUCCESSFUL'].includes(
                      String(cb.status || '').toUpperCase()
                    );
                    const failed = ['FAILED', 'ERROR', 'CANCELLED', 'REJECTED'].includes(
                      String(cb.status || '').toUpperCase()
                    );
                    const provLabel =
                      cb.provider === 'dalipay'
                        ? 'DaliPay'
                        : cb.provider === 'lipanamba_manual'
                        ? `Lipa ${lipaNamba}`
                        : cb.provider === 'mongike'
                        ? 'Mongike'
                        : cb.provider || 'Gateway';
                    return (
                      <tr key={cb.id}>
                        <td className="py-2 px-3 font-mono font-bold text-neutral-800 dark:text-neutral-200">
                          {cb.order_id || cb.id}
                        </td>
                        <td className="py-2 px-3">
                          <Badge className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-none text-[10px] font-bold">
                            {provLabel}{cb.kind === 'disbursement' ? ' • Payout' : ''}
                          </Badge>
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
                                : failed
                                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {cb.status || 'PENDING'}
                          </Badge>
                          {cb.error_message && (
                            <div className="text-[10px] text-red-600 dark:text-red-400 mt-1 max-w-[260px] leading-snug">
                              {cb.error_message}
                            </div>
                          )}
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
