import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { auth } from '../../firebase';
import {
  Activity,
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  RefreshCw,
  Send,
  ShieldAlert,
  Store,
  Users,
} from 'lucide-react';

interface OpsBriefingData {
  generatedAt: string;
  lipaNamba: string;
  lipaNambaPendingCount: number;
  lipaNambaPendingTotalTzs: number;
  dalipay: {
    completedCount: number;
    pendingCount: number;
    failedCount: number;
    collectedTzs: number;
    disbursedTzs: number;
  };
  partnersPending: {
    vendors: number;
    drivers: number;
    fundis: number;
    total: number;
  };
  liveOps: {
    activeRides: number;
    openOrders: number;
    unresolvedSos: number;
  };
  automation: {
    hasAutomationKey: boolean;
    hasOpsWebhookUrl: boolean;
    hasAdminPhone: boolean;
  };
  whatsappSummaryText: string;
}

function normalizePhoneForWaLink(raw?: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('255') && digits.length >= 12) return digits.slice(0, 12);
  if (digits.startsWith('0') && digits.length >= 10) return `255${digits.slice(1, 10)}`;
  if (digits.length === 9) return `255${digits}`;
  return digits;
}

function formatWhatsAppFailureHint(reason?: string): string {
  const r = String(reason || '').toLowerCase();
  if (!r) return 'Imeshindwa kutuma moja kwa moja kupitia WhatsApp Cloud API.';
  if (r.includes('missing meta_whatsapp_access_token') || r.includes('phonenumberid')) {
    return 'Seva hii haina META_WHATSAPP_ACCESS_TOKEN au Phone Number ID — tumia "Fungua Kwenye WhatsApp" hapa chini.';
  }
  if (r.includes('131047') || r.includes('24') || r.includes('window') || r.includes('re-engagement')) {
    return 'Namba hii haijawasiliana na bot ndani ya saa 24. Tuma neno "Menu" kwenda bot ya WhatsApp au tumia "Fungua Kwenye WhatsApp" hapa chini.';
  }
  return `WhatsApp API: ${reason}`;
}

export const AdminOpsBriefingCard: React.FC = () => {
  const [briefing, setBriefing] = useState<OpsBriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [lastSendHint, setLastSendHint] = useState<string | null>(null);
  const [adminPhone, setAdminPhone] = useState(() => {
    try {
      return localStorage.getItem('papo_admin_briefing_phone') || '';
    } catch {
      return '';
    }
  });

  const opsEndpointUrl = 'https://dereva-tz.onrender.com/api/ops/briefing';
  const normalizedWaDigits = normalizePhoneForWaLink(adminPhone);
  const waDirectUrl =
    normalizedWaDigits.length >= 11 && briefing?.whatsappSummaryText
      ? `https://wa.me/${normalizedWaDigits}?text=${encodeURIComponent(briefing.whatsappSummaryText)}`
      : '';

  const loadBriefing = useCallback(async () => {
    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        setLoading(false);
        return;
      }
      const res = await fetch('/api/ops/briefing', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error('Imeshindwa kupakia muhtasari wa shughuli');
      const data = await res.json();
      setBriefing(data);
    } catch (err: any) {
      toast.error(err?.message || 'Hitilafu wakati wa kusoma muhtasari');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBriefing();
  }, [loadBriefing]);

  const handleSendWhatsAppBriefing = async () => {
    setSending(true);
    setLastSendHint(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        toast.error('Ingia kama Admin kwanza.');
        return;
      }
      try {
        localStorage.setItem('papo_admin_briefing_phone', adminPhone.trim());
      } catch {}

      const res = await fetch('/api/ops/send-whatsapp-briefing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ phone: adminPhone.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Imeshindwa kutuma muhtasari');
      }
      if (data?.briefing) setBriefing(data.briefing);

      if (data.whatsappSent) {
        toast.success(`Muhtasari umetumwa WhatsApp kwenda +${data.recipientPhone}!`);
      } else if (data.webhookDispatched) {
        toast.success('Muhtasari umetumwa kwenda Nod / n8n Webhook!');
      } else if (!data.recipientPhone) {
        toast.info('Weka namba ya WhatsApp ya Admin au ADMIN_WHATSAPP_PHONE ili kutuma ujumbe.');
      } else {
        const hint = formatWhatsAppFailureHint(data.whatsappReason);
        setLastSendHint(hint);
        setShowPreview(true);
        toast.warning(hint);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Imeshindwa kutuma muhtasari');
    } finally {
      setSending(false);
    }
  };

  const handleCopyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(opsEndpointUrl);
      setCopiedEndpoint(true);
      toast.success('Endpoint ya Nod / n8n imenakiliwa!');
      setTimeout(() => setCopiedEndpoint(false), 2500);
    } catch {
      toast.error('Imeshindwa kunakili');
    }
  };

  const handleCopySummary = async () => {
    if (!briefing?.whatsappSummaryText) return;
    try {
      await navigator.clipboard.writeText(briefing.whatsappSummaryText);
      setCopiedSummary(true);
      toast.success('Ripoti imenakiliwa!');
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      toast.error('Imeshindwa kunakili ripoti');
    }
  };

  return (
    <Card className="rounded-[2rem] border border-neutral-200/80 dark:border-neutral-800 shadow-lg bg-white dark:bg-neutral-950">
      <CardHeader className="pb-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-neutral-900 dark:text-neutral-100 flex items-center gap-2 flex-wrap">
                <span>Muhtasari wa Shughuli &amp; Kiunganishi cha Nod / n8n</span>
                {briefing?.automation?.hasAutomationKey ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none text-[10px] font-black uppercase">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    OPS API READY
                  </Badge>
                ) : (
                  <Badge className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-none text-[10px] font-bold uppercase">
                    ADMIN AUTH READY
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Pata ripoti ya papo hapo ya Lipa Namba {briefing?.lipaNamba || '5656565'}, DaliPay, na maombi ya washirika — au unganisha ajenti wa Nod / n8n.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPreview((p) => !p)}
              disabled={!briefing?.whatsappSummaryText}
              className="h-8 text-xs font-bold rounded-xl"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              {showPreview ? 'Ficha Ripoti' : 'Onyesha Ripoti'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadBriefing}
              disabled={loading}
              className="h-8 text-xs font-bold rounded-xl"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Sasisha Takwimu
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1">
              <Store className="w-3.5 h-3.5 text-amber-500" />
              <span>Lipa Namba {briefing?.lipaNamba || '5656565'}</span>
            </div>
            <div className="text-lg font-black text-neutral-900 dark:text-neutral-100">
              {briefing ? briefing.lipaNambaPendingCount : '—'}
              <span className="text-xs font-bold text-neutral-500 ml-1">zinasubiri</span>
            </div>
            <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              TZS {Number(briefing?.lipaNambaPendingTotalTzs || 0).toLocaleString()}/=
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>DaliPay Yaliyokamilika</span>
            </div>
            <div className="text-lg font-black text-neutral-900 dark:text-neutral-100">
              {briefing ? briefing.dalipay.completedCount : '—'}
              <span className="text-xs font-bold text-neutral-500 ml-1">
                ({briefing?.dalipay.pendingCount || 0} pending)
              </span>
            </div>
            <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              +TZS {Number(briefing?.dalipay.collectedTzs || 0).toLocaleString()}/=
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-sky-500" />
              <span>Washirika Wanasubiri</span>
            </div>
            <div className="text-lg font-black text-neutral-900 dark:text-neutral-100">
              {briefing ? briefing.partnersPending.total : '—'}
              <span className="text-xs font-bold text-neutral-500 ml-1">maombi</span>
            </div>
            <div className="text-[11px] text-neutral-500">
              Wachuuzi {briefing?.partnersPending.vendors || 0} • Madereva {briefing?.partnersPending.drivers || 0} • Mafundi {briefing?.partnersPending.fundis || 0}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-rose-500" />
              <span>Uendeshaji Hai</span>
            </div>
            <div className="text-lg font-black text-neutral-900 dark:text-neutral-100">
              {briefing ? briefing.liveOps.openOrders + briefing.liveOps.activeRides : '—'}
              <span className="text-xs font-bold text-neutral-500 ml-1">oda &amp; safari</span>
            </div>
            <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              <span>SOS Hai: {briefing?.liveOps.unresolvedSos || 0}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800 space-y-3">
            <div className="text-xs font-black uppercase tracking-wide text-neutral-800 dark:text-neutral-200">
              Tuma Ripoti ya Siku WhatsApp
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="tel"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="Namba ya Admin (mf. 0755123456)"
                className="h-9 rounded-xl text-xs bg-white dark:bg-neutral-950"
              />
              <Button
                type="button"
                onClick={handleSendWhatsAppBriefing}
                disabled={sending}
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {sending ? 'Inatuma...' : 'Tuma Ripoti Sasa'}
              </Button>
            </div>
            {lastSendHint && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
                {lastSendHint}
              </div>
            )}
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Inatuma muhtasari wa malipo yanayosubiri uthibitisho wa Lipa Namba {briefing?.lipaNamba || '5656565'}, takwimu za DaliPay, na maombi ya madereva/wachuuzi kwenda WhatsApp yako (na webhook ya Nod/n8n kama imewekwa).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800 space-y-2.5">
            <div className="text-xs font-black uppercase tracking-wide text-neutral-800 dark:text-neutral-200">
              API ya Nod / n8n Agent
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] font-mono bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-neutral-700 dark:text-neutral-300 truncate">
                {opsEndpointUrl}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopyEndpoint}
                className="h-9 px-3 rounded-xl text-xs font-bold shrink-0"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                {copiedEndpoint ? 'Imenakiliwa' : 'Nakili'}
              </Button>
            </div>
            <div className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed space-y-1">
              <div>
                Weka Secret <code className="font-mono font-bold">OPS_AUTOMATION_KEY</code> (kutumia kama header <code className="font-mono">X-Ops-Key</code>) kisha <b>Nod</b> au <b>n8n</b> inaweza kuvuta ripoti kila siku au kupokea matukio kupitia <code className="font-mono font-bold">OPS_WEBHOOK_URL</code>.
              </div>
            </div>
          </div>
        </div>

        {showPreview && briefing?.whatsappSummaryText && (
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200/70 dark:border-neutral-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-neutral-800 dark:text-neutral-200">
                Hakikisho la Ripoti ya WhatsApp
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopySummary}
                  className="h-8 px-3 rounded-xl text-xs font-bold"
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  {copiedSummary ? 'Imenakiliwa' : 'Nakili Ripoti'}
                </Button>
                {waDirectUrl && (
                  <a
                    href={waDirectUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                  >
                    <span>Fungua Kwenye WhatsApp</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-xs text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 rounded-xl p-3 leading-relaxed">
              {briefing.whatsappSummaryText}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
