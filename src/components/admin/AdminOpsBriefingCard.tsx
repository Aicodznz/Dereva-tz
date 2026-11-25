import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { auth } from '../../firebase';
import {
  Activity,
  BellRing,
  Bot,
  CalendarClock,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Store,
  Users,
} from 'lucide-react';

type OpsIntervalPreset = '1h' | '6h' | '12h' | 'daily' | 'weekly' | 'monthly';

interface OpsRealtimeTriggers {
  newCustomer: boolean;
  newProduct: boolean;
  newDriverOrVendor: boolean;
  newOrderOrService: boolean;
  lipaNambaPending: boolean;
}

interface OpsAutomationSettings {
  enabled: boolean;
  adminPhone: string;
  intervalPreset: OpsIntervalPreset;
  lastSentAtMs: number;
  nextDueAtMs: number;
  updatedAt?: string;
  realtimeTriggers: OpsRealtimeTriggers;
}

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
  catalogStats?: {
    customers: number;
    products: number;
    vendors: number;
    drivers: number;
    fundis: number;
  };
  automation: {
    hasAutomationKey: boolean;
    hasOpsWebhookUrl: boolean;
    hasAdminPhone: boolean;
  };
  whatsappSummaryText: string;
}

const DEFAULT_TRIGGERS: OpsRealtimeTriggers = {
  newCustomer: false,
  newProduct: false,
  newDriverOrVendor: true,
  newOrderOrService: false,
  lipaNambaPending: true,
};

const INTERVAL_OPTIONS: { value: OpsIntervalPreset; label: string }[] = [
  { value: '1h', label: 'Kila Saa 1' },
  { value: '6h', label: 'Kila Saa 6' },
  { value: '12h', label: 'Kila Saa 12' },
  { value: 'daily', label: 'Kila Siku (Saa 24)' },
  { value: 'weekly', label: 'Kila Wiki (Siku 7)' },
  { value: 'monthly', label: 'Kila Mwezi' },
];

const TRIGGER_ITEMS: { key: keyof OpsRealtimeTriggers; label: string; hint: string }[] = [
  { key: 'newCustomer', label: 'Mteja Mpya', hint: 'Mtumiaji mpya akijiunga' },
  { key: 'newProduct', label: 'Bidhaa Mpya', hint: 'Bidhaa/huduma mpya ikiongezwa' },
  { key: 'newDriverOrVendor', label: 'Dereva / Mchuuzi / Fundi Mpya', hint: 'Mshirika mpya akisajiliwa' },
  { key: 'newOrderOrService', label: 'Oda / Safari / Huduma Mpya', hint: 'Oda au ombi jipya la safari' },
  { key: 'lipaNambaPending', label: 'Malipo ya Lipa Namba 5656565', hint: 'Malipo yakisubiri uthibitisho' },
];

function normalizePhoneForWaLink(raw?: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('255') && digits.length >= 12) return digits.slice(0, 12);
  if (digits.startsWith('0') && digits.length >= 10) return `255${digits.slice(1, 10)}`;
  if (digits.length === 9) return `255${digits}`;
  return digits;
}

function formatSwDateTime(ms?: number): string {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return '—';
  try {
    return new Date(ms).toLocaleString('sw-TZ', {
      timeZone: 'Africa/Dar_es_Salaam',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return new Date(ms).toLocaleString();
  }
}

function formatWhatsAppFailureHint(reason?: string): string {
  const r = String(reason || '').toLowerCase();
  if (!r) return 'Imeshindwa kutuma moja kwa moja kupitia WhatsApp Cloud API.';
  if (r === 'self_bot_number') {
    return 'Hiyo (+255 775 985 358) ni namba ya huduma inayotuma ujumbe — weka namba yako binafsi ya mpokeaji (mf. 0687225353).';
  }
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
  const [savingSchedule, setSavingSchedule] = useState(false);
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

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [intervalPreset, setIntervalPreset] = useState<OpsIntervalPreset>('daily');
  const [realtimeTriggers, setRealtimeTriggers] = useState<OpsRealtimeTriggers>(DEFAULT_TRIGGERS);
  const [lastSentAtMs, setLastSentAtMs] = useState(0);
  const [nextDueAtMs, setNextDueAtMs] = useState(0);

  const opsEndpointUrl = 'https://dereva-tz.onrender.com/api/ops/briefing';
  const normalizedWaDigits = normalizePhoneForWaLink(adminPhone);
  const waDirectUrl =
    normalizedWaDigits.length >= 11 && briefing?.whatsappSummaryText
      ? `https://wa.me/${normalizedWaDigits}?text=${encodeURIComponent(briefing.whatsappSummaryText)}`
      : '';

  const applyScheduleSettings = useCallback((settings?: OpsAutomationSettings | null) => {
    if (!settings) return;
    setScheduleEnabled(Boolean(settings.enabled));
    setIntervalPreset(settings.intervalPreset || 'daily');
    setRealtimeTriggers({
      newCustomer: Boolean(settings.realtimeTriggers?.newCustomer),
      newProduct: Boolean(settings.realtimeTriggers?.newProduct),
      newDriverOrVendor:
        typeof settings.realtimeTriggers?.newDriverOrVendor === 'boolean'
          ? settings.realtimeTriggers.newDriverOrVendor
          : true,
      newOrderOrService: Boolean(settings.realtimeTriggers?.newOrderOrService),
      lipaNambaPending:
        typeof settings.realtimeTriggers?.lipaNambaPending === 'boolean'
          ? settings.realtimeTriggers.lipaNambaPending
          : true,
    });
    setLastSentAtMs(Number(settings.lastSentAtMs || 0));
    setNextDueAtMs(Number(settings.nextDueAtMs || 0));
    if (settings.adminPhone) {
      setAdminPhone((prev) => {
        if (prev.trim()) return prev;
        try {
          localStorage.setItem('papo_admin_briefing_phone', settings.adminPhone);
        } catch {}
        return settings.adminPhone;
      });
    }
  }, []);

  const loadBriefing = useCallback(async () => {
    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        setLoading(false);
        return;
      }
      const [briefingRes, scheduleRes] = await Promise.all([
        fetch('/api/ops/briefing', {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
        fetch('/api/ops/schedule', {
          headers: { Authorization: `Bearer ${idToken}` },
        }).catch(() => null),
      ]);

      if (!briefingRes.ok) throw new Error('Imeshindwa kupakia muhtasari wa shughuli');
      const data = await briefingRes.json();
      setBriefing(data);

      if (scheduleRes && scheduleRes.ok) {
        const schedData = await scheduleRes.json().catch(() => null);
        if (schedData?.settings) {
          applyScheduleSettings(schedData.settings);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Hitilafu wakati wa kusoma muhtasari');
    } finally {
      setLoading(false);
    }
  }, [applyScheduleSettings]);

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

  const handleSaveSchedule = async () => {
    const cleanedPhone = normalizePhoneForWaLink(adminPhone);
    if (cleanedPhone === '255775985358') {
      toast.warning(
        'Hiyo (+255 775 985 358) ni namba ya huduma inayotuma ujumbe — weka namba yako binafsi ya mpokeaji.'
      );
      return;
    }

    if (
      scheduleEnabled &&
      cleanedPhone.length < 11 &&
      !briefing?.automation?.hasAdminPhone &&
      !briefing?.automation?.hasOpsWebhookUrl
    ) {
      toast.warning('Weka namba yako ya WhatsApp ya Admin (au OPS_WEBHOOK_URL) ili kuwasha ratiba ya kiotomatiki.');
      return;
    }

    setSavingSchedule(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        toast.error('Ingia kama Admin kwanza.');
        return;
      }

      try {
        localStorage.setItem('papo_admin_briefing_phone', adminPhone.trim());
      } catch {}

      const res = await fetch('/api/ops/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          enabled: scheduleEnabled,
          adminPhone: adminPhone.trim(),
          intervalPreset,
          realtimeTriggers,
          resetScheduleFromNow: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Imeshindwa kuhifadhi ratiba');
      }

      if (data?.settings) {
        applyScheduleSettings(data.settings);
      }

      if (scheduleEnabled) {
        const nextStr = formatSwDateTime(data?.settings?.nextDueAtMs);
        toast.success(`Ratiba ya kiotomatiki imewashwa! Ripoti ijayo: ${nextStr}`);
      } else {
        toast.success('Mipangilio ya ratiba imehifadhiwa (imezimwa).');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Hitilafu wakati wa kuhifadhi ratiba');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleToggleTrigger = (key: keyof OpsRealtimeTriggers, checked: boolean) => {
    setRealtimeTriggers((prev) => ({ ...prev, [key]: checked }));
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
                Pata ripoti ya papo hapo au weka ratiba ya kiotomatiki ya Lipa Namba {briefing?.lipaNamba || '5656565'}, DaliPay, bidhaa, wateja, na madereva.
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
            {briefing?.catalogStats && (
              <div className="text-[10px] text-neutral-500 pt-0.5">
                Wateja {briefing.catalogStats.customers} • Bidhaa {briefing.catalogStats.products} • Madereva {briefing.catalogStats.drivers}
              </div>
            )}
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
                placeholder="Namba ya Admin (mf. 0687225353)"
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
              Inatumwa <b>kutoka</b> namba ya huduma (+255 775 985 358) <b>kwenda</b> namba binafsi ya Admin uliyoiweka hapa (au webhook ya Nod/n8n kama imewekwa).
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
                Weka Secret <code className="font-mono font-bold">OPS_AUTOMATION_KEY</code> (kutumia kama header <code className="font-mono">X-Ops-Key</code>) kisha <b>Nod</b> au <b>n8n</b> inaweza kuvuta ripoti au kupokea matukio kupitia <code className="font-mono font-bold">OPS_WEBHOOK_URL</code>.
              </div>
            </div>
          </div>
        </div>

        {/* Automated Scheduled Briefings & Realtime Event Alerts */}
        <div className="p-4 rounded-2xl border border-indigo-200/70 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-200/60 dark:border-indigo-900/40">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                <CalendarClock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-neutral-900 dark:text-neutral-100 flex items-center gap-2 flex-wrap">
                  <span>Ratiba ya Kiotomatiki &amp; Arifa za Matukio</span>
                  {scheduleEnabled ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-none text-[10px] font-black uppercase">
                      INAFANYA KAZI
                    </Badge>
                  ) : (
                    <Badge className="bg-neutral-200/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-none text-[10px] font-bold uppercase">
                      IMEZIMWA
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5">
                  Chagua muda wa kupokea ripoti za jumla kiotomatiki na matukio ya papo hapo kwenda WhatsApp yako na Nod / n8n.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-auto">
              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                {scheduleEnabled ? 'Imewashwa' : 'Washa Ratiba'}
              </span>
              <Switch
                checked={scheduleEnabled}
                onCheckedChange={setScheduleEnabled}
                aria-label="Washa Ripoti na Arifa za Kiotomatiki"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 space-y-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="ops-interval-select"
                  className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300"
                >
                  Muda wa Kurudia Ripoti
                </label>
                <select
                  id="ops-interval-select"
                  value={intervalPreset}
                  onChange={(e) => setIntervalPreset(e.target.value as OpsIntervalPreset)}
                  className="w-full h-9 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 text-xs font-semibold text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {INTERVAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-white/90 dark:bg-neutral-950/90 border border-neutral-200/70 dark:border-neutral-800 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500 font-medium">Ripoti Ijayo:</span>
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">
                    {scheduleEnabled && nextDueAtMs > 0 ? formatSwDateTime(nextDueAtMs) : 'Haijawashwa'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500 font-medium">Mwisho Kutumwa:</span>
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    {lastSentAtMs > 0 ? formatSwDateTime(lastSentAtMs) : 'Bado'}
                  </span>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleSaveSchedule}
                disabled={savingSchedule}
                className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {savingSchedule ? 'Inahifadhi Ratiba...' : 'Hifadhi Ratiba'}
              </Button>
            </div>

            <div className="lg:col-span-7 space-y-2">
              <div className="text-[11px] font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <BellRing className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Arifa za Papo Hapo (Kila Tukio Likifanyika)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TRIGGER_ITEMS.map((item) => {
                  const checked = Boolean(realtimeTriggers[item.key]);
                  return (
                    <label
                      key={item.key}
                      className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-colors cursor-pointer ${
                        checked
                          ? 'bg-white dark:bg-neutral-950 border-indigo-300 dark:border-indigo-700'
                          : 'bg-white/60 dark:bg-neutral-950/50 border-neutral-200/70 dark:border-neutral-800'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                          {item.label}
                        </div>
                        <div className="text-[10px] text-neutral-500 truncate">{item.hint}</div>
                      </div>
                      <Switch
                        checked={checked}
                        onCheckedChange={(val) => handleToggleTrigger(item.key, val)}
                        aria-label={item.label}
                      />
                    </label>
                  );
                })}
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
