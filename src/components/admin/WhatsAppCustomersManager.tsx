import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Ban,
  CheckCircle2,
  Headphones,
  MapPin,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  Unlock,
  Users,
} from 'lucide-react';

export interface SupportTicketRow {
  id: string;
  channel: 'whatsapp' | 'messenger' | 'instagram';
  senderId: string;
  customerName: string;
  customerPhone: string;
  status: 'open' | 'resolved' | string;
  lastMessage: string;
  messages: Array<{ sender: 'customer' | 'agent' | string; text: string; timestamp?: string }>;
  createdAt: number;
  updatedAt: number;
}

export interface MetaCustomerRow {
  id: string;
  senderId: string;
  channel: 'whatsapp' | 'messenger' | 'instagram';
  name: string;
  phone: string;
  lang: 'sw' | 'en';
  blocked: boolean;
  status: 'active' | 'blocked';
  blockedReason?: string;
  blockedAt?: number | null;
  step?: string;
  service?: string;
  lastLocationName?: string;
  createdAt: number;
  lastActiveAt: number;
}

interface WhatsAppCustomersManagerProps {
  defaultChannelFilter?: 'all' | 'whatsapp' | 'messenger' | 'instagram';
  compact?: boolean;
}

export const WhatsAppCustomersManager: React.FC<WhatsAppCustomersManagerProps> = ({
  defaultChannelFilter = 'all',
  compact = false,
}) => {
  const [customers, setCustomers] = useState<MetaCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'messenger' | 'instagram'>(
    defaultChannelFilter
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [blockReasonDraft, setBlockReasonDraft] = useState<Record<string, string>>({});
  const [editingBlockKey, setEditingBlockKey] = useState<string | null>(null);
  const [supportTickets, setSupportTickets] = useState<SupportTicketRow[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [ticketBusyId, setTicketBusyId] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const [custRes, ticketRes] = await Promise.all([
        fetch('/api/meta/customers'),
        fetch('/api/meta/support-tickets').catch(() => null),
      ]);
      if (!custRes.ok) throw new Error('Imeshindwa kupakia orodha ya wateja');
      const data = await custRes.json();
      setCustomers(Array.isArray(data?.customers) ? data.customers : []);
      if (ticketRes && ticketRes.ok) {
        const tData = await ticketRes.json().catch(() => ({}));
        setSupportTickets(Array.isArray(tData?.tickets) ? tData.tickets : []);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Imeshindwa kupakia wateja wa WhatsApp');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSupportAction = async (ticket: SupportTicketRow, action: 'reply' | 'resolve') => {
    const msg = (replyDrafts[ticket.id] || '').trim();
    if (action === 'reply' && !msg) {
      toast.error('Andika ujumbe wa kumjibu mteja kwanza.');
      return;
    }
    setTicketBusyId(ticket.id);
    try {
      const res = await fetch('/api/meta/support-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          action,
          ...(msg ? { message: msg } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Imeshindwa kutuma jibu la msaada');

      setReplyDrafts((prev) => ({ ...prev, [ticket.id]: '' }));
      setSupportTickets((prev) =>
        prev.map((row) =>
          row.id === ticket.id
            ? {
                ...row,
                status: action === 'resolve' ? 'resolved' : 'open',
                lastMessage: msg ? `Admin: ${msg}` : row.lastMessage,
                messages: msg
                  ? [...(row.messages || []), { sender: 'agent', text: msg, timestamp: new Date().toISOString() }]
                  : row.messages,
                updatedAt: Date.now(),
              }
            : row
        )
      );
      toast.success(
        action === 'resolve'
          ? `Tiketi ya ${ticket.customerName} imefungwa na mteja amerudishwa kwa Boti.`
          : `Jibu limetumwa kwa ${ticket.customerName} kupitia WhatsApp.`
      );
    } catch (err: any) {
      toast.error(err?.message || 'Hitilafu ya kutuma jibu');
    } finally {
      setTicketBusyId(null);
    }
  };

  const handleToggleBlock = async (customer: MetaCustomerRow, reason?: string) => {
    const nextBlocked = !customer.blocked;
    setBusyKey(customer.id);
    try {
      const res = await fetch('/api/meta/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: nextBlocked ? 'block' : 'unblock',
          channel: customer.channel,
          senderId: customer.senderId,
          blocked: nextBlocked,
          reason: nextBlocked ? reason || 'Imesitishwa na Admin' : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Imeshindwa kubadilisha hali ya mteja');

      setCustomers((prev) =>
        prev.map((row) =>
          row.id === customer.id
            ? {
                ...row,
                blocked: nextBlocked,
                status: nextBlocked ? 'blocked' : 'active',
                blockedReason: nextBlocked ? reason || 'Imesitishwa na Admin' : undefined,
              }
            : row
        )
      );
      setEditingBlockKey(null);
      toast.success(
        nextBlocked
          ? `Mteja ${customer.name} (${customer.phone}) amefungiwa kwenye WhatsApp Bot.`
          : `Mteja ${customer.name} (${customer.phone}) amefunguliwa na anaweza kutumia bot tena.`
      );
    } catch (err: any) {
      toast.error(err?.message || 'Hitilafu imetokea');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeleteCustomer = async (customer: MetaCustomerRow) => {
    setBusyKey(customer.id);
    try {
      const res = await fetch('/api/meta/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          channel: customer.channel,
          senderId: customer.senderId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Imeshindwa kumfuta mteja');

      setCustomers((prev) => prev.filter((row) => row.id !== customer.id));
      setConfirmDeleteKey(null);
      toast.success(`Mteja ${customer.name} na historia yake ya bot wamefutwa kabisa.`);
    } catch (err: any) {
      toast.error(err?.message || 'Imeshindwa kumfuta mteja');
    } finally {
      setBusyKey(null);
    }
  };

  const filtered = customers.filter((c) => {
    if (channelFilter !== 'all' && c.channel !== channelFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.senderId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const blockedCount = customers.filter((c) => c.blocked).length;
  const openTickets = supportTickets.filter((t) => t.status === 'open');

  return (
    <div className="space-y-4">
      {supportTickets.length > 0 && (
        <Card className="border border-amber-200/80 dark:border-amber-900/50 shadow-sm bg-white dark:bg-neutral-950">
          <CardHeader className="pb-3 border-b border-amber-100/80 dark:border-neutral-800">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    <span>Msaada wa Moja kwa Moja (Live Handover Desk)</span>
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-none text-[10px] font-bold">
                      Wazi: {openTickets.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-[11px] mt-0.5">
                    Wateja walioomba kuongea na mhudumu WhatsApp. Jibu hapa hapa au funga kurudisha udhibiti kwa Boti.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3 max-h-[340px] overflow-y-auto">
            {supportTickets.slice(0, 8).map((ticket) => {
              const isOpen = ticket.status === 'open';
              const isBusyTicket = ticketBusyId === ticket.id;
              return (
                <div
                  key={ticket.id}
                  className={`p-3 rounded-xl border space-y-2.5 ${
                    isOpen
                      ? 'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/15'
                      : 'border-neutral-200/70 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900/30 opacity-80'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100">
                        {ticket.customerName}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-500">
                        {ticket.customerPhone || ticket.senderId}
                      </span>
                    </div>
                    <Badge
                      className={`border-none text-[10px] font-black uppercase ${
                        isOpen
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isOpen ? 'Inasubiri Mhudumu' : 'Imefungwa'}
                    </Badge>
                  </div>

                  <div className="space-y-1 max-h-24 overflow-y-auto text-[11px] bg-white/80 dark:bg-neutral-950/60 p-2 rounded-lg border border-neutral-100 dark:border-neutral-800">
                    {(ticket.messages || []).slice(-4).map((m, idx) => (
                      <div key={idx} className={m.sender === 'agent' ? 'text-emerald-700 dark:text-emerald-400' : 'text-neutral-700 dark:text-neutral-300'}>
                        <strong className="uppercase text-[9px] mr-1.5">
                          {m.sender === 'agent' ? 'Admin:' : 'Mteja:'}
                        </strong>
                        <span>{m.text}</span>
                      </div>
                    ))}
                  </div>

                  {isOpen && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        value={replyDrafts[ticket.id] || ''}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                        }
                        placeholder="Andika jibu la kumtumia mteja WhatsApp..."
                        className="h-8 text-xs bg-white dark:bg-neutral-900 rounded-xl flex-1"
                      />
                      <div className="flex gap-1.5 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          disabled={isBusyTicket}
                          onClick={() => handleSupportAction(ticket, 'reply')}
                          className="h-8 px-3 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Jibu
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isBusyTicket}
                          onClick={() => handleSupportAction(ticket, 'resolve')}
                          className="h-8 px-2.5 text-[11px] font-bold text-amber-700 border-amber-300 hover:bg-amber-50 dark:border-amber-800 rounded-xl"
                        >
                          Maliza & Rudi Boti
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

    <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm bg-white dark:bg-neutral-950">
      <CardHeader className={compact ? 'pb-3' : 'pb-4 border-b border-neutral-100 dark:border-neutral-800'}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-neutral-900 dark:text-neutral-100 flex items-center gap-2 flex-wrap">
                <span>Wateja wa WhatsApp & Meta Bot ({filtered.length})</span>
                {blockedCount > 0 && (
                  <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-none text-[10px] font-bold">
                    Waliofungiwa: {blockedCount}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Simamia wateja wanaowasiliana na bot: unaweza kuwafungia kwa muda (Block), kuwafungulia, au kuwafuta kabisa kwenye mfumo.
              </CardDescription>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchCustomers}
            disabled={loading}
            className="h-8 text-xs font-bold rounded-xl shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Onyesha Upya
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tafuta jina au namba ya simu (mf. +2557...)"
              className="pl-9 h-9 text-xs bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-xl"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(['all', 'whatsapp', 'messenger', 'instagram'] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannelFilter(ch)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wide transition-colors cursor-pointer whitespace-nowrap ${
                  channelFilter === ch
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {ch === 'all' ? 'Wote' : ch}
              </button>
            ))}
          </div>
        </div>

        {loading && customers.length === 0 ? (
          <div className="py-10 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
            <span>Inapakia orodha ya wateja wa WhatsApp...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-xs text-neutral-500 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
            Hakuna mteja wa WhatsApp/Meta aliyepatikana kwa sasa.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-100 dark:border-neutral-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-900/70 border-b border-neutral-200/70 dark:border-neutral-800 text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  <th className="py-3 px-4">Mteja</th>
                  <th className="py-3 px-4">Namba / Mtandao</th>
                  <th className="py-3 px-4">Eneo / Lugha</th>
                  <th className="py-3 px-4">Hali</th>
                  <th className="py-3 px-4 text-right">Hatua (Admin)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                {filtered.map((customer) => {
                  const isBusy = busyKey === customer.id;
                  return (
                    <tr
                      key={customer.id}
                      className={`transition-colors ${
                        customer.blocked
                          ? 'bg-rose-50/40 dark:bg-rose-950/10'
                          : 'hover:bg-neutral-50/80 dark:hover:bg-neutral-900/40'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-neutral-900 dark:text-neutral-100">
                          {customer.name}
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          {new Date(customer.lastActiveAt || customer.createdAt).toLocaleString()}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          {customer.phone}
                        </div>
                        <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase">
                          <MessageCircle className="w-2.5 h-2.5" />
                          {customer.channel}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-[11px] text-neutral-600 dark:text-neutral-400">
                        {customer.lastLocationName ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-orange-500 shrink-0" />
                            <span>{customer.lastLocationName}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                        <div className="text-[10px] uppercase font-bold text-neutral-400 mt-0.5">
                          Lugha: {customer.lang === 'en' ? 'English' : 'Kiswahili'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {customer.blocked ? (
                          <div className="space-y-1">
                            <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-none text-[10px] font-black uppercase">
                              <ShieldAlert className="w-3 h-3 mr-1" />
                              Amefungiwa
                            </Badge>
                            {customer.blockedReason && (
                              <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 max-w-[180px] truncate">
                                {customer.blockedReason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none text-[10px] font-black uppercase">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {confirmDeleteKey === customer.id ? (
                          <div className="inline-flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50">
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                              Hakika ufute?
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => handleDeleteCustomer(customer)}
                              className="h-7 px-2.5 text-[10px] font-black bg-rose-600 hover:bg-rose-700 text-white rounded-lg"
                            >
                              Futa
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteKey(null)}
                              className="h-7 px-2 text-[10px] font-bold rounded-lg"
                            >
                              Ghairi
                            </Button>
                          </div>
                        ) : editingBlockKey === customer.id ? (
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5 bg-amber-50 dark:bg-amber-950/20 p-1.5 rounded-xl border border-amber-200 dark:border-amber-800/40">
                            <Input
                              value={blockReasonDraft[customer.id] || ''}
                              onChange={(e) =>
                                setBlockReasonDraft((prev) => ({
                                  ...prev,
                                  [customer.id]: e.target.value,
                                }))
                              }
                              placeholder="Sababu (hiari)"
                              className="h-7 w-36 text-[11px] bg-white dark:bg-neutral-900"
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={isBusy}
                              onClick={() =>
                                handleToggleBlock(customer, blockReasonDraft[customer.id])
                              }
                              className="h-7 px-2.5 text-[10px] font-black bg-rose-600 hover:bg-rose-700 text-white rounded-lg"
                            >
                              Fungia Sasa
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => setEditingBlockKey(null)}
                              className="h-7 px-2 text-[10px] font-bold rounded-lg"
                            >
                              Ghairi
                            </Button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {customer.blocked ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => handleToggleBlock(customer)}
                                className="h-8 px-2.5 text-[11px] font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-900/50 dark:hover:bg-emerald-950/30 rounded-xl"
                              >
                                <Unlock className="w-3.5 h-3.5 mr-1" />
                                Fungulia
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => setEditingBlockKey(customer.id)}
                                className="h-8 px-2.5 text-[11px] font-bold text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/30 rounded-xl"
                              >
                                <Ban className="w-3.5 h-3.5 mr-1" />
                                Fungia
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteKey(customer.id)}
                              className="h-8 w-8 p-0 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl"
                              title="Futa mteja kabisa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
};
