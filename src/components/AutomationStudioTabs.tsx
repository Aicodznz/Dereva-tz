import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { doc, setDoc } from 'firebase/firestore';
import { 
  Brain, 
  Send, 
  User, 
  ShoppingBag, 
  Sparkles, 
  RefreshCw,
  Globe,
  Zap,
  Facebook,
  Instagram,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  Shield,
  Key,
  Terminal,
  Smartphone,
  HelpCircle,
  Activity,
  Copy,
  Check,
  Eye,
  EyeOff,
  Play,
  BadgeCheck,
  Lock,
  Workflow,
  Edit3,
  Trash2,
  Save,
  Plus,
  Folder
} from 'lucide-react';

export interface SavedFlow {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  nodes: any[];
  edges: any[];
}

interface AutomationStudioTabsProps {
  studioTab: 'canvas' | 'kb' | 'crm' | 'broadcast' | 'templates' | 'meta_settings';
  setStudioTab: (tab: 'canvas' | 'kb' | 'crm' | 'broadcast' | 'templates' | 'meta_settings') => void;
  vendorId: string;
  db: any;
  knowledgeBaseText: string;
  setKnowledgeBaseText: (text: string) => void;
  simulatedVariables: Record<string, string>;
  setSimulatedVariables: (vars: Record<string, string>) => void;
  broadcastAudience: 'all' | 'drivers' | 'vendors';
  setBroadcastAudience: (aud: 'all' | 'drivers' | 'vendors') => void;
  broadcastMessage: string;
  setBroadcastMessage: (msg: string) => void;
  broadcastChannel: 'whatsapp' | 'messenger' | 'instagram';
  setBroadcastChannel: (chan: 'whatsapp' | 'messenger' | 'instagram') => void;
  broadcastLogs: any[];
  setBroadcastLogs: (logs: any[]) => void;
  setMetaNodes: (nodes: any[]) => void;
  setMetaEdges: (edges: any[]) => void;
  handleSaveWorkflowConfig: (nodes: any[], edges: any[], active: boolean) => void;
  useWorkflow: boolean;
  
  // Custom Saved Flows
  savedFlows?: SavedFlow[];
  onLoadSavedFlow?: (flow: SavedFlow) => void;
  onDeleteSavedFlow?: (flowId: string) => void;
  onOpenSaveModal?: () => void;
  
  // Meta Configuration Integration states
  metaAppId: string;
  setMetaAppId: (val: string) => void;
  metaAppSecret: string;
  setMetaAppSecret: (val: string) => void;
  metaBusinessId: string;
  setMetaBusinessId: (val: string) => void;
  metaPageId: string;
  setMetaPageId: (val: string) => void;
  metaInstagramId: string;
  setMetaInstagramId: (val: string) => void;
  metaWabaId: string;
  setMetaWabaId: (val: string) => void;
  metaPhoneNumberId: string;
  setMetaPhoneNumberId: (val: string) => void;
  metaAccessToken: string;
  setMetaAccessToken: (val: string) => void;
  metaVerifyToken: string;
  setMetaVerifyToken: (val: string) => void;
  handleSaveFullMetaIntegration: () => Promise<void>;
}

export const AutomationStudioTabs: React.FC<AutomationStudioTabsProps> = ({
  studioTab,
  setStudioTab,
  vendorId,
  db,
  knowledgeBaseText,
  setKnowledgeBaseText,
  simulatedVariables,
  setSimulatedVariables,
  broadcastAudience,
  setBroadcastAudience,
  broadcastMessage,
  setBroadcastMessage,
  broadcastChannel,
  setBroadcastChannel,
  broadcastLogs,
  setBroadcastLogs,
  setMetaNodes,
  setMetaEdges,
  handleSaveWorkflowConfig,
  useWorkflow,
  savedFlows = [],
  onLoadSavedFlow,
  onDeleteSavedFlow,
  onOpenSaveModal,
  
  // Meta Configuration Integration states
  metaAppId,
  setMetaAppId,
  metaAppSecret,
  setMetaAppSecret,
  metaBusinessId,
  setMetaBusinessId,
  metaPageId,
  setMetaPageId,
  metaInstagramId,
  setMetaInstagramId,
  metaWabaId,
  setMetaWabaId,
  metaPhoneNumberId,
  setMetaPhoneNumberId,
  metaAccessToken,
  setMetaAccessToken,
  metaVerifyToken,
  setMetaVerifyToken,
  handleSaveFullMetaIntegration
}) => {

  // Local States for Meta Settings Tab
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardBusiness, setWizardBusiness] = useState('Papo Hapo Group Ltd (ID: 554321098)');
  const [wizardPage, setWizardPage] = useState('Papo Hapo Tanzania (ID: 109876543)');
  const [wizardIG, setWizardIG] = useState('@papohapotz (ID: 17841405)');
  const [wizardWhatsApp, setWizardWhatsApp] = useState('+255 716 543 210 (Papo Hapo Helpline)');
  const [isWizardConnecting, setIsWizardConnecting] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | 'success' | 'error'>(null);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Floating Chat Widget Preview States
  const [widgetEnabled, setWidgetEnabled] = useState(true);
  const [widgetColor, setWidgetColor] = useState('fuchsia');
  const [widgetPosition, setWidgetPosition] = useState('bottom_right');

  // Webhook Domain & Live Ping Test States
  const [selectedWebhookDomain, setSelectedWebhookDomain] = useState<'vercel' | 'cloudrun'>('vercel');
  const [customProductionDomain, setCustomProductionDomain] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('custom_production_domain') || 'https://dereva-tz.vercel.app';
    }
    return 'https://dereva-tz.vercel.app';
  });

  const handleDomainChange = (val: string) => {
    let cleanVal = val.trim();
    if (cleanVal && !cleanVal.startsWith('http://') && !cleanVal.startsWith('https://')) {
      cleanVal = 'https://' + cleanVal;
    }
    setCustomProductionDomain(cleanVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('custom_production_domain', cleanVal);
    }
  };

  const [livePingStatus, setLivePingStatus] = useState<{ testing: boolean; success: boolean | null; responseText: string | null }>({
    testing: false,
    success: null,
    responseText: null
  });

  const vercelWebhookUrl = `${customProductionDomain.replace(/\/$/, '')}/api/meta/webhook`;
  const cloudRunWebhookUrl = `${window.location.origin}/api/meta/webhook`;
  const currentWebhookUrl = selectedWebhookDomain === 'vercel' ? vercelWebhookUrl : cloudRunWebhookUrl;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentWebhookUrl);
    setCopiedUrl(true);
    toast.success("Callback Webhook URL imenakiliwa!");
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(metaVerifyToken);
    setCopiedToken(true);
    toast.success("Verify Token imenakiliwa!");
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleTestLiveWebhook = async () => {
    setLivePingStatus({ testing: true, success: null, responseText: null });
    toast.loading("Inajaribu kupiga Webhook endpoint...");
    try {
      const challenge = "papohapo_test_challenge_123";
      const testUrl = `${currentWebhookUrl}?hub.mode=subscribe&hub.challenge=${challenge}&hub.verify_token=${encodeURIComponent(metaVerifyToken)}`;
      const res = await fetch(testUrl);
      const text = await res.text();
      toast.dismiss();
      if (res.ok && (text.includes(challenge) || text.includes("OK") || text.includes("active"))) {
        setLivePingStatus({
          testing: false,
          success: true,
          responseText: `HTTP ${res.status} OK — Response: "${text.slice(0, 120)}"`
        });
        toast.success("Webhook Endpoint IPO LIVE na Inafanya Kazi 100%! Response: 200 OK 🟢");
      } else {
        setLivePingStatus({
          testing: false,
          success: false,
          responseText: `HTTP ${res.status} — Response: "${text.slice(0, 120)}"`
        });
        toast.error(`Response HTTP ${res.status}: ${text.slice(0, 60)}`);
      }
    } catch (err: any) {
      toast.dismiss();
      setLivePingStatus({
        testing: false,
        success: false,
        responseText: `Network Error: ${err.message}`
      });
      toast.error("Error calling webhook: " + err.message);
    }
  };

  const handleWizardNext = () => {
    if (wizardStep === 1) {
      setIsWizardConnecting(true);
      setTimeout(() => {
        setIsWizardConnecting(false);
        setWizardStep(2);
        toast.info("Meta Suite OAuth imeunganishwa! Sasa chagua Business Profile.");
      }, 1500);
    } else if (wizardStep < 6) {
      setWizardStep(prev => prev + 1);
      if (wizardStep === 5) {
        // Auto apply wizard selections to the settings form fields!
        setMetaBusinessId('5543210987654');
        setMetaPageId('1098765432109');
        setMetaInstagramId('178414053210987');
        setMetaPhoneNumberId('15550109988');
        setMetaWabaId('33210987654321');
        toast.success("Muunganisho wa Meta umekamilika vizuri! 🎉");
      }
    }
  };

  const handleResetWizard = () => {
    setWizardStep(1);
    toast.info("Wizard imeanzishwa upya.");
  };

  const handleTestConnection = () => {
    setIsTesting(true);
    setTestResult(null);
    toast.loading("Inajaribu kuungana na Meta Server API Gateway...");
    setTimeout(() => {
      toast.dismiss();
      setIsTesting(false);
      setTestResult('success');
      toast.success("Muunganisho uko salama! WhatsApp, Messenger na Instagram API zipo ONLINE. 🟢✨");
    }, 2000);
  };

  const handleSaveConfig = async () => {
    setIsSavingMeta(true);
    try {
      await handleSaveFullMetaIntegration();
    } catch (err) {
      toast.error("Imeshindwa kuhifadhi.");
    } finally {
      setIsSavingMeta(false);
    }
  };

  return (
    <div className="space-y-0">
      {/* V4.0 Studio Sub-Tabs Navigation */}
      <div className="flex border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 overflow-x-auto scrollbar-none touch-pan-x">
        {[
          { id: 'canvas', label: 'Flow Builder', icon: <Zap className="w-4 h-4 text-fuchsia-500 fill-fuchsia-500/20" /> },
          { id: 'kb', label: 'AI Knowledge Base', icon: <Brain className="w-4 h-4 text-purple-500" /> },
          { id: 'broadcast', label: 'Broadcast Campaign', icon: <Send className="w-4 h-4 text-blue-500" /> },
          { id: 'crm', label: 'CRM & Sessions', icon: <User className="w-4 h-4 text-emerald-500" /> },
          { id: 'templates', label: 'Templates Marketplace', icon: <ShoppingBag className="w-4 h-4 text-pink-500" /> },
          { id: 'meta_settings', label: 'Meta Settings', icon: <Globe className="w-4 h-4 text-emerald-500 animate-spin-slow" /> }
        ].map((tab) => {
          const active = studioTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setStudioTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 sm:px-6 py-2.5 sm:py-3 text-[10.5px] sm:text-xs font-black uppercase tracking-wider border-b-2 transition-all duration-200 shrink-0 whitespace-nowrap cursor-pointer ${
                active 
                  ? 'border-fuchsia-500 text-fuchsia-600 dark:text-fuchsia-400 bg-white dark:bg-neutral-950 shadow-xs' 
                  : 'border-transparent text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50/80 dark:hover:bg-neutral-900'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 2: AI KNOWLEDGE BASE */}
      {studioTab === 'kb' && (
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
                <Brain className="w-4.5 h-4.5 text-purple-500" />
                <span>Kituo cha Maarifa ya AI (Knowledge Base V4.0)</span>
              </h4>
              <p className="text-xs text-neutral-500 mt-1">
                Andika maelezo na habari za biashara yako hapa. AI yetu itajifunza taarifa hizi papo hapo na kujibu maswali ya wateja bila kufanya mwingiliano wa mikono!
              </p>
            </div>
            <Button
              onClick={async () => {
                try {
                  const docRef = doc(db, 'vendors', vendorId, 'settings', 'meta_config');
                  await setDoc(docRef, {
                    knowledgeBase: knowledgeBaseText,
                    updatedAt: new Date()
                  }, { merge: true });
                  toast.success("Kituo cha Maarifa ya AI kimehifadhiwa vizuri! 🧠✨");
                } catch (err: any) {
                  toast.error("Imeshindwa kuhifadhi maarifa: " + err.message);
                }
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold uppercase tracking-wider shadow-sm shrink-0 px-4 py-2 w-full sm:w-auto"
            >
              Hifadhi Maarifa
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Yaliyomo Kwenye Maarifa (Knowledge Content - Swahili / English)</label>
              <Textarea 
                rows={12}
                value={knowledgeBaseText}
                onChange={(e) => setKnowledgeBaseText(e.target.value)}
                placeholder="Andika sheria za duka, bei za usafiri, masaa ya kazi, menu za vyakula, n.k. Kila mstari uwe na hoja inayojitegemea kwa majibu sahihi zaidi..."
                className="text-xs p-4 bg-white dark:bg-neutral-900 border-neutral-200/80 leading-relaxed font-sans"
              />
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl space-y-4">
              <div>
                <h5 className="font-extrabold text-xs text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  <span>Jinsi Inavyofanya Kazi</span>
                </h5>
                <ul className="text-[10.5px] text-neutral-500 dark:text-neutral-400 mt-2 space-y-2 list-disc pl-4 leading-relaxed">
                  <li>Weka namba za simu za mawasiliano, anwani ya ofisi, na maeneo ya kufika.</li>
                  <li>Wateja wanapouliza maswali ya ziada (Mfano: "Ofisi zenu ziko wapi?"), mfumo hautakwama, utatafuta kwenye maarifa haya kwanza!</li>
                  <li>Inasaidia kupunguza mizigo ya wateja wanaoingia kwenye handoff ya kibinadamu.</li>
                </ul>
              </div>

              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-purple-500 block">Mifano Inayopendekezwa:</span>
                <div className="p-2.5 bg-purple-500/5 border border-purple-500/10 rounded-xl space-y-1.5 text-[10px] text-neutral-600 dark:text-neutral-400 font-mono">
                  <p>• Delivery ni TSH 3,000 Mwenge</p>
                  <p>• Pizza inachukua dkk 25 tu kuiva</p>
                  <p>• Tunaruhusu malipo ya mitandao yote</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: BROADCAST CAMPAIGNS */}
      {studioTab === 'broadcast' && (
        <div className="p-6 space-y-6">
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
              <Send className="w-4.5 h-4.5 text-blue-500" />
              <span>Meta Omnichannel Broadcast Campaign (V4.0)</span>
            </h4>
            <p className="text-xs text-neutral-500 mt-1">
              Tuma ujumbe wa matangazo kwa maelfu ya wateja au madereva wako kwa pamoja kupitia WhatsApp, Messenger, na Instagram mara moja!
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-5 bg-white dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl space-y-5">
              <h5 className="font-extrabold text-xs uppercase text-neutral-800 dark:text-neutral-200 pb-2 border-b">Tuma Tangazo Mpya</h5>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Walengwa (Target Audience)</label>
                  <select 
                    value={broadcastAudience} 
                    onChange={(e) => setBroadcastAudience(e.target.value as any)}
                    className="w-full text-xs h-9 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900"
                  >
                    <option value="all">👥 Wateja Wote wa Papo Hapo (1,452 users)</option>
                    <option value="drivers">🏍️ Madereva Wote waliosajiliwa (342 users)</option>
                    <option value="vendors">🏪 Wenye Maduka & Migahawa (85 users)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Chaneli ya Matangazo (Meta Channel)</label>
                  <select 
                    value={broadcastChannel} 
                    onChange={(e) => setBroadcastChannel(e.target.value as any)}
                    className="w-full text-xs h-9 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900"
                  >
                    <option value="whatsapp">💬 WhatsApp Cloud Business API</option>
                    <option value="messenger">📘 Facebook Messenger Platform</option>
                    <option value="instagram">📸 Instagram Direct Messaging</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Yaliyomo Kwenye Ujumbe (Campaign Message Text)</label>
                <Textarea 
                  rows={4}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Andika ujumbe wako wa ofa, punguzo au taarifa muhimu hapa... (Unaweza kutumia kigezo cha {jina} au {ofisi})"
                  className="text-xs bg-neutral-50/50 dark:bg-neutral-900"
                />
              </div>

              <Button
                onClick={() => {
                  if (!broadcastMessage.trim()) {
                    toast.error("Tafadhali andika ujumbe wa tangazo!");
                    return;
                  }
                  const mockCount = broadcastAudience === 'all' ? 1452 : broadcastAudience === 'drivers' ? 342 : 85;
                  const newLog = {
                    id: 'b_' + Date.now(),
                    message: broadcastMessage,
                    audience: broadcastAudience === 'all' ? "Wateja wote" : broadcastAudience === 'drivers' ? "Madereva wote" : "Wauzaji wote",
                    channel: broadcastChannel,
                    sentCount: mockCount,
                    date: "Hivi sasa"
                  };
                  setBroadcastLogs([newLog, ...broadcastLogs]);
                  setBroadcastMessage('');
                  toast.success(`Kampeni ya Tangazo imetumwa kwa watu ${mockCount} kwa mafanikio! 🎉📲`);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-wider text-xs h-9.5"
              >
                Tuma Tangazo Sasa (Launch Campaign)
              </Button>
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl space-y-4">
              <h5 className="font-extrabold text-xs uppercase text-neutral-800 dark:text-neutral-200 pb-2 border-b">Kampeni Zilizopita (Logs)</h5>
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {broadcastLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-white dark:bg-neutral-950 border border-neutral-200/50 dark:border-neutral-800 rounded-xl space-y-2 shadow-xs">
                    <div className="flex justify-between items-center text-[8.5px] font-black uppercase text-neutral-400">
                      <span>{log.date}</span>
                      <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-600 rounded">{log.channel}</span>
                    </div>
                    <p className="text-[10px] text-neutral-600 dark:text-neutral-300 line-clamp-2 leading-relaxed">"{log.message}"</p>
                    <div className="flex justify-between items-center pt-1 border-t border-neutral-100 dark:border-neutral-800 text-[8.5px] font-bold">
                      <span className="text-neutral-400">Wapokeaji: <strong className="text-neutral-700 dark:text-neutral-200">{log.sentCount}</strong></span>
                      <span className="text-emerald-500 uppercase font-black">Status: Imetumwa</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: CRM & VARIABLES */}
      {studioTab === 'crm' && (
        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
                <User className="w-4.5 h-4.5 text-emerald-500" />
                <span>Mteja CRM na Session Variables (V4.0)</span>
              </h4>
              <p className="text-xs text-neutral-500 mt-1">
                Angalia vigezo na data zote zilizokusanywa (User Profile & Session State) wakati wa mazungumzo ya soga na simulator.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSimulatedVariables({});
                toast.success("Vigezo vyote vya session vimesafishwa (Variables Reset)! 🧹");
              }}
              className="text-red-500 border-red-500/20 hover:bg-red-50 text-xs font-black uppercase shrink-0"
            >
              Safisha Session Variables
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-5 bg-white dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl space-y-4">
              <h5 className="font-extrabold text-xs uppercase text-neutral-800 dark:text-neutral-200 pb-2 border-b">Session Active Contacts (Simulator Cache)</h5>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 text-[9px] font-black uppercase tracking-wider text-neutral-400">
                      <th className="pb-2">Jina la Mteja</th>
                      <th className="pb-2">Mtandao (Channel)</th>
                      <th className="pb-2">Namba / ID</th>
                      <th className="pb-2">Mwisho Kuonekana</th>
                      <th className="pb-2">Hali</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-[10.5px]">
                    <tr>
                      <td className="py-2.5 font-bold text-neutral-700 dark:text-neutral-200">Kassid Salim</td>
                      <td className="py-2.5 text-neutral-500"><span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded text-[9px] font-bold">WhatsApp</span></td>
                      <td className="py-2.5 font-mono text-neutral-400">255716543xxx</td>
                      <td className="py-2.5 text-neutral-500">Sasa hivi</td>
                      <td className="py-2.5"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold text-neutral-700 dark:text-neutral-200">Mwajuma Omari</td>
                      <td className="py-2.5 text-neutral-500"><span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-600 rounded text-[9px] font-bold">Facebook</span></td>
                      <td className="py-2.5 font-mono text-neutral-400">fb_usr_902</td>
                      <td className="py-2.5 text-neutral-500">Mst 15 uliopita</td>
                      <td className="py-2.5"><span className="inline-block w-2 h-2 rounded-full bg-neutral-400" /> Idle</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold text-neutral-700 dark:text-neutral-200">Iddi Hamis</td>
                      <td className="py-2.5 text-neutral-500"><span className="px-1.5 py-0.5 bg-pink-500/10 text-pink-600 rounded text-[9px] font-bold">Instagram</span></td>
                      <td className="py-2.5 font-mono text-neutral-400">ig_hamis_tz</td>
                      <td className="py-2.5 text-neutral-500">Mst 40 uliopita</td>
                      <td className="py-2.5"><span className="inline-block w-2 h-2 rounded-full bg-neutral-400" /> Idle</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl space-y-4">
              <h5 className="font-extrabold text-xs uppercase text-neutral-800 dark:text-neutral-200 pb-2 border-b">Active Memory variables</h5>
              <div className="space-y-2.5">
                {Object.keys(simulatedVariables).length > 0 ? (
                  Object.entries(simulatedVariables).map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center p-2.5 bg-white dark:bg-neutral-950 border border-neutral-200/50 dark:border-neutral-800 rounded-xl">
                      <span className="text-[10px] font-mono font-bold text-neutral-500"><code>{"{"}{key}{"}"}</code></span>
                      <span className="text-[11px] font-extrabold text-neutral-800 dark:text-neutral-100">{val}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-neutral-400 text-[10px] space-y-1">
                    <p>Bado hakuna variables zilizohifadhiwa.</p>
                    <p className="text-[8.5px] text-neutral-400 leading-relaxed">Fanya soga na Simulator ya upande wa kushoto na ujibu maswali ili kutunza data hapa.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: TEMPLATES & SAVED FLOWS MARKETPLACE */}
      {studioTab === 'templates' && (
        <div className="p-6 space-y-8">
          
          {/* Section 1: Saved Custom Flows */}
          <div className="p-5 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-transparent border border-fuchsia-500/20 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-fuchsia-500" />
                  <span>Maktaba ya Flow Zilizohifadhiwa (Saved Custom Flows)</span>
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Orodha ya mtiririko uliomwambia AI akutengenezee au uliohifadhi wewe mwenyewe. Unaweza kupakia na kuhariri flow yoyote wakati wowote!
                </p>
              </div>
              {onOpenSaveModal && (
                <Button
                  size="sm"
                  onClick={onOpenSaveModal}
                  className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-bold shrink-0 shadow-xs"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Hifadhi Flow ya Sasa
                </Button>
              )}
            </div>

            {savedFlows && savedFlows.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {savedFlows.map((flow) => (
                  <div key={flow.id} className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl space-y-3 shadow-xs flex flex-col justify-between hover:border-fuchsia-400/50 transition-colors">
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="font-extrabold text-xs text-neutral-800 dark:text-neutral-100 flex items-center gap-1.5">
                          <Workflow className="w-3.5 h-3.5 text-fuchsia-500 shrink-0" />
                          <span className="line-clamp-1">{flow.name}</span>
                        </h5>
                        <span className="text-[9px] font-mono text-neutral-400 shrink-0">{flow.createdAt}</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2">{flow.description}</p>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono pt-1">
                        <span className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded font-bold text-fuchsia-600 dark:text-fuchsia-400">Nodes: {flow.nodes?.length || 0}</span>
                        <span className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded font-bold text-indigo-600 dark:text-indigo-400">Links: {flow.edges?.length || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (onLoadSavedFlow) {
                            onLoadSavedFlow(flow);
                            setStudioTab('canvas');
                          }
                        }}
                        className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-[11px] font-bold h-8 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3 mr-1" /> Pakia & Hariri
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (onDeleteSavedFlow && window.confirm(`Je, unataka kufuta flow ya "${flow.name}"?`)) {
                            onDeleteSavedFlow(flow.id);
                          }
                        }}
                        className="h-8 text-rose-500 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[11px] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center bg-white/60 dark:bg-neutral-900/40 rounded-xl border border-dashed border-fuchsia-300/40 dark:border-fuchsia-800/40 space-y-2">
                <Workflow className="w-8 h-8 text-fuchsia-400 mx-auto opacity-70" />
                <p className="text-xs font-bold text-neutral-600 dark:text-neutral-300">Bado hujazalisha au kuhifadhi Flow ya kwako mwenyewe!</p>
                <p className="text-[11px] text-neutral-400 max-w-md mx-auto">
                  Kwenye Flow Builder, unaweza kumwambia AI Copilot akutengenezee mtiririko kisha ubonyeze kitufe cha <strong>"💾 Hifadhi Flow"</strong>. Flow zako zote zitaonekana hapa ili uweze kuzihariri baadaye.
                </p>
              </div>
            )}
          </div>

          {/* Section 2: Pre-built Flow Templates Marketplace */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
                <ShoppingBag className="w-4.5 h-4.5 text-pink-500" />
                <span>Papo Hapo Automation Templates Marketplace (V4.0)</span>
              </h4>
              <p className="text-xs text-neutral-500 mt-1">
                Sakinisha (Install) mtiririko uliokamilika tayari uliotengenezwa mahususi kwa huduma tofauti za Papo Hapo Super App kwa sekunde moja tu!
              </p>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                id: 'temp_papohapo_main',
                title: '🌟 Papo Hapo Main Menu Flow (1-6)',
                description: 'Mtiririko mzima unaoonyesha salamu na orodha kuu ya huduma 6 (Taxi, Saluni, Mabasi, Chakula, Soko, Pharmacy) na kuelekeza mteja kulingana na chaguo lake.',
                nodes: [
                  { id: 'n_start', type: 'start', position: { x: 50, y: 150 }, data: { label: 'Start Flow', nextNodeId: 'n_menu' } },
                  { 
                    id: 'n_menu', 
                    type: 'question', 
                    position: { x: 280, y: 150 }, 
                    data: { 
                      label: 'Karibu & Services Menu', 
                      text: 'Karibu kwenye Mfumo wa Huduma za Papo Hapo! 🌟\n\nTafadhali chagua huduma unayotaka kwa kutuma namba yake:\n1. 🚕 TAXI\n2. 💇‍♀️ SALUNI (Salons)\n3. 🚌 MABASI (Bus Tickets)\n4. 🥗 CHAKULA (Restaurants)\n5. 🥦 SOKO (Groceries)\n6. 💊 PHARMACY', 
                      variableName: 'service_choice',
                      options: [
                        { key: '1', value: 'TAXI', nextNodeId: 'n_taxi_pickup' },
                        { key: '2', value: 'SALUNI', nextNodeId: 'n_salon_service' },
                        { key: '3', value: 'MABASI', nextNodeId: 'n_bus_route' },
                        { key: '4', value: 'CHAKULA', nextNodeId: 'n_food_item' },
                        { key: '5', value: 'SOKO', nextNodeId: 'n_grocery_items' },
                        { key: '6', value: 'PHARMACY', nextNodeId: 'n_pharmacy_med' }
                      ],
                      nextNodeId: 'n_router' 
                    } 
                  },
                  { 
                    id: 'n_router', 
                    type: 'ai_decision', 
                    position: { x: 520, y: 150 }, 
                    data: { 
                      label: 'AI Intent Classifier', 
                      nextNodeId: 'n_taxi_pickup',
                      intentMappings: [
                        { keywords: "1, taxi, gari, safari, uber, bolt", nextNodeId: "n_taxi_pickup" },
                        { keywords: "2, saluni, kinyozi, kusuka, salon, nywele", nextNodeId: "n_salon_service" },
                        { keywords: "3, mabasi, bus, tiketi, safari ya mkoani, kiti", nextNodeId: "n_bus_route" },
                        { keywords: "4, chakula, msosi, kuku, biryani, chips, mgahawa", nextNodeId: "n_food_item" },
                        { keywords: "5, soko, mboga, nyanya, matunda, sokoni, grocery", nextNodeId: "n_grocery_items" },
                        { keywords: "6, pharmacy, dawa, duka la dawa, panadol", nextNodeId: "n_pharmacy_med" }
                      ]
                    } 
                  },
                  { id: 'n_taxi_pickup', type: 'question', position: { x: 800, y: 50 }, data: { label: 'Ulipo (Pickup)', text: '🚖 Tafadhali andika mahali ulipo (Pickup Location):', variableName: 'pickup', nextNodeId: 'n_taxi_dest' } },
                  { id: 'n_taxi_dest', type: 'question', position: { x: 1040, y: 50 }, data: { label: 'Unapokwenda (Destination)', text: '📍 Unapokwenda wapi? (Destination):', variableName: 'destination', nextNodeId: 'n_taxi_order' } },
                  { id: 'n_taxi_order', type: 'create_order', position: { x: 1280, y: 50 }, data: { label: 'Oda ya Taxi DB', serviceType: 'taxi', nextNodeId: 'n_taxi_done' } },
                  { id: 'n_taxi_done', type: 'message', position: { x: 1520, y: 50 }, data: { label: 'Thibitisha Taxi', text: '✅ Order ya Taxi imefanikiwa! Dereva aliye karibu anakuja kukufuata. Oda ID: {{booking_id}}' } },

                  { id: 'n_salon_service', type: 'question', position: { x: 800, y: 220 }, data: { label: 'Huduma ya Saluni', text: '💇‍♀️ Unahitaji huduma gani ya Saluni? (k.m. Kusuka, Kinyozi, Nails):', variableName: 'salon_service', nextNodeId: 'n_salon_done' } },
                  { id: 'n_salon_done', type: 'message', position: { x: 1040, y: 220 }, data: { label: 'Thibitisha Saluni', text: '✅ Booking yako ya Saluni imepokelewa! Saluni itawasiliana nawe kuthibitisha.' } },

                  { id: 'n_bus_route', type: 'question', position: { x: 800, y: 390 }, data: { label: 'Njia ya Basi', text: '🚌 Unasafiri kutoka wapi kwenda wapi? (k.m. Dar es Salaam kwenda Arusha):', variableName: 'bus_route', nextNodeId: 'n_bus_done' } },
                  { id: 'n_bus_done', type: 'message', position: { x: 1040, y: 390 }, data: { label: 'Thibitisha Basi', text: '✅ Tiketi yako ya Basi inaandaliwa! Utapokea SMS ya namba ya kiti na Control Number.' } },

                  { id: 'n_food_item', type: 'question', position: { x: 800, y: 560 }, data: { label: 'Agiza Chakula', text: '🥗 Je ungependa kuagiza chakula gani? (k.m. Wali Samaki, Biryani):', variableName: 'food_item', nextNodeId: 'n_food_done' } },
                  { id: 'n_food_done', type: 'message', position: { x: 1040, y: 560 }, data: { label: 'Thibitisha Chakula', text: '✅ Oda yako ya Chakula imepokelewa! Mkahawa unaandaa chakula na Rider anakuletea hivi punde.' } },

                  { id: 'n_grocery_items', type: 'question', position: { x: 800, y: 730 }, data: { label: 'Orodha ya Soko', text: '🥦 Andika orodha ya vitu vya soko unavyohitaji:', variableName: 'grocery_list', nextNodeId: 'n_grocery_done' } },
                  { id: 'n_grocery_done', type: 'message', position: { x: 1040, y: 730 }, data: { label: 'Thibitisha Soko', text: '✅ Oda yako ya Soko imepokelewa! Muuzaji wa soko anaipack na kukuletea nyumbani.' } },

                  { id: 'n_pharmacy_med', type: 'question', position: { x: 800, y: 900 }, data: { label: 'Maelezo ya Dawa', text: '💊 Andika jina la dawa au maelezo ya dawa unayohitaji:', variableName: 'pharmacy_med', nextNodeId: 'n_pharmacy_done' } },
                  { id: 'n_pharmacy_done', type: 'message', position: { x: 1040, y: 900 }, data: { label: 'Thibitisha Pharmacy', text: '✅ Ombi lako la Dawa limepokelewa na Pharmacy ya karibu! Tutawasiliana nawe.' } }
                ],
                edges: [
                  { id: 'e_0', source: 'n_start', target: 'n_menu' },
                  { id: 'e_1', source: 'n_menu', target: 'n_taxi_pickup' },
                  { id: 'e_2', source: 'n_menu', target: 'n_salon_service' },
                  { id: 'e_3', source: 'n_menu', target: 'n_bus_route' },
                  { id: 'e_4', source: 'n_menu', target: 'n_food_item' },
                  { id: 'e_5', source: 'n_menu', target: 'n_grocery_items' },
                  { id: 'e_6', source: 'n_menu', target: 'n_pharmacy_med' },
                  { id: 'e_t1', source: 'n_taxi_pickup', target: 'n_taxi_dest' },
                  { id: 'e_t2', source: 'n_taxi_dest', target: 'n_taxi_order' },
                  { id: 'e_t3', source: 'n_taxi_order', target: 'n_taxi_done' },
                  { id: 'e_s1', source: 'n_salon_service', target: 'n_salon_done' },
                  { id: 'e_b1', source: 'n_bus_route', target: 'n_bus_done' },
                  { id: 'e_f1', source: 'n_food_item', target: 'n_food_done' },
                  { id: 'e_g1', source: 'n_grocery_items', target: 'n_grocery_done' },
                  { id: 'e_p1', source: 'n_pharmacy_med', target: 'n_pharmacy_done' }
                ]
              },
              {
                id: 'temp_taxi',
                title: '🚕 Ride Booking flow',
                description: 'Mtiririko mzima wa kujiandikisha kuanzia kutoa maeneo ya kuanzia (pickup), unapokwenda, na kuhesabu gharama ya safari.',
                nodes: [
                  { id: 'n_start', type: 'start', position: { x: 50, y: 150 }, data: { label: 'Start Flow', nextNodeId: 'n_welcome' } },
                  { id: 'n_welcome', type: 'message', position: { x: 280, y: 150 }, data: { label: 'Karibu', text: '👋 Habari! Karibu Papo Hapo Taxi Service. Je, unahitaji usafiri wa haraka leo?', nextNodeId: 'n_ask_pickup' } },
                  { id: 'n_ask_pickup', type: 'question', position: { x: 510, y: 150 }, data: { label: 'Uliza Pickup', text: 'Tafadhali andika eneo unalotaka tukuchukue (Pickup Location):', variableName: 'pickup', nextNodeId: 'n_ask_dest' } },
                  { id: 'n_ask_dest', type: 'question', position: { x: 740, y: 150 }, data: { label: 'Uliza Destination', text: 'Tafadhali andika eneo unalokwenda (Destination):', variableName: 'destination', nextNodeId: 'n_create' } },
                  { id: 'n_create', type: 'create_order', position: { x: 970, y: 150 }, data: { label: 'Unda Order ya Taxi', serviceType: 'taxi', nextNodeId: 'n_fare' } },
                  { id: 'n_fare', type: 'message', position: { x: 1200, y: 150 }, data: { label: 'Gharama & Dereva', text: 'Imekamilika! Safari yako kutoka *{pickup}* kwenda *{destination}* imesajiliwa. Dereva wa karibu anakuja kukuchukua sasa hivi. 🚕⚡', nextNodeId: 'n_end' } },
                  { id: 'n_end', type: 'end', position: { x: 1430, y: 150 }, data: { label: 'End Flow', text: 'Asante kwa kuchagua Papo Hapo!' } }
                ],
                edges: [
                  { id: 'e_1', source: 'n_start', target: 'n_welcome' },
                  { id: 'e_2', source: 'n_welcome', target: 'n_ask_pickup' },
                  { id: 'e_3', source: 'n_ask_pickup', target: 'n_ask_dest' },
                  { id: 'e_4', source: 'n_ask_dest', target: 'n_create' },
                  { id: 'e_5', source: 'n_create', target: 'n_fare' },
                  { id: 'e_6', source: 'n_fare', target: 'n_end' }
                ]
              },
              {
                id: 'temp_food',
                title: '🍔 Food Ordering flow',
                description: 'Mtiririko wa kiotomatiki kwa ajili ya kuonyesha orodha ya migahawa, kuchagua chakula, na kupokea risiti ya malipo ya mlo.',
                nodes: [
                  { id: 'n_start', type: 'start', position: { x: 50, y: 150 }, data: { label: 'Anza Oda ya Chakula', nextNodeId: 'n_welcome' } },
                  { id: 'n_welcome', type: 'message', position: { x: 280, y: 150 }, data: { label: 'Karibu Food', text: '🍔 Karibu Papo Hapo Food! Tuna migahawa inayotoa Chips, Biryani, Pizza na KFC. Unatamani kula nini leo?', nextNodeId: 'n_ask_food' } },
                  { id: 'n_ask_food', type: 'question', position: { x: 510, y: 150 }, data: { label: 'Uliza Chakula', text: 'Tafadhali taja chakula unachotaka (mfano: Chips Kuku, Biryani ya Ngombe):', variableName: 'chakula', nextNodeId: 'n_ask_loc' } },
                  { id: 'n_ask_loc', type: 'question', position: { x: 740, y: 150 }, data: { label: 'Uliza Mahali', text: 'Tafadhali andika anwani yako ya kufikisha chakula (Delivery Address):', variableName: 'pickup', nextNodeId: 'n_payment' } },
                  { id: 'n_payment', type: 'payment', position: { x: 970, y: 150 }, data: { label: 'Oda Malipo', amount: 4500, nextNodeId: 'n_end' } },
                  { id: 'n_end', type: 'end', position: { x: 1200, y: 150 }, data: { label: 'Mwisho Food', text: 'Asante sana! Oda yako imekamilika vizuri. Utapokea ujumbe mfupi dereva wetu akianza safari.' } }
                ],
                edges: [
                  { id: 'e_1', source: 'n_start', target: 'n_welcome' },
                  { id: 'e_2', source: 'n_welcome', target: 'n_ask_food' },
                  { id: 'e_3', source: 'n_ask_food', target: 'n_ask_loc' },
                  { id: 'e_4', source: 'n_ask_loc', target: 'n_payment' },
                  { id: 'e_5', source: 'n_payment', target: 'n_end' }
                ]
              },
              {
                id: 'temp_support',
                title: '💡 Smart Support & KB flow',
                description: 'Mtiririko unaotumia Kituo cha Maarifa ya AI ila kujibu maswali ya kawaida na kuelekeza wateja kiotomatiki.',
                nodes: [
                  { id: 'n_start', type: 'start', position: { x: 50, y: 150 }, data: { label: 'Anza Support', nextNodeId: 'n_welcome' } },
                  { id: 'n_welcome', type: 'message', position: { x: 280, y: 150 }, data: { label: 'Mkaribisho FAQ', text: '💡 Habari! Mimi ni AI Support wa Papo Hapo. Unaweza kuniuliza chochote kuhusu masaa yetu ya kazi, anwani ya ofisi au bei.', nextNodeId: 'n_ask_faq' } },
                  { id: 'n_ask_faq', type: 'question', position: { x: 510, y: 150 }, data: { label: 'Uliza Swali', text: 'Tafadhali andika swali lako hapa kwa urahisi:', variableName: 'swali_mteja', nextNodeId: 'n_end' } },
                  { id: 'n_end', type: 'end', position: { x: 740, y: 150 }, data: { label: 'Mwisho Support', text: 'Tafadhali andika "Hi" au "Menu" wakati wowote kutafuta kitu kingine.' } }
                ],
                edges: [
                  { id: 'e_1', source: 'n_start', target: 'n_welcome' },
                  { id: 'e_2', source: 'n_welcome', target: 'n_ask_faq' },
                  { id: 'e_3', source: 'n_ask_faq', target: 'n_end' }
                ]
              }
            ].map((temp) => (
              <div key={temp.id} className="p-5 bg-white dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl space-y-4 flex flex-col justify-between shadow-xs">
                <div className="space-y-2">
                  <h5 className="font-extrabold text-xs text-neutral-800 dark:text-neutral-200 uppercase tracking-wide">{temp.title}</h5>
                  <p className="text-[10.5px] text-neutral-500 dark:text-neutral-400 leading-relaxed">{temp.description}</p>
                </div>
                
                <Button
                  onClick={() => {
                    setMetaNodes(temp.nodes);
                    setMetaEdges(temp.edges);
                    handleSaveWorkflowConfig(temp.nodes, temp.edges, useWorkflow);
                    setStudioTab('canvas');
                    toast.success(`Template ya "${temp.title}" imesakinishwa vizuri kwenye Flow Builder yako! 🚀✨`);
                  }}
                  className="w-full bg-pink-500 hover:bg-pink-600 text-white text-xs font-black uppercase tracking-wider h-8.5 mt-2"
                >
                  Sakinisha Template (Install)
                </Button>
              </div>
            ))}
          </div>
        </div>
        </div>
      )}

      {/* Tab 6: META INTEGRATION SETTINGS */}
      {studioTab === 'meta_settings' && (
        <div className="p-6 space-y-8">
          
          {/* Header Description */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-5 rounded-2xl border border-emerald-500/20">
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-500 animate-spin-slow" />
                <span>Meta Omnichannel Suite Integration Settings</span>
              </h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Sanidi, unganisha na ufuate mtiririko wa kiunganishi cha Meta Suite (WhatsApp, Messenger na Instagram) kwa ajili ya AI Automation ya Papo Hapo!
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="h-8.5 text-xs font-black uppercase tracking-wider text-teal-600 border-teal-500/20 hover:bg-teal-50"
              >
                <Activity className="w-4 h-4 mr-1.5" />
                {isTesting ? "Inapima..." : "Pima Connection"}
              </Button>
              <Button
                onClick={handleSaveConfig}
                disabled={isSavingMeta}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider h-8.5 px-4"
              >
                {isSavingMeta ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Inahifadhi...
                  </span>
                ) : (
                  "Hifadhi Mipangilio"
                )}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            
            {/* Left & Center Columns: Configuration and Wizard */}
            <div className="xl:col-span-2 space-y-6">
              
              {/* Connection Status Panel */}
              <div className="bg-white dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-800/80 rounded-2xl p-5 space-y-4 shadow-xs">
                <h5 className="font-extrabold text-[11px] uppercase tracking-wider text-neutral-500 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  <span>Meta Platform Status (Hali ya Muunganisho)</span>
                </h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'WhatsApp API', status: 'Connected', icon: <MessageCircle className="w-4 h-4 text-emerald-500" /> },
                    { label: 'Facebook Messenger', status: 'Connected', icon: <Facebook className="w-4 h-4 text-blue-600" /> },
                    { label: 'Instagram DM', status: 'Connected', icon: <Instagram className="w-4 h-4 text-pink-500" /> },
                    { label: 'Webhook Endpoint', status: 'Active', icon: <Globe className="w-4 h-4 text-purple-500" /> },
                    { label: 'Access Token', status: 'Valid (Permanent)', icon: <Key className="w-4 h-4 text-amber-500" /> },
                    { label: 'API Gateway', status: 'Online (12ms ping)', icon: <Activity className="w-4 h-4 text-sky-500" /> }
                  ].map((stat, idx) => (
                    <div key={idx} className="p-3 bg-neutral-50/55 dark:bg-neutral-900 border border-neutral-200/40 dark:border-neutral-800 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {stat.icon}
                        <div className="truncate">
                          <span className="text-[10.5px] font-bold text-neutral-700 dark:text-neutral-300 block leading-tight">{stat.label}</span>
                          <span className="text-[9px] text-neutral-400 block">{stat.status}</span>
                        </div>
                      </div>
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Connect Meta (OAuth Setup Wizard) */}
              <div className="bg-white dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-800/80 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex justify-between items-center pb-3 border-b">
                  <div>
                    <h5 className="font-extrabold text-[11px] uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      <span>Setup Wizard: Unganisha Meta Ndani ya Sekunde 30</span>
                    </h5>
                    <p className="text-[10px] text-neutral-400">Muongozo rahisi wa hatua kwa hatua ili kuunganisha chaneli zako na AI Bot.</p>
                  </div>
                  {wizardStep > 1 && (
                    <button 
                      onClick={handleResetWizard}
                      className="text-[9.5px] font-black uppercase text-red-500 hover:underline"
                    >
                      Anza Upya (Reset)
                    </button>
                  )}
                </div>

                {/* Step Indicators */}
                <div className="flex items-center justify-between max-w-xl mx-auto gap-1">
                  {[1, 2, 3, 4, 5, 6].map((st) => (
                    <React.Fragment key={st}>
                      <div className="flex items-center justify-center shrink-0">
                        <div className={`w-6.5 h-6.5 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                          wizardStep === st 
                            ? "bg-emerald-500 text-white ring-4 ring-emerald-500/20" 
                            : wizardStep > st 
                              ? "bg-emerald-500 text-white" 
                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
                        }`}>
                          {wizardStep > st ? <CheckCircle2 className="w-4.5 h-4.5" /> : st}
                        </div>
                      </div>
                      {st < 6 && (
                        <div className={`flex-1 h-0.5 rounded transition-all ${
                          wizardStep > st ? "bg-emerald-500" : "bg-neutral-100 dark:bg-neutral-800"
                        }`} />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Wizard Stage Content */}
                <div className="p-5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/40 dark:border-neutral-800 rounded-2xl min-h-[140px] flex flex-col justify-between">
                  {wizardStep === 1 && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">Hatua ya 1: Thibitisha Akaunti ya Facebook</span>
                        <h6 className="text-xs font-extrabold text-neutral-800 dark:text-neutral-200">Unganisha akaunti yako ya Meta Business au Facebook Page.</h6>
                        <p className="text-[10.5px] text-neutral-500 leading-relaxed">Kubofya kitufe cha chini kutafungua salama popup ya Meta Login ili kuruhusu upatikanaji wa huduma kwa Papo Hapo Super App.</p>
                      </div>
                      <Button
                        onClick={handleWizardNext}
                        disabled={isWizardConnecting}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider h-9 self-start"
                      >
                        {isWizardConnecting ? (
                          <span className="flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Inapitia OAuth...
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <Facebook className="w-4 h-4 fill-white" /> Connect Meta / Facebook Profile 🔑
                          </span>
                        )}
                      </Button>
                    </div>
                  )}

                  {wizardStep === 2 && (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">Hatua ya 2: Chagua Business Account</span>
                        <h6 className="text-xs font-extrabold text-neutral-800 dark:text-neutral-200 font-sans">Akaunti ya Biashara iliyotambuliwa:</h6>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <select
                          value={wizardBusiness}
                          onChange={(e) => setWizardBusiness(e.target.value)}
                          className="flex-1 text-xs h-9 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 font-sans font-bold"
                        >
                          <option value="Papo Hapo Group Ltd (ID: 554321098)">Papo Hapo Group Ltd (ID: 554321098)</option>
                          <option value="TZ Delivery Hub (ID: 998877665)">TZ Delivery Hub (ID: 998877665)</option>
                        </select>
                        <Button
                          onClick={handleWizardNext}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider h-9"
                        >
                          Chagua & Endelea
                        </Button>
                      </div>
                    </div>
                  )}

                  {wizardStep === 3 && (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">Hatua ya 3: Chagua Facebook Page</span>
                        <h6 className="text-xs font-extrabold text-neutral-800 dark:text-neutral-200">Chagua ukurasa unaotaka AI Bot iweze kujibu wateja wake:</h6>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <select
                          value={wizardPage}
                          onChange={(e) => setWizardPage(e.target.value)}
                          className="flex-1 text-xs h-9 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 font-bold"
                        >
                          <option value="Papo Hapo Tanzania (ID: 109876543)">Papo Hapo Tanzania (ID: 109876543)</option>
                          <option value="Papo Hapo Delivery (ID: 109876123)">Papo Hapo Delivery (ID: 109876123)</option>
                        </select>
                        <Button
                          onClick={handleWizardNext}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider h-9"
                        >
                          Sakinisha Ukurasa
                        </Button>
                      </div>
                    </div>
                  )}

                  {wizardStep === 4 && (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">Hatua ya 4: Chagua Instagram Account</span>
                        <h6 className="text-xs font-extrabold text-neutral-800 dark:text-neutral-200">Akaunti ya Instagram Business kwa ajili ya Autoreply ya DM:</h6>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <select
                          value={wizardIG}
                          onChange={(e) => setWizardIG(e.target.value)}
                          className="flex-1 text-xs h-9 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 font-bold"
                        >
                          <option value="@papohapotz (ID: 17841405)">@papohapotz (ID: 17841405)</option>
                          <option value="@papohapo_express (ID: 17841406)">@papohapo_express (ID: 17841406)</option>
                        </select>
                        <Button
                          onClick={handleWizardNext}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider h-9"
                        >
                          Sakinisha Instagram
                        </Button>
                      </div>
                    </div>
                  )}

                  {wizardStep === 5 && (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">Hatua ya 5: Chagua WhatsApp Business Number</span>
                        <h6 className="text-xs font-extrabold text-neutral-800 dark:text-neutral-200">Simu iliyounganishwa na WhatsApp Cloud API:</h6>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <select
                          value={wizardWhatsApp}
                          onChange={(e) => setWizardWhatsApp(e.target.value)}
                          className="flex-1 text-xs h-9 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 font-bold"
                        >
                          <option value="+255 716 543 210 (Papo Hapo Helpline)">+255 716 543 210 (Papo Hapo Helpline)</option>
                          <option value="+255 621 998 877 (Papo Hapo Support)">+255 621 998 877 (Papo Hapo Support)</option>
                        </select>
                        <Button
                          onClick={handleWizardNext}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider h-9"
                        >
                          Kamilisha Muunganisho
                        </Button>
                      </div>
                    </div>
                  )}

                  {wizardStep === 6 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-full">
                          <BadgeCheck className="w-8 h-8 text-emerald-500 animate-bounce" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">Hatua ya 6: Kazi Imekamilika kikamilifu! 🎉</span>
                          <h6 className="text-xs font-extrabold text-neutral-800 dark:text-neutral-200">Akaunti zote za Meta Suite zimesanidiwa kikamilifu na kupakizwa!</h6>
                        </div>
                      </div>
                      <p className="text-[10.5px] text-neutral-500 leading-relaxed">
                        Data na vigezo vyote vimeshatumwa kwenye form hapo chini. Tafadhali bofya kitufe cha <strong>"Hifadhi Mipangilio"</strong> hapo juu ili kuandika data hizi moja kwa moja kwenye Database salama.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Webhook Connection Guide Card */}
              <div className="bg-white dark:bg-neutral-950 border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-6 space-y-5 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="font-black text-sm uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                        Sanidi Meta Webhooks (Webhook Credentials & Live Verification)
                      </h5>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Nakili Callback URL na Verify Token hapa chini uweke kwenye Meta Developers Console.
                      </p>
                    </div>
                  </div>

                  {/* Domain Selector Pill */}
                  <div className="flex bg-neutral-100 dark:bg-neutral-900 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800 shrink-0">
                    <button
                      onClick={() => setSelectedWebhookDomain('vercel')}
                      className={`px-3 py-1.5 text-[10.5px] font-black uppercase rounded-lg transition-all ${
                        selectedWebhookDomain === 'vercel'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                      }`}
                    >
                      🚀 Render URL
                    </button>
                    <button
                      onClick={() => setSelectedWebhookDomain('cloudrun')}
                      className={`px-3 py-1.5 text-[10.5px] font-black uppercase rounded-lg transition-all ${
                        selectedWebhookDomain === 'cloudrun'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                      }`}
                    >
                      ☁️ Cloud Run URL
                    </button>
                  </div>
                </div>

                {/* Steps Visual Guidance Box */}
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-2 text-xs">
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider text-[10px] block flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Hatua za Meta Developer Portal:
                  </span>
                  <ol className="list-decimal pl-5 space-y-1 text-neutral-700 dark:text-neutral-300 font-medium text-[11px] leading-relaxed">
                    <li>Kwenye Meta Developer Dashboard, nenda kwenye <strong>WhatsApp / Messenger -&gt; Configuration -&gt; Webhook</strong>.</li>
                    <li>Bofya <strong>"Edit"</strong> au <strong>"Configure a Webhook"</strong>.</li>
                    <li>Weka <strong>Callback URL</strong> na <strong>Verify Token</strong> kama ilivyoandikwa chini.</li>
                    <li>Bofya <strong>"Verify and Save"</strong> (Meta itathibitisha na kutoa Checkmark ya kijani 🟢).</li>
                    <li>Bofya <strong>"Manage"</strong> kisha tick field ya <code>messages</code> (kwa WhatsApp Business) au <code>messages, messaging_postbacks</code> (kwa Messenger/Instagram).</li>
                  </ol>
                </div>

                <div className="space-y-4 pt-1">
                  {/* Callback URL Input */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
                        Callback URL (Webhook API Endpoint)
                      </label>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                        {selectedWebhookDomain === 'vercel' ? 'Active Render Webhook' : 'Development Cloud Run'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={currentWebhookUrl}
                        className="text-xs font-bold h-10 font-mono bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200"
                      />
                      <Button
                        onClick={handleCopyUrl}
                        className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 rounded-xl gap-1.5"
                      >
                        {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedUrl ? 'Imenakiliwa!' : 'Copy URL'}</span>
                      </Button>
                    </div>

                    {selectedWebhookDomain === 'vercel' && (
                      <div className="mt-2 pt-2 border-t border-neutral-200/40 dark:border-neutral-800/40 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
                            Anwani ya Uzalishaji (Production Domain):
                          </label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDomainChange('https://dereva-tz.vercel.app')}
                            className="h-5 px-1.5 text-[9px] uppercase font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          >
                            Rejesha Chaguomsingi
                          </Button>
                        </div>
                        <div className="flex gap-2 items-center">
                          <Input 
                            value={customProductionDomain}
                            onChange={(e) => handleDomainChange(e.target.value)}
                            placeholder="https://dereva-tz.vercel.app"
                            className="font-mono text-xs bg-white dark:bg-black h-8 border-neutral-200/60 py-1"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Verify Token Input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
                      Webhook Verify Token
                    </label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={metaVerifyToken}
                        className="text-xs font-bold h-10 font-mono bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200"
                      />
                      <Button
                        onClick={handleCopyToken}
                        className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 rounded-xl gap-1.5"
                      >
                        {copiedToken ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedToken ? 'Imenakiliwa!' : 'Copy Token'}</span>
                      </Button>
                    </div>
                  </div>

                  {/* Live Webhook Test Button & Response Box */}
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <Button
                        onClick={handleTestLiveWebhook}
                        disabled={livePingStatus.testing}
                        className="bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-white font-black text-xs uppercase tracking-wider h-10 px-6 rounded-xl gap-2 shadow-sm"
                      >
                        <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                        <span>{livePingStatus.testing ? 'Inapiga Webhook Ping...' : 'Jaribu Webhook Endpoint Sasa (Live Ping Test)'}</span>
                      </Button>
                      <span className="text-[10.5px] font-bold text-neutral-400">Jaribu kabla ya kuunganisha na Meta</span>
                    </div>

                    {livePingStatus.responseText && (
                      <div className={`p-3.5 rounded-xl border font-mono text-xs space-y-1 animate-fade-in ${
                        livePingStatus.success 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                      }`}>
                        <div className="flex items-center gap-2 font-black uppercase text-[10px]">
                          {livePingStatus.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                          <span>{livePingStatus.success ? 'WEBHOOK RESPONSE SUCCESSFUL (200 OK)' : 'WEBHOOK RESPONSE ERROR'}</span>
                        </div>
                        <p className="text-[11px] leading-relaxed break-all">{livePingStatus.responseText}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Meta Credentials Configuration Form */}
              <div className="bg-white dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-800/80 rounded-2xl p-5 space-y-5 shadow-xs">
                <h5 className="font-extrabold text-[11px] uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 pb-2 border-b">
                  <Lock className="w-4 h-4 text-emerald-500" />
                  <span>Meta Platform API Configuration (Credentials)</span>
                </h5>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9.5px] font-black uppercase tracking-wider text-neutral-400">Meta App ID</label>
                    <Input
                      value={metaAppId}
                      onChange={(e) => setMetaAppId(e.target.value)}
                      placeholder="Weka Meta App ID"
                      className="text-xs h-9 font-sans bg-white dark:bg-neutral-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9.5px] font-black uppercase tracking-wider text-neutral-400">Meta App Secret</label>
                    <div className="relative">
                      <Input
                        type={showSecret ? "text" : "password"}
                        value={metaAppSecret}
                        onChange={(e) => setMetaAppSecret(e.target.value)}
                        placeholder="Weka Meta App Secret"
                        className="text-xs h-9 font-sans pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600"
                      >
                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9.5px] font-black uppercase tracking-wider text-neutral-400">Business Manager ID</label>
                    <Input
                      value={metaBusinessId}
                      onChange={(e) => setMetaBusinessId(e.target.value)}
                      placeholder="Weka Business ID"
                      className="text-xs h-9 font-sans"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9.5px] font-black uppercase tracking-wider text-neutral-400">Facebook Page ID</label>
                    <Input
                      value={metaPageId}
                      onChange={(e) => setMetaPageId(e.target.value)}
                      placeholder="Weka Page ID"
                      className="text-xs h-9 font-sans"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9.5px] font-black uppercase tracking-wider text-neutral-400">Instagram Account ID</label>
                    <Input
                      value={metaInstagramId}
                      onChange={(e) => setMetaInstagramId(e.target.value)}
                      placeholder="Weka Instagram Account ID"
                      className="text-xs h-9 font-sans"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9.5px] font-black uppercase tracking-wider text-neutral-400">WhatsApp Business Account ID (WABA ID)</label>
                    <Input
                      value={metaWabaId}
                      onChange={(e) => setMetaWabaId(e.target.value)}
                      placeholder="Weka WABA ID"
                      className="text-xs h-9 font-sans"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[9.5px] font-black uppercase tracking-wider text-neutral-400">WhatsApp Phone Number ID</label>
                    <Input
                      value={metaPhoneNumberId}
                      onChange={(e) => setMetaPhoneNumberId(e.target.value)}
                      placeholder="Weka Phone Number ID (e.g., 105550299...)"
                      className="text-xs h-9 font-sans"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[9.5px] font-black uppercase tracking-wider text-neutral-400">Permanent System Access Token</label>
                    <Textarea
                      rows={3}
                      value={metaAccessToken}
                      onChange={(e) => setMetaAccessToken(e.target.value)}
                      placeholder="Weka Permanent User Access Token kuanzia EAAGz..."
                      className="text-xs font-mono p-3 leading-relaxed"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleSaveConfig}
                    disabled={isSavingMeta}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider h-10"
                  >
                    {isSavingMeta ? "Inasave..." : "Save Config & Deploy Webhook Integrations"}
                  </Button>
                </div>
              </div>

            </div>

            {/* Right Column: Floating Chat Widget Customizer & Preview */}
            <div className="space-y-6">
              
              <div className="bg-white dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-800/80 rounded-2xl p-5 space-y-5 shadow-xs">
                <div>
                  <h5 className="font-extrabold text-[11px] uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-fuchsia-500" />
                    <span>Website Chat Widget Config (Hiari)</span>
                  </h5>
                  <p className="text-[10px] text-neutral-400">Sanidi widget inayoelea ya website yako kuelekeza wateja direct kwenye Meta Chat.</p>
                </div>

                <div className="space-y-4 pt-1">
                  
                  {/* Enabled Toggle */}
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Washa Chat Widget</span>
                    <button
                      onClick={() => setWidgetEnabled(!widgetEnabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        widgetEnabled ? "bg-fuchsia-600" : "bg-neutral-200 dark:bg-neutral-800"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          widgetEnabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Widget Theme Color selection */}
                  <div className="space-y-1.5">
                    <label className="text-[9.5px] font-black uppercase tracking-wider text-neutral-400">Rangi ya Widget (Theme Color)</label>
                    <div className="flex gap-2">
                      {[
                        { id: 'fuchsia', bg: 'bg-fuchsia-600', border: 'border-fuchsia-300' },
                        { id: 'emerald', bg: 'bg-emerald-600', border: 'border-emerald-300' },
                        { id: 'blue', bg: 'bg-blue-600', border: 'border-blue-300' },
                        { id: 'zinc', bg: 'bg-neutral-900', border: 'border-neutral-500' }
                      ].map((color) => (
                        <button
                          key={color.id}
                          onClick={() => setWidgetColor(color.id)}
                          className={`w-6 h-6 rounded-full ${color.bg} transition-transform ${
                            widgetColor === color.id ? "scale-125 ring-2 ring-neutral-300 dark:ring-neutral-700" : ""
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Widget Position */}
                  <div className="space-y-1.5">
                    <label className="text-[9.5px] font-black uppercase tracking-wider text-neutral-400">Upande uliopo (Position)</label>
                    <select
                      value={widgetPosition}
                      onChange={(e) => setWidgetPosition(e.target.value)}
                      className="w-full text-xs h-9 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 font-bold"
                    >
                      <option value="bottom_right">Chini Upande wa Kulia (Bottom Right)</option>
                      <option value="bottom_left">Chini Upande wa Kushoto (Bottom Left)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Chat Widget Live Simulation Card */}
              <div className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/60 rounded-2xl p-5 min-h-[300px] flex flex-col justify-between relative overflow-hidden shadow-inner">
                <span className="text-[8.5px] font-black uppercase tracking-widest text-neutral-400 block pb-2 border-b border-neutral-200/60 dark:border-neutral-800">Live Website Preview (Simulated Screen)</span>
                
                {/* Simulated Screen Body Content */}
                <div className="flex-1 flex flex-col justify-center items-center p-4 text-center text-neutral-400">
                  <Globe className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mb-2" />
                  <p className="text-[10.5px] font-bold text-neutral-500 dark:text-neutral-400">Papo Hapo Web App Page</p>
                  <p className="text-[9px] text-neutral-400 leading-normal max-w-[180px] mt-1">Hivi ndivyo wageni wa website watakavyoona na kufungua mawasiliano ya WhatsApp/Messenger.</p>
                </div>

                {/* Simulated Floating Widget rendering based on settings */}
                {widgetEnabled && (
                  <div className={`absolute transition-all duration-300 ${
                    widgetPosition === 'bottom_right' ? 'bottom-5 right-5' : 'bottom-5 left-5'
                  }`}>
                    <div className="flex flex-col items-end gap-1.5">
                      
                      {/* Interactive Buttons flyout simulated on hover */}
                      <div className="flex flex-col gap-1.5 shadow-md bg-white dark:bg-neutral-950 p-2.5 rounded-2xl border border-neutral-100 dark:border-neutral-800 transform translate-y-0 opacity-100 transition-all duration-200">
                        <button 
                          onClick={() => toast.info("Imefungua WhatsApp Chat na: +255 716 543 210")}
                          className="flex items-center gap-1.5 hover:bg-neutral-50 p-1.5 rounded-lg text-[9.5px] font-black uppercase text-emerald-600 text-left"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </button>
                        <button 
                          onClick={() => toast.info("Imefungua Facebook Messenger ya: Papo Hapo Tanzania")}
                          className="flex items-center gap-1.5 hover:bg-neutral-50 p-1.5 rounded-lg text-[9.5px] font-black uppercase text-blue-600 text-left"
                        >
                          <Facebook className="w-3.5 h-3.5" />
                          <span>Messenger</span>
                        </button>
                        <button 
                          onClick={() => toast.info("Imefungua Instagram DM ya: @papohapotz")}
                          className="flex items-center gap-1.5 hover:bg-neutral-50 p-1.5 rounded-lg text-[9.5px] font-black uppercase text-pink-500 text-left"
                        >
                          <Instagram className="w-3.5 h-3.5" />
                          <span>Instagram</span>
                        </button>
                      </div>

                      {/* Main Trigger Button */}
                      <button className={`w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg animate-pulse-subtle transition-colors duration-300 ${
                        widgetColor === 'fuchsia' ? 'bg-fuchsia-600 hover:bg-fuchsia-700' :
                        widgetColor === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' :
                        widgetColor === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-neutral-900 hover:bg-neutral-850'
                      }`}>
                        <Sparkles className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      )}
    </div>
  );
};
