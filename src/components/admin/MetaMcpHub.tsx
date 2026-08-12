import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Cpu, 
  Database, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  Globe, 
  Layers, 
  Terminal, 
  Play, 
  RefreshCw, 
  ShieldCheck, 
  MessageSquare, 
  Share2, 
  ShoppingBag, 
  Key, 
  Activity, 
  Code2, 
  Sparkles,
  Sliders,
  Check,
  Copy,
  ExternalLink,
  ChevronRight,
  Info,
  SlidersHorizontal,
  Workflow
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface McpServer {
  id: string;
  name: string;
  category: 'meta_whatsapp' | 'meta_instagram' | 'meta_catalog' | 'meta_llama' | 'firestore_db';
  status: 'connected' | 'connecting' | 'disconnected';
  protocol: 'SSE (Server-Sent Events)' | 'Stdio / RPC' | 'WebSocket';
  toolsCount: number;
  latencyMs: number;
  description: string;
  endpointUrl: string;
  lastPing: string;
}

interface McpTool {
  id: string;
  serverId: string;
  name: string;
  description: string;
  parameters: string[];
  status: 'active' | 'beta';
  samplePayload: object;
}

interface McpLogEvent {
  id: string;
  timestamp: string;
  server: string;
  tool: string;
  status: 'success' | 'error' | 'pending';
  latency: string;
  details: string;
}

export const MetaMcpHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'servers' | 'tools' | 'workflows' | 'tester' | 'logs'>('servers');
  const [isAiAgentEnabled, setIsAiAgentEnabled] = useState(true);
  const [autoSyncMetaCatalog, setAutoSyncMetaCatalog] = useState(true);
  const [whatsappMcpNotifications, setWhatsappMcpNotifications] = useState(true);
  const [metaAccessToken, setMetaAccessToken] = useState('EAAG...meta_mcp_auth_token_live');
  const [whatsappPhoneId, setWhatsappPhoneId] = useState('109823481239842');
  const [metaAppSecret, setMetaAppSecret] = useState('••••••••••••••••••••••••');

  // Test Console State
  const [selectedTool, setSelectedTool] = useState<string>('whatsapp_broadcast_mcp');
  const [testPrompt, setTestPrompt] = useState('Anzisha ujumbe wa WhatsApp kwa wateja waliowahi kuagiza chakula chenye mfano wa 3D wiki hii, uwafahamishe kuhusu punguzo la 15%.');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<string | null>(null);

  // Mock MCP Servers
  const [mcpServers, setMcpServers] = useState<McpServer[]>([
    {
      id: 'srv-whatsapp',
      name: 'Meta WhatsApp Business MCP Server',
      category: 'meta_whatsapp',
      status: 'connected',
      protocol: 'SSE (Server-Sent Events)',
      toolsCount: 6,
      latencyMs: 18,
      description: 'Huruhusu AI Agent kutuma na kupokea jumbe za WhatsApp, kupanga maagizo, na kujibu maswali ya wateja kwa njia ya kiotomatiki.',
      endpointUrl: 'https://mcp.meta.papo.tz/v1/whatsapp/sse',
      lastPing: 'Muda huu (1s iliyopita)'
    },
    {
      id: 'srv-instagram',
      name: 'Meta Instagram Graph & Messaging MCP',
      category: 'meta_instagram',
      status: 'connected',
      protocol: 'SSE (Server-Sent Events)',
      toolsCount: 4,
      latencyMs: 24,
      description: 'Inaunganisha AI ya Admin na Instagram Direct Messages (DM), picha za milo ya wauzaji, na maoni ya posts.',
      endpointUrl: 'https://mcp.meta.papo.tz/v1/instagram/sse',
      lastPing: 'Muda huu (3s iliyopita)'
    },
    {
      id: 'srv-catalog',
      name: 'Meta Commerce Catalog & Ads Sync MCP',
      category: 'meta_catalog',
      status: 'connected',
      protocol: 'Stdio / RPC',
      toolsCount: 5,
      latencyMs: 12,
      description: 'Inasawazisha (Sync) bidhaa, bei, na 3D models kutoka PapoFood kwenda kwenye Meta Commerce Manager/Facebook Shops.',
      endpointUrl: 'https://mcp.meta.papo.tz/v1/catalog/rpc',
      lastPing: 'Muda huu (Just now)'
    },
    {
      id: 'srv-llama',
      name: 'Meta Llama 3 Agent Context Protocol (Meta Llama MCP)',
      category: 'meta_llama',
      status: 'connected',
      protocol: 'SSE (Server-Sent Events)',
      toolsCount: 8,
      latencyMs: 35,
      description: 'Inatoa uwezo wa Llama 3 reasoning agent kuelewa muktadha wa mfumo, maagizo ya wateja, na uchambuzi wa mapato ya wauzaji.',
      endpointUrl: 'https://mcp.meta.papo.tz/v1/llama3/agent',
      lastPing: 'Muda huu (2s iliyopita)'
    },
    {
      id: 'srv-firestore',
      name: 'PapoFood Database Context MCP Bridge',
      category: 'firestore_db',
      status: 'connected',
      protocol: 'Stdio / RPC',
      toolsCount: 7,
      latencyMs: 8,
      description: 'Inaipa Meta AI ruhusa ya kusoma na kuchanganua maagizo, wauzaji, na takwimu za papo kwa papo kutoka Firestore.',
      endpointUrl: 'mcp-server-firestore://localhost:3000',
      lastPing: 'Muda huu (Active)'
    }
  ]);

  // MCP Tools
  const mcpTools: McpTool[] = [
    {
      id: 'whatsapp_broadcast_mcp',
      serverId: 'srv-whatsapp',
      name: 'meta_whatsapp_send_interactive_template',
      description: 'Tuma ujumbe wa WhatsApp wenye vitufe vya 3D Model link na orodha ya menu moja kwa moja kwa wateja.',
      parameters: ['recipient_phone', 'template_name', 'product_3d_link', 'discount_code'],
      status: 'active',
      samplePayload: {
        tool: 'meta_whatsapp_send_interactive_template',
        arguments: {
          template: 'papo_ar_promo_v1',
          language: 'sw',
          components: [{ type: 'button', sub_type: 'url', index: 0, parameters: [{ type: 'text', text: 'AR_VIEW' }] }]
        }
      }
    },
    {
      id: 'sync_facebook_catalog',
      serverId: 'srv-catalog',
      name: 'meta_commerce_sync_products_to_facebook',
      description: 'Tuma bidhaa mpya zilizo na picha za 3D kwenda Meta Commerce Manager ili zionekane kwenye Facebook & Instagram Shop.',
      parameters: ['vendor_id', 'include_3d_assets', 'category_filter'],
      status: 'active',
      samplePayload: {
        tool: 'meta_commerce_sync_products_to_facebook',
        arguments: {
          vendorId: 'v-dar-es-salaam-01',
          includeGlbModels: true,
          autoTagLocation: 'Dar es Salaam'
        }
      }
    },
    {
      id: 'llama_auto_customer_support',
      serverId: 'srv-llama',
      name: 'meta_llama_agent_resolve_ticket',
      description: 'Tumia Llama 3 Agent Context kutatua changamoto za wateja waliocheleweshwa chakula au wenye maswali ya malipo.',
      parameters: ['customer_id', 'order_id', 'issue_description'],
      status: 'active',
      samplePayload: {
        tool: 'meta_llama_agent_resolve_ticket',
        arguments: {
          orderId: 'ORD-98214',
          action: 'issue_coupon_compensation',
          amountTzs: 2000
        }
      }
    },
    {
      id: 'firestore_query_top_3d_dishes',
      serverId: 'srv-firestore',
      name: 'papo_db_fetch_trending_ar_items',
      description: 'Soma chakula kinachoongoza kuangaliwa kwa 3D AR kwenye meza ili kutengeneza tangazo la Meta Ads.',
      parameters: ['timeframe', 'limit'],
      status: 'active',
      samplePayload: {
        tool: 'papo_db_fetch_trending_ar_items',
        arguments: { timeframe: '7_days', limit: 5 }
      }
    }
  ];

  // Mock Realtime Logs
  const [logs, setLogs] = useState<McpLogEvent[]>([
    {
      id: 'log-101',
      timestamp: new Date().toLocaleTimeString(),
      server: 'Meta WhatsApp Business MCP',
      tool: 'meta_whatsapp_send_interactive_template',
      status: 'success',
      latency: '18ms',
      details: 'Ujumbe wa WhatsApp uliotumwa kwa wateja 142 wenye matoleo ya 3D AR'
    },
    {
      id: 'log-102',
      timestamp: new Date(Date.now() - 40000).toLocaleTimeString(),
      server: 'Meta Commerce Catalog MCP',
      tool: 'meta_commerce_sync_products_to_facebook',
      status: 'success',
      latency: '24ms',
      details: 'Bidhaa 18 mpya za wauzaji zimesawazishwa na Meta Commerce Manager'
    },
    {
      id: 'log-103',
      timestamp: new Date(Date.now() - 120000).toLocaleTimeString(),
      server: 'Meta Llama 3 Agent Context Protocol',
      tool: 'meta_llama_agent_resolve_ticket',
      status: 'success',
      latency: '31ms',
      details: 'Llama Agent imejibu hoja ya mteja #ORD-9810 kwa mafanikio'
    }
  ]);

  const handleTestExecute = () => {
    setIsExecuting(true);
    setExecutionResult(null);

    setTimeout(() => {
      setIsExecuting(false);
      const resultObj = {
        status: '200_OK',
        protocol: 'Meta MCP JSON-RPC 2.0',
        timestamp: new Date().toISOString(),
        executed_tool: selectedTool,
        agent_reasoning: 'Llama 3 MCP Agent ilichanganua maagizo 48 ya zamani na kubaini wateja 32 wanaopendelea vyakula vya 3D AR.',
        action_summary: '✅ Ujumbe wa WhatsApp na 3D Preview Link umetumwa kwa wateja 32 walengwa.',
        meta_api_response: {
          messaging_product: 'whatsapp',
          contacts: [{ input: '+255712345678', wa_id: '255712345678' }],
          messages: [{ id: 'wamid.HBgLMjU1NzEyMzQ1Njc4FQIAERgSQTU1NDM4OTI3RkFFRDk2RTBBAA==' }]
        }
      };
      setExecutionResult(JSON.stringify(resultObj, null, 2));

      // Append log
      const newLog: McpLogEvent = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        server: mcpTools.find(t => t.id === selectedTool)?.serverId || 'Meta MCP Server',
        tool: selectedTool,
        status: 'success',
        latency: '22ms',
        details: `Simulated MCP tool execution via Admin Console`
      };
      setLogs(prev => [newLog, ...prev]);
      toast.success('⚡ Meta MCP Tool Execution imekamilika kwa mafanikio!');
    }, 1200);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-950 to-black rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-[11px] uppercase tracking-wider px-3 py-1 rounded-full border border-blue-400/30 shadow-lg flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                <span>Meta's MCP Integration Hub</span>
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                Protocol v1.0 Ready
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>Meta Model Context Protocol (MCP)</span>
            </h1>

            <p className="text-sm text-neutral-300 leading-relaxed font-medium">
              Unganisha mfumo wa **PapoFood Admin** na huduma za **Meta (WhatsApp, Instagram, Facebook Commerce, Llama 3 Agents)** kwa kutumia muundo wa **MCP (Model Context Protocol)** kwa ufanisi wa hali ya juu na mawasiliano ya moja kwa moja ya AI.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white/5 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
            <div className="flex items-center gap-3 px-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
              <div>
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">MCP Status</p>
                <p className="text-xs text-emerald-400 font-extrabold">5/5 Servers Active</p>
              </div>
            </div>
            <div className="h-8 w-px bg-white/10 hidden sm:block" />
            <Button
              onClick={() => toast.success('Meta MCP Servers zote zimepigiwa ping na ziko salama!')}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
              <span>Ping Servers</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setActiveTab('servers')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'servers'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:text-white'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>MCP Servers ({mcpServers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tools')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'tools'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>MCP Tools ({mcpTools.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('workflows')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'workflows'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:text-white'
          }`}
        >
          <Workflow className="w-4 h-4" />
          <span>Automated Workflows</span>
        </button>

        <button
          onClick={() => setActiveTab('tester')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'tester'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:text-white'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>MCP Agent Console</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'logs'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Logs ({logs.length})</span>
        </button>
      </div>

      {/* TAB 1: SERVERS */}
      {activeTab === 'servers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mcpServers.map((srv) => (
              <Card key={srv.id} className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-xl relative overflow-hidden flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-bold">
                      {srv.protocol}
                    </Badge>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-extrabold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{srv.latencyMs}ms</span>
                    </div>
                  </div>
                  <CardTitle className="text-base font-extrabold text-neutral-900 dark:text-white flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>{srv.name}</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mt-1">
                    {srv.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0 space-y-3">
                  <div className="bg-neutral-50 dark:bg-neutral-950 p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-1.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-neutral-400">
                      <span>Endpoint:</span>
                      <span className="text-blue-500 font-bold truncate max-w-[180px]">{srv.endpointUrl}</span>
                    </div>
                    <div className="flex items-center justify-between text-neutral-400">
                      <span>Tools Exposed:</span>
                      <span className="text-neutral-800 dark:text-neutral-200 font-extrabold">{srv.toolsCount} Active Tools</span>
                    </div>
                    <div className="flex items-center justify-between text-neutral-400">
                      <span>Last Activity:</span>
                      <span className="text-emerald-400 font-medium">{srv.lastPing}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      onClick={() => {
                        toast.info(`Server "${srv.name}" imehakikiwa na iko huru kupokea MCP tool calls.`);
                      }}
                      className="w-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-white font-extrabold text-xs rounded-xl py-2 flex items-center justify-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                      <span>Kagua Status</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Credentials Card */}
          <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-500" />
                <span>Meta MCP Security & API Credentials</span>
              </CardTitle>
              <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
                Sajili Funguo za API (Tokens) ili Meta MCP Servers ziweze kuwasiliana kwa usalama na Meta Graph API v20.0.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-extrabold text-neutral-700 dark:text-neutral-300">Meta Access Token (Long-Lived)</Label>
                  <Input 
                    type="password"
                    value={metaAccessToken}
                    onChange={(e) => setMetaAccessToken(e.target.value)}
                    className="bg-neutral-50 dark:bg-neutral-950 font-mono text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-extrabold text-neutral-700 dark:text-neutral-300">WhatsApp Business Phone ID</Label>
                  <Input 
                    value={whatsappPhoneId}
                    onChange={(e) => setWhatsappPhoneId(e.target.value)}
                    className="bg-neutral-50 dark:bg-neutral-950 font-mono text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-extrabold text-neutral-700 dark:text-neutral-300">Meta App Secret Key</Label>
                  <Input 
                    type="password"
                    value={metaAppSecret}
                    onChange={(e) => setMetaAppSecret(e.target.value)}
                    className="bg-neutral-50 dark:bg-neutral-950 font-mono text-xs rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button 
                  onClick={() => toast.success('Meta MCP Credentials zimehifadhiwa kikamilifu!')}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-xs rounded-xl px-6 py-2.5 shadow-lg"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  <span>Hifadhi Credentials</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: TOOLS */}
      {activeTab === 'tools' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mcpTools.map((tool) => (
              <Card key={tool.id} className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Badge className="bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-[10px] font-mono">
                      {tool.serverId}
                    </Badge>
                    <Badge className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
                      MCP Tool Active
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-extrabold text-neutral-900 dark:text-white font-mono flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-blue-500" />
                    <span>{tool.name}</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mt-1">
                    {tool.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Parameters:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tool.parameters.map((p) => (
                        <span key={p} className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono text-[10px] px-2 py-0.5 rounded-md border border-neutral-200 dark:border-neutral-700">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Sample JSON Schema:</p>
                    <pre className="bg-neutral-950 text-emerald-400 font-mono text-[10px] p-3 rounded-xl border border-neutral-800 overflow-x-auto">
                      {JSON.stringify(tool.samplePayload, null, 2)}
                    </pre>
                  </div>

                  <div className="pt-1">
                    <Button
                      onClick={() => {
                        setSelectedTool(tool.id);
                        setActiveTab('tester');
                        toast.info(`MCP Tool "${tool.name}" imechaguliwa kwenye Agent Console.`);
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl py-2 flex items-center justify-center gap-1.5 shadow-md"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Jaribu Kwenye Console</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: WORKFLOWS */}
      {activeTab === 'workflows' && (
        <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2">
              <Workflow className="w-5 h-5 text-indigo-500" />
              <span>Automated Meta MCP Agent Workflows</span>
            </CardTitle>
            <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
              Washa au zima mifumo ya kiotomatiki inayotumia Meta MCP tools kufanya kazi bila uingiliaji wa binadamu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800 space-y-4">
              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-500" />
                    <Label className="text-sm font-extrabold text-neutral-900 dark:text-white">
                      WhatsApp MCP Auto-Notifications for Orders
                    </Label>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Kila mteja anapoweka oda, Meta WhatsApp MCP server inatuma kiotomatiki ujumbe wa uthibitisho pamoja na kitufe cha live tracker na 3D AR view.
                  </p>
                </div>
                <Switch 
                  checked={whatsappMcpNotifications}
                  onCheckedChange={(val) => {
                    setWhatsappMcpNotifications(val);
                    toast.success(val ? 'WhatsApp MCP Order Notifications ZIMEWASHWA' : 'ZIMEZIMWA');
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-blue-500" />
                    <Label className="text-sm font-extrabold text-neutral-900 dark:text-white">
                      Realtime Facebook & Instagram Catalog Sync via MCP
                    </Label>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Wauzaji wanapoweka vyakula vipya au kubadilisha bei, Meta Catalog MCP inasawazisha moja kwa moja bidhaa hizo kwenye Duka la Facebook/Instagram la PapoFood.
                  </p>
                </div>
                <Switch 
                  checked={autoSyncMetaCatalog}
                  onCheckedChange={(val) => {
                    setAutoSyncMetaCatalog(val);
                    toast.success(val ? 'Meta Catalog Realtime Sync IMEWASHWA' : 'IMEZIMWA');
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-purple-500" />
                    <Label className="text-sm font-extrabold text-neutral-900 dark:text-white">
                      Meta Llama 3 AI Support Agent Protocol
                    </Label>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Ruhusu AI Agent yenye Llama 3 kutatua malalamiko ya wateja (Customer Support) masaa 24/7 kupitia WhatsApp na Instagram DMs.
                  </p>
                </div>
                <Switch 
                  checked={isAiAgentEnabled}
                  onCheckedChange={(val) => {
                    setIsAiAgentEnabled(val);
                    toast.success(val ? 'Llama 3 AI Support Agent IMEWASHWA' : 'IMEZIMWA');
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: TESTER / CONSOLE */}
      {activeTab === 'tester' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-xl">
            <CardHeader>
              <CardTitle className="text-base font-extrabold text-neutral-900 dark:text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-blue-500" />
                <span>Meta MCP Agent Prompt Console</span>
              </CardTitle>
              <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
                Jaribu kutuma amri na maagizo kwa Meta MCP Tools kuona jinsi AI Agent inavyofanya kazi na kutekeleza majukumu.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-extrabold text-neutral-700 dark:text-neutral-300">Chagua MCP Tool:</Label>
                <select
                  value={selectedTool}
                  onChange={(e) => setSelectedTool(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-mono rounded-xl p-2.5 text-neutral-900 dark:text-white"
                >
                  {mcpTools.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.serverId})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-extrabold text-neutral-700 dark:text-neutral-300">Ujumbe / Maagizo kwa AI Agent (Prompt):</Label>
                <Textarea
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  rows={4}
                  className="bg-neutral-50 dark:bg-neutral-950 font-mono text-xs rounded-xl"
                  placeholder="Andika maagizo hapa..."
                />
              </div>

              <Button
                onClick={handleTestExecute}
                disabled={isExecuting}
                className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-extrabold text-xs uppercase tracking-wider py-3 rounded-xl shadow-xl flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all"
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                    <span>Inatekeleza Kupitia Meta MCP Protocol...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>Tekeleza MCP Tool Calling Now</span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-neutral-950 border-neutral-800 shadow-2xl flex flex-col">
            <CardHeader className="border-b border-neutral-800 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-blue-400" />
                  <span>Meta MCP Execution Response JSON</span>
                </CardTitle>
                <span className="text-[10px] font-mono text-neutral-500">JSON-RPC 2.0</span>
              </div>
            </CardHeader>

            <CardContent className="p-4 flex-1 font-mono text-[11px] overflow-y-auto max-h-[380px]">
              {isExecuting ? (
                <div className="h-full flex flex-col items-center justify-center py-12 text-neutral-500 gap-3">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                  <p className="text-xs font-sans">Mawasiliano na Meta MCP Server yanaendelea...</p>
                </div>
              ) : executionResult ? (
                <pre className="text-emerald-400 leading-relaxed whitespace-pre-wrap">
                  {executionResult}
                </pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-12 text-neutral-600 text-center gap-2">
                  <Terminal className="w-8 h-8 text-neutral-700" />
                  <p className="text-xs font-sans">Bonyeza "Tekeleza MCP Tool Calling Now" ili kuona majibu hapa.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 5: LOGS */}
      {activeTab === 'logs' && (
        <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-extrabold text-neutral-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-500" />
                <span>Meta MCP Realtime Event Inspector</span>
              </CardTitle>
              <Button
                onClick={() => toast.info('Logs zimesafishwa')}
                variant="outline"
                className="text-xs font-bold"
              >
                Safi Logs
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800 font-mono text-[11px]">
              {logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-950 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px]">
                        {log.status.toUpperCase()}
                      </Badge>
                      <span className="font-extrabold text-neutral-900 dark:text-white">{log.tool}</span>
                      <span className="text-neutral-500 text-[10px]">({log.server})</span>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 font-sans">
                      {log.details}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-neutral-500 text-[10px] shrink-0">
                    <span className="bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded font-bold">{log.latency}</span>
                    <span>{log.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
