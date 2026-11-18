import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  BadgeCheck,
  CheckCircle2,
  Info,
  MessageSquarePlus,
  Play,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';

interface WhatsAppWelcomeCommand {
  command_name: string;
  command_description: string;
}

interface WhatsAppWelcomeSettings {
  enableWelcomeMessage: boolean;
  welcomeIntroSw: string;
  welcomeIntroEn: string;
  iceBreakers: string[];
  commands: WhatsAppWelcomeCommand[];
  phoneNumberId?: string;
  lastSyncedAt?: number;
  lastSyncStatus?: 'synced' | 'local_only' | 'error';
  lastSyncMessage?: string;
}

interface WhatsAppWelcomeSettingsCardProps {
  defaultPhoneNumberId?: string;
  onSimulateFirstOpen?: () => void;
}

const DEFAULT_SETTINGS: WhatsAppWelcomeSettings = {
  enableWelcomeMessage: true,
  welcomeIntroSw:
    '👋 Karibu *Papo Hapo*! Mimi ni Msaidizi wako wa papo hapo.\nAgiza Chakula 🍔, Usafiri 🚖, Hoteli 🏨, Dawa 💊 au Tiketi 🎟️ moja kwa moja hapa WhatsApp.',
  welcomeIntroEn:
    '👋 Welcome to *Papo Hapo*! Your instant super-app assistant.\nOrder Food 🍔, Rides 🚖, Hotels 🏨, Pharmacy 💊 or Tickets 🎟️ right here on WhatsApp.',
  iceBreakers: [
    '📋 Menyu Kuu',
    '🍔 Agiza Chakula',
    '🚖 Omba Usafiri',
    '🏨 Booking ya Hoteli',
  ],
  commands: [
    { command_name: 'menu', command_description: 'Fungua menyu kuu ya huduma zote za Papo Hapo' },
    { command_name: 'chakula', command_description: 'Agiza chakula moto au weka meza ya mgahawa' },
    { command_name: 'usafiri', command_description: 'Omba Boda, Bajaji au Taxi karibu nawe' },
    { command_name: 'hoteli', command_description: 'Tafuta na uweke booking ya chumba cha hoteli' },
    { command_name: 'oda', command_description: 'Fuatilia hali ya oda au booking zako' },
  ],
};

export const WhatsAppWelcomeSettingsCard: React.FC<WhatsAppWelcomeSettingsCardProps> = ({
  defaultPhoneNumberId = '',
  onSimulateFirstOpen,
}) => {
  const [settings, setSettings] = useState<WhatsAppWelcomeSettings>(DEFAULT_SETTINGS);
  const [phoneNumberId, setPhoneNumberId] = useState(defaultPhoneNumberId);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [syncNotice, setSyncNotice] = useState<{
    status: 'synced' | 'local_only' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (defaultPhoneNumberId && !phoneNumberId) {
      setPhoneNumberId(defaultPhoneNumberId);
    }
  }, [defaultPhoneNumberId, phoneNumberId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/meta/welcome-config');
        if (!res.ok) return;
        const data = await res.json();
        if (!active || !data?.settings) return;
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data.settings,
          iceBreakers:
            Array.isArray(data.settings.iceBreakers) && data.settings.iceBreakers.length > 0
              ? data.settings.iceBreakers.slice(0, 4)
              : DEFAULT_SETTINGS.iceBreakers,
        });
        if (data.settings.phoneNumberId) {
          setPhoneNumberId(data.settings.phoneNumberId);
        } else if (data.metaStatus?.resolvedPhoneNumberId) {
          setPhoneNumberId(data.metaStatus.resolvedPhoneNumberId);
        }
        if (data.settings.lastSyncStatus && data.settings.lastSyncMessage) {
          setSyncNotice({
            status: data.settings.lastSyncStatus,
            message: data.settings.lastSyncMessage,
          });
        }
      } catch {
        // Silent fallback to defaults
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const handleUpdateIceBreaker = (index: number, value: string) => {
    const next = [...settings.iceBreakers];
    next[index] = value.slice(0, 80);
    setSettings((prev) => ({ ...prev, iceBreakers: next }));
  };

  const handleAddIceBreaker = () => {
    if (settings.iceBreakers.length >= 4) {
      toast.info('Meta WhatsApp inaruhusu vitufe visivyozidi 4 vya Ice Breakers.');
      return;
    }
    setSettings((prev) => ({
      ...prev,
      iceBreakers: [...prev.iceBreakers, '✨ Huduma Mpya'],
    }));
  };

  const handleRemoveIceBreaker = (index: number) => {
    if (settings.iceBreakers.length <= 1) {
      toast.info('Lazima kubaki na angalau kitufe 1 cha kuanzia.');
      return;
    }
    setSettings((prev) => ({
      ...prev,
      iceBreakers: prev.iceBreakers.filter((_, idx) => idx !== index),
    }));
  };

  const handleSaveAndActivate = async () => {
    const cleanedPrompts = settings.iceBreakers
      .map((p) => p.trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 4);

    if (cleanedPrompts.length === 0) {
      toast.error('Weka angalau kitufe 1 cha Ice Breaker.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/meta/welcome-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enableWelcomeMessage: settings.enableWelcomeMessage,
          welcomeIntroSw: settings.welcomeIntroSw,
          welcomeIntroEn: settings.welcomeIntroEn,
          iceBreakers: cleanedPrompts,
          commands: settings.commands,
          phoneNumberId: phoneNumberId.trim() || undefined,
          syncToMeta: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Imeshindwa kuhifadhi mipangilio');
      }

      if (data.settings) {
        setSettings((prev) => ({ ...prev, ...data.settings }));
      }
      const nextStatus: 'synced' | 'local_only' | 'error' =
        data.status === 'synced' ? 'synced' : data.status === 'error' ? 'error' : 'local_only';
      const nextMsg = data.message || 'Mipangilio imehifadhiwa.';
      setSyncNotice({ status: nextStatus, message: nextMsg });

      if (nextStatus === 'synced') {
        toast.success('Ujumbe wa Karibu & Ice Breakers vimewashwa kwenye Meta WhatsApp!');
      } else if (nextStatus === 'local_only') {
        toast.success('Mipangilio imehifadhiwa kwenye mfumo (tayari kusawazishwa na Meta).');
      } else {
        toast.error(nextMsg);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Imeshindwa kuhifadhi mipangilio');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border border-emerald-200/70 dark:border-emerald-900/40 shadow-sm bg-gradient-to-br from-white via-white to-emerald-50/30 dark:from-neutral-950 dark:via-neutral-950 dark:to-emerald-950/10">
      <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-black dark:text-neutral-100 uppercase tracking-wider">
                WhatsApp First-Open Welcome & Ice Breakers
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Mteja mpya akifungua chat ya WhatsApp kwa mara ya kwanza, apokee ujumbe wa kumkaribisha na vitufe vya kuanzia moja kwa moja badala ya skrini tupu.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800 shrink-0">
            <Label
              htmlFor="wa-first-open-toggle"
              className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 cursor-pointer"
            >
              Washa Kiotomatiki
            </Label>
            <Switch
              id="wa-first-open-toggle"
              checked={settings.enableWelcomeMessage}
              onCheckedChange={(val) =>
                setSettings((prev) => ({ ...prev, enableWelcomeMessage: val }))
              }
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Top guidance on Number vs Business Name */}
        <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-800 dark:text-amber-300">
            <BadgeCheck className="w-4 h-4 shrink-0" />
            <span>Kuhusu Namba vs Jina la Biashara Juu ya Chat (+255...)</span>
          </div>
          <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
            WhatsApp hairuhusu kuficha kabisa namba ya simu. Ili jina la biashara (mfano <strong>Papo Hapo</strong>) lionekane juu badala ya namba kwa watu ambao hawajakusave, hakikisha umeweka <strong>Display Name</strong> kwenye WhatsApp Manager, umekamilisha <strong>Business Verification</strong>, kisha omba <strong>Official Business Account (Blue Tick / Meta Verified)</strong>. Wakati huo huo, kuwasha <strong>Welcome Message + Ice Breakers</strong> hapa chini kunamwonyesha mteja ujumbe wa kumkaribisha mara tu anapofungua chat!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
              Ujumbe wa Kumkaribisha (Kiswahili)
            </Label>
            <Textarea
              rows={4}
              value={settings.welcomeIntroSw}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, welcomeIntroSw: e.target.value }))
              }
              placeholder="Karibu Papo Hapo..."
              className="text-xs bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 leading-relaxed"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
              Welcome Message (English Fallback)
            </Label>
            <Textarea
              rows={4}
              value={settings.welcomeIntroEn}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, welcomeIntroEn: e.target.value }))
              }
              placeholder="Welcome to Papo Hapo..."
              className="text-xs bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 leading-relaxed"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Ice Breakers (max 4 buttons on WhatsApp) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Label className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-700 dark:text-neutral-200">
                Vitufe vya Kuanzia (Ice Breakers — Max 4)
              </Label>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Huonekana kama chaguo za haraka mteja anapofungua chat mpya (herufi 80 kila kimoja).
              </p>
            </div>
            {settings.iceBreakers.length < 4 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddIceBreaker}
                className="h-8 text-xs font-bold rounded-lg"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Ongeza Kitufe
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {settings.iceBreakers.map((promptText, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <Input
                  value={promptText}
                  maxLength={80}
                  onChange={(e) => handleUpdateIceBreaker(idx, e.target.value)}
                  placeholder={`Kitufe ${idx + 1}`}
                  className="text-xs bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 h-9"
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveIceBreaker(idx)}
                  className="h-9 w-9 text-neutral-400 hover:text-rose-500 shrink-0"
                  title="Ondoa kitufe"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Slash Commands Preview + Optional Phone Number ID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
              WhatsApp Phone Number ID (Hiari)
            </Label>
            <Input
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="Acha wazi kutumia iliyowekwa kwenye server"
              className="text-xs font-mono bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 h-9"
              disabled={isLoading}
            />
          </div>

          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200/70 dark:border-neutral-800 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>Slash Commands Zilizounganishwa</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {settings.commands.slice(0, 5).map((c) => (
                <span
                  key={c.command_name}
                  className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold"
                >
                  /{c.command_name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {syncNotice && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              syncNotice.status === 'synced'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                : syncNotice.status === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300'
            }`}
          >
            {syncNotice.status === 'synced' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{syncNotice.message}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
          {onSimulateFirstOpen && (
            <Button
              type="button"
              variant="outline"
              onClick={onSimulateFirstOpen}
              className="text-xs font-bold rounded-xl h-9"
            >
              <Play className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Jaribu Kufungua Chat (Simulate)
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSaveAndActivate}
            disabled={isSaving || isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider px-5 h-9 rounded-xl shadow-xs"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Inahifadhi & Kuwasiliana na Meta...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Hifadhi & Washa Kwenye Meta WhatsApp
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
