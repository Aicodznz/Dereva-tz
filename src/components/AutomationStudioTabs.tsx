import React from 'react';
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
  Zap
} from 'lucide-react';

interface AutomationStudioTabsProps {
  studioTab: 'canvas' | 'kb' | 'crm' | 'broadcast' | 'templates';
  setStudioTab: (tab: 'canvas' | 'kb' | 'crm' | 'broadcast' | 'templates') => void;
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
  useWorkflow
}) => {
  return (
    <div className="space-y-0">
      {/* V4.0 Studio Sub-Tabs Navigation */}
      <div className="flex border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 overflow-x-auto scrollbar-none">
        {[
          { id: 'canvas', label: 'Flow Builder', icon: <Zap className="w-4 h-4 text-fuchsia-500 fill-fuchsia-500/20" /> },
          { id: 'kb', label: 'AI Knowledge Base', icon: <Brain className="w-4 h-4 text-purple-500" /> },
          { id: 'broadcast', label: 'Broadcast Campaign', icon: <Send className="w-4 h-4 text-blue-500" /> },
          { id: 'crm', label: 'CRM & Sessions', icon: <User className="w-4 h-4 text-emerald-500" /> },
          { id: 'templates', label: 'Templates Marketplace', icon: <ShoppingBag className="w-4 h-4 text-pink-500" /> }
        ].map((tab) => {
          const active = studioTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setStudioTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all duration-200 shrink-0 ${
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
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-start gap-4">
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
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold uppercase tracking-wider shadow-sm shrink-0 px-4 py-2"
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

      {/* Tab 5: TEMPLATES MARKETPLACE */}
      {studioTab === 'templates' && (
        <div className="p-6 space-y-6">
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
              <ShoppingBag className="w-4.5 h-4.5 text-pink-500" />
              <span>Papo Hapo Automation Templates Marketplace (V4.0)</span>
            </h4>
            <p className="text-xs text-neutral-500 mt-1">
              Sakinisha (Install) mtiririko uliokamilika tayari uliotengenezwa mahususi kwa huduma tofauti za Papo Hapo Super App kwa sekunde moja tu!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
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
      )}
    </div>
  );
};
