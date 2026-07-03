import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Smartphone, 
  Send, 
  Copy, 
  Check, 
  HelpCircle, 
  Wifi, 
  Battery, 
  Settings, 
  Globe, 
  MessageSquare,
  Shield, 
  User, 
  Zap,
  Play,
  ArrowRight,
  RefreshCw,
  Heart,
  Instagram,
  Facebook,
  MessageCircle,
  Trash,
  Plus,
  Edit,
  Brain,
  GitBranch,
  ShoppingBag,
  CreditCard,
  StopCircle,
  Trash2,
  PlusCircle,
  LayoutGrid,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Sparkles } from 'lucide-react';
import { AutomationStudioTabs } from './AutomationStudioTabs';
import { handleMetaInput } from '../lib/metaBot';
import { handleSMSInput } from '../lib/smsBot';

interface Message {
  sender: 'customer' | 'bot';
  text: string;
  timestamp: string;
}

export function getInitialNodes() {
  return [
    {
      id: 'n_start',
      type: 'start',
      position: { x: 40, y: 160 },
      data: { label: 'Start (Mwanzo)', nextNodeId: 'n_ai_intent' }
    },
    {
      id: 'n_ai_intent',
      type: 'ai_decision',
      position: { x: 200, y: 160 },
      data: { 
        label: 'AI Intent Classifier (Gemini)', 
        nextNodeId: 'n_welcome',
        intentMappings: [
          { keywords: 'taxi, boda, bajaji, gari, ride, usafiri', nextNodeId: 'n_taxi_welcome' },
          { keywords: 'chakula, chips, burger, biryani, pizza, kula', nextNodeId: 'n_food_welcome' },
          { keywords: 'msaada, masaa, ofisi, namba, simu, maswali', nextNodeId: 'n_support' }
        ] 
      }
    },
    {
      id: 'n_welcome',
      type: 'message',
      position: { x: 420, y: 30 },
      data: { 
        label: 'Msaada wa Kawaida (Default Menu)', 
        text: '👋 *Karibu Papo Hapo Super App Bot!*\n\nAndika *Taxi* kuanza booking ya usafiri, au andika *Chakula* ili kupata menyu ya leo! Unaweza kutafuta msaada kwa kusema *Saa za kazi*.', 
        nextNodeId: 'n_end' 
      }
    },
    {
      id: 'n_support',
      type: 'message',
      position: { x: 420, y: 150 },
      data: { 
        label: 'Maelezo ya Ofisi & Saa za kazi', 
        text: '⏰ *Masaa ya kazi:* Masaa 24 kila siku!\n📍 *Ofisi zetu:* Mwenge Tower, Ghorofa ya 3, Dar es Salaam.\n☎️ *Namba ya Simu:* +255 716 543 210', 
        nextNodeId: 'n_end' 
      }
    },
    {
      id: 'n_taxi_welcome',
      type: 'message',
      position: { x: 420, y: 280 },
      data: { 
        label: 'Ujumbe wa Karibu - Taxi', 
        text: '🚖 *Karibu kwenye Huduma ya Taxi Papo Hapo!*\n\nTunaanza booking yako sasa hivi. Tutatumia AI kupanga usafiri wako.', 
        nextNodeId: 'n_ask_pickup' 
      }
    },
    {
      id: 'n_ask_pickup',
      type: 'question',
      position: { x: 620, y: 280 },
      data: { 
        label: 'Kuuliza Mahali pa Kuchukuliwa', 
        text: '📍 *Upo wapi kwa sasa hivi?* \n(Tafadhali andika mahali ulipo, mfano: Mwenge, Posta, Kimara)', 
        variableName: 'pickup', 
        nextNodeId: 'n_ask_dest' 
      }
    },
    {
      id: 'n_ask_dest',
      type: 'question',
      position: { x: 820, y: 280 },
      data: { 
        label: 'Kuuliza Mahali pa Kwenda', 
        text: '🏁 *Unakwenda wapi?* \n(Andika eneo unaloenda, mfano: Posta, Kariakoo, Masaki)', 
        variableName: 'destination', 
        nextNodeId: 'n_create_ride' 
      }
    },
    {
      id: 'n_create_ride',
      type: 'create_order',
      position: { x: 1020, y: 280 },
      data: { 
        label: 'Unda Order ya Taxi Kwenye DB', 
        serviceType: 'taxi', 
        nextNodeId: 'n_end' 
      }
    },
    {
      id: 'n_food_welcome',
      type: 'message',
      position: { x: 420, y: 410 },
      data: { 
        label: 'Karibu Food Ordering', 
        text: '🍔 *Karibu kwenye Huduma ya Chakula ya Papo Hapo!*\n\nTunaandaa agizo lako la chips kuku, biryani, au pizza hivi sasa.', 
        nextNodeId: 'n_ask_food_detail' 
      }
    },
    {
      id: 'n_ask_food_detail',
      type: 'question',
      position: { x: 620, y: 410 },
      data: { 
        label: 'Ask Food Details', 
        text: '🍔 *Ungependa kuagiza chakula gani leo?* \n(Andika chakula na idadi, mfano: Chips Kuku 1)', 
        variableName: 'pickup', 
        nextNodeId: 'n_ask_food_dest' 
      }
    },
    {
      id: 'n_ask_food_dest',
      type: 'question',
      position: { x: 820, y: 410 },
      data: { 
        label: 'Ask Delivery Address', 
        text: '📍 *Tulete chakula hiki eneo gani?* \n(Andika anuani ya kuwasilisha, mfano: Mwenge)', 
        variableName: 'destination', 
        nextNodeId: 'n_create_food_order' 
      }
    },
    {
      id: 'n_create_food_order',
      type: 'create_order',
      position: { x: 1020, y: 410 },
      data: { 
        label: 'Unda Order ya Food Kwenye DB', 
        serviceType: 'food', 
        nextNodeId: 'n_end' 
      }
    },
    {
      id: 'n_end',
      type: 'end',
      position: { x: 1240, y: 200 },
      data: { 
        label: 'Mwisho wa Soga (End)', 
        text: '🎉 *Huduma yako ya Papo Hapo imeandaliwa kikamilifu!*\n\n- ID ya Mteja: *{{customer.phone}}*\n- Mtandao: *{{channel}}*\n\nNenda kwenye tab ya Orders kufuatilia maendeleo ya safari au chakula chako! Asante kwa kutumia Papo Hapo! 🇹🇿' 
      }
    }
  ];
}

interface TwilioResponderTabProps {
  vendorId: string;
  vendorCategory: string;
}

export const TwilioResponderTab: React.FC<TwilioResponderTabProps> = ({ vendorId, vendorCategory }) => {
  const [activeTab, setActiveTab] = useState<'meta' | 'twilio'>('meta');
  
  // Twilio States
  const [copied, setCopied] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [welcomeText, setWelcomeText] = useState(
    "Karibu kwenye Mfumo wa Huduma za Papo Hapo! 🌟\n\nTafadhali chagua huduma unayotaka kwa kutuma namba yake:\n1. 🚕 TAXI\n2. 💇‍♀️ SALUNI (Salons)\n3. 🚌 MABASI (Bus Tickets)\n4. 🥗 CHAKULA (Restaurants)\n5. 🥦 SOKO (Groceries)\n6. 💊 PHARMACY"
  );
  const [testPhoneNumber, setTestPhoneNumber] = useState('+255712345678');
  const [inputText, setInputText] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: "Mambo! Karibu kwenye majaribio ya SMS Auto-Responder. Tuma meseji yoyote au bonyeza moja ya njia za shortcuts chini kuanza!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Meta Omnichannel States
  const [metaChannel, setMetaChannel] = useState<'whatsapp' | 'messenger' | 'instagram'>('whatsapp');
  const [metaSenderId, setMetaSenderId] = useState('+255716543210');
  const [metaInputText, setMetaInputText] = useState('');
  const [metaChatMessages, setMetaChatMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: "👋 Karibu Papo Hapo AI Assistant!\n\nMimi ni Chatbot wako mwenye uwezo wa AI. Unaweza kuandika ombi lako kwa Kiswahili au Sheng rahisi (mfano: \"Nahitaji taxi Mwenge kwenda Posta\", \"Kuna chips kuku?\", \"Nahitaji kukata tiketi ya basi\", au \"Naomba kinyozi leo\").\n\nNami nitagundua (Intent detection) na kukuletea orodha ya huduma punde! ✨",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [metaHistory, setMetaHistory] = useState<any[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [copiedMetaWebhook, setCopiedMetaWebhook] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<'all' | 'studio' | 'phone'>('all');
  const [selectedWebhookDomain, setSelectedWebhookDomain] = useState<'vercel' | 'cloudrun'>('vercel');
  const [livePingStatus, setLivePingStatus] = useState<{ testing: boolean; success: boolean | null; responseText: string | null }>({
    testing: false,
    success: null,
    responseText: null
  });

  const vercelWebhookUrl = "https://dereva-tz.vercel.app/api/meta/webhook";
  const cloudRunWebhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/meta/webhook` : vercelWebhookUrl;
  const activeWebhookUrl = selectedWebhookDomain === 'vercel' ? vercelWebhookUrl : cloudRunWebhookUrl;

  const handleCopyMetaWebhook = () => {
    navigator.clipboard.writeText(activeWebhookUrl);
    setCopiedMetaWebhook(true);
    toast.success(`Meta Webhook URL (${selectedWebhookDomain.toUpperCase()}) imenakiliwa!`);
    setTimeout(() => setCopiedMetaWebhook(false), 2000);
  };

  const handleTestLiveWebhook = async () => {
    setLivePingStatus({ testing: true, success: null, responseText: null });
    toast.loading("Inajaribu kupiga Meta Webhook endpoint...");
    try {
      const challenge = "papohapo_test_challenge_123";
      const testUrl = `${activeWebhookUrl}?hub.mode=subscribe&hub.challenge=${challenge}&hub.verify_token=papo_hapo_meta_secure_token_2026`;
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
      toast.error(`Network Error: ${err.message}`);
    }
  };

  // Meta Flow states
  const [metaWelcomeText, setMetaWelcomeText] = useState('');
  const [metaTriggers, setMetaTriggers] = useState<any[]>([]);
  const [newTriggerTitle, setNewTriggerTitle] = useState('');
  const [newTriggerKeywords, setNewTriggerKeywords] = useState('');
  const [newTriggerResponse, setNewTriggerResponse] = useState('');
  const [editingTriggerId, setEditingTriggerId] = useState<string | null>(null);

  // Papo Hapo Automation Studio (Visual Workflow V4.0) States
  const [useWorkflow, setUseWorkflow] = useState(true);
  const [metaNodes, setMetaNodes] = useState<any[]>([]);
  const [metaEdges, setMetaEdges] = useState<any[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeWorkflowNodeId, setActiveWorkflowNodeId] = useState<string | null>(null);
  const [simulatedVariables, setSimulatedVariables] = useState<Record<string, string>>({});
  
  // Canvas View Zoom, Pan and Fullscreen States
  const [canvasScale, setCanvasScale] = useState(0.8);
  const [isExpandedCanvas, setIsExpandedCanvas] = useState(false);

  const handleFitView = () => {
    if (!metaNodes || metaNodes.length === 0) return;
    const canvasElement = document.getElementById('studio-canvas');
    if (!canvasElement) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    metaNodes.forEach(node => {
      const x = node.position?.x || 0;
      const y = node.position?.y || 0;
      if (x < minX) minX = x;
      if (x + 220 > maxX) maxX = x + 220;
      if (y < minY) minY = y;
      if (y + 160 > maxY) maxY = y + 160;
    });

    const flowWidth = Math.max(400, maxX - minX + 120);
    const flowHeight = Math.max(300, maxY - minY + 120);

    const containerWidth = canvasElement.clientWidth || 800;
    const containerHeight = canvasElement.clientHeight || 500;

    const scaleX = containerWidth / flowWidth;
    const scaleY = containerHeight / flowHeight;
    let optimalScale = Math.min(scaleX, scaleY);
    optimalScale = Math.max(0.35, Math.min(1.0, optimalScale));

    setCanvasScale(optimalScale);

    setTimeout(() => {
      if (canvasElement) {
        canvasElement.scrollLeft = Math.max(0, (minX * optimalScale) - 20);
        canvasElement.scrollTop = Math.max(0, (minY * optimalScale) - 20);
      }
    }, 50);

    toast.info(`View ya Flow imewekwa sawa (${Math.round(optimalScale * 100)}%)! 🎯`);
  };

  const [studioTab, setStudioTab] = useState<'canvas' | 'kb' | 'crm' | 'broadcast' | 'templates' | 'meta_settings'>('canvas');
  
  // Meta Configuration Integration states
  const [metaAppId, setMetaAppId] = useState('9810319892103');
  const [metaAppSecret, setMetaAppSecret] = useState('••••••••••••••••••••••••••••••••');
  const [metaBusinessId, setMetaBusinessId] = useState('5543210987654');
  const [metaPageId, setMetaPageId] = useState('1098765432109');
  const [metaInstagramId, setMetaInstagramId] = useState('178414053210987');
  const [metaWabaId, setMetaWabaId] = useState('33210987654321');
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('15550109988');
  const [metaAccessToken, setMetaAccessToken] = useState('EAAGzDkZAbgBAKBZBv2YBAZB8CZA9pP6ZA2lZB38vXb1vCq8aZB6eZByvZA19...');
  const [metaVerifyToken, setMetaVerifyToken] = useState('papo_hapo_meta_secure_token_2026');

  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [generatingFlow, setGeneratingFlow] = useState(false);
  const [knowledgeBaseText, setKnowledgeBaseText] = useState(
    "1. Delivery ni kuanzia saa 2:00 asubuhi hadi saa 4:00 usiku (8:00 AM - 10:00 PM).\n" +
    "2. Ofisi zetu kuu za Papo Hapo zipo Mwenge, Dar es Salaam karibu na TRA.\n" +
    "3. Gharama ya chini ya usafiri kwa Taxi ni TSH 3,000, na pikipiki/boda ni TSH 1,500.\n" +
    "4. Malipo yote yanafanyika kwa usalama kupitia M-Pesa, Tigo Pesa na Airtel Money.\n" +
    "5. Huduma ya chakula (Food Delivery) inahusisha migahawa yote maarufu kama Burger Point, Papo Kitchen na KFC."
  );
  const [broadcastAudience, setBroadcastAudience] = useState<'all' | 'drivers' | 'vendors'>('all');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastChannel, setBroadcastChannel] = useState<'whatsapp' | 'messenger' | 'instagram'>('whatsapp');
  const [broadcastLogs, setBroadcastLogs] = useState<any[]>([
    { id: 'b1', message: "Habari! Sasa unaweza kujipatia TSH 5,000 bure ukialika dereva mpya kujiunga na Papo Hapo Leo!", audience: "Madereva wote", channel: "whatsapp", sentCount: 142, date: "Leo, 11:20 AM" },
    { id: 'b2', message: "Kuna punguzo la 20% kwa oda yako ya chakula leo asubuhi! Tumia kodi: PAPO20 kula sasa.", audience: "Wateja wote", channel: "messenger", sentCount: 450, date: "Jana, 09:15 AM" }
  ]);

  const drawLink = (fromId: string, toId: string, color = "#d946ef", label?: string) => {
    const fromNode = metaNodes.find(n => n.id === fromId);
    const toNode = metaNodes.find(n => n.id === toId);
    if (!fromNode || !toNode) return null;

    const fromX = fromNode.position.x + 95;
    const fromY = fromNode.position.y + 60;
    const toX = toNode.position.x + 95;
    const toY = toNode.position.y;

    const dx = Math.abs(toX - fromX) * 0.3;
    const dy = Math.abs(toY - fromY) * 0.3;
    const p1x = fromX;
    const p1y = fromY + dy;
    const p2x = toX;
    const p2y = toY - dy;

    const pathD = `M ${fromX} ${fromY} C ${p1x} ${p1y}, ${p2x} ${p2y}, ${toX} ${toY}`;

    return (
      <g key={`${fromId}-${toId}-${label || 'default'}`}>
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          markerEnd="url(#arrow)"
          className="transition-all duration-300 hover:stroke-fuchsia-600"
          strokeDasharray={label ? "4,4" : "none"}
        />
        {label && (
          <g>
            <rect
              x={((fromX + toX) / 2) - 30}
              y={((fromY + toY) / 2) - 8}
              width="60"
              height="14"
              rx="4"
              fill="white"
              stroke="#e5e7eb"
              strokeWidth="1"
              className="dark:fill-neutral-900 dark:stroke-neutral-800"
            />
            <text
              x={(fromX + toX) / 2}
              y={((fromY + toY) / 2) + 2}
              fill={color}
              className="text-[8px] font-black font-mono tracking-wider fill-purple-600 dark:fill-purple-400"
              textAnchor="middle"
            >
              {label}
            </text>
          </g>
        )}
      </g>
    );
  };

  // Fetch Meta Chat History
  const fetchMetaHistory = async () => {
    try {
      const response = await fetch('/api/meta/history');
      if (response.ok) {
        const data = await response.json();
        if (data.chats) {
          setMetaHistory(data.chats);
        }
      }
    } catch (err) {
      console.warn("Could not load Meta History logs:", err);
    }
  };

  // Load custom saved configs if any
  useEffect(() => {
    const fetchSMSConfig = async () => {
      try {
        const docRef = doc(db, 'vendors', vendorId, 'settings', 'sms_config');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.welcomeText) setWelcomeText(data.welcomeText);
          if (data.isEnabled !== undefined) setIsEnabled(data.isEnabled);
        }
      } catch (err) {
        console.warn("Could not load vendor specific SMS config:", err);
      }
    };

    const fetchMetaConfig = async () => {
      try {
        const docRef = doc(db, 'vendors', vendorId, 'settings', 'meta_config');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.welcomeMessage) setMetaWelcomeText(data.welcomeMessage);
          if (data.triggers) setMetaTriggers(data.triggers);
          if (data.useWorkflow !== undefined) setUseWorkflow(data.useWorkflow);
          if (data.nodes && data.nodes.length > 0) {
            setMetaNodes(data.nodes);
          } else {
            setMetaNodes(getInitialNodes());
          }
          if (data.edges) setMetaEdges(data.edges);
          if (data.knowledgeBase) setKnowledgeBaseText(data.knowledgeBase);
          if (data.metaAppId) setMetaAppId(data.metaAppId);
          if (data.metaAppSecret) setMetaAppSecret(data.metaAppSecret);
          if (data.metaBusinessId) setMetaBusinessId(data.metaBusinessId);
          if (data.metaPageId) setMetaPageId(data.metaPageId);
          if (data.metaInstagramId) setMetaInstagramId(data.metaInstagramId);
          if (data.metaWabaId) setMetaWabaId(data.metaWabaId);
          if (data.metaPhoneNumberId) setMetaPhoneNumberId(data.metaPhoneNumberId);
          if (data.metaAccessToken) setMetaAccessToken(data.metaAccessToken);
          if (data.metaVerifyToken) setMetaVerifyToken(data.metaVerifyToken);
        } else {
          // Default fallbacks for simulator showcase
          setMetaWelcomeText(
            `👋 *Karibu Papo Hapo Super App Bot!* ({channel})\n\n` +
            `Mimi ni Assistant wako wa Papo Hapo. Unaweza kupata na kuagiza huduma zote kwa haraka kupitia hapa!\n\n` +
            `*Tafadhali chagua au andika unachotaka:* \n` +
            `🚖 *1. TAXI* (Agiza boda, bajaji au gari)\n` +
            `🍔 *2. CHAKULA* (Chips, Pizza, Burger, Biryani)\n` +
            `🛍️ *3. SOKONI* (Groceries, Nyanya, Vitunguu, Mchele)\n` +
            `📦 *4. PARCEL* (Tuma au wasilisha mzigo haraka)\n` +
            `💇‍♀️ *5. SALUNI* (Hair cut, Nails, Spa, Makeup)\n` +
            `🏨 *6. HOTELI* (Weka vyumba vya hoteli karibu nawe)\n` +
            `🚗 *7. KODI GARI* (Kodisha Prado, Cruiser, Harrier)\n` +
            `💊 *8. PHARMACY* (Agiza Dawa na vifaa vya afya)\n` +
            `🚌 *9. MABASI* (Kata tiketi za mabasi ya mikoani)\n\n` +
            `*Andika namba au taja unachohitaji moja kwa moja! (Mfano: "Naomba taxi kwenda Posta")* ✨`
          );
          setMetaTriggers([
            { id: 't1', title: 'Bei za Usafiri / Rates', keywords: 'bei, kiasi, bei gani, rates', response: '🚕 *Papo Hapo Rates:* \n\n*1. Boda Boda:* Kuanzia TSH 1,000 tu!\n*2. Bajaji:* Kuanzia TSH 2,500!\n*3. Taxi Ndogo (Passo):* Kuanzia TSH 4,000!\n\nAndika *Menu* au *Hi* kurudi mwanzo.' },
            { id: 't2', title: 'Masaa ya Kazi', keywords: 'masaa, saa, muda, masaa ya kazi, operating hours', response: '⏰ *Masaa ya Kazi ya Papo Hapo:* \n\nHuduma zetu za madereva na booking hufanya kazi masaa 24! Ofisi zetu na duka la huduma hufunguliwa kuanzia saa 2:00 Asubuhi hadi saa 4:00 Usiku kila siku.\n\nTupo hapa kukuhudumia! ✨' },
            { id: 't3', title: 'Wasiliana Nasi', keywords: 'wasiliana, namba, simu, contact, ofisi, mahali', response: '📞 *Mawasiliano na Ofisi zetu:* \n\n📍 Ofisi kuu: Mwenge Tower, Ghorofa ya 3, Dar es Salaam.\n☎️ Simu: *+255 716 543 210*\n📧 Barua Pepe: *support@papohapo.co.tz*\n\nKaribu ofisini au piga simu sasa! 😊' }
          ]);
          setMetaNodes(getInitialNodes());
        }
      } catch (err) {
        console.warn("Could not load vendor specific Meta config:", err);
        setMetaNodes(getInitialNodes());
      }
    };

    fetchSMSConfig();
    fetchMetaConfig();
    fetchMetaHistory();
    
    // Poll for live chats every 8 seconds so the admin dashboard is truly live!
    const interval = setInterval(fetchMetaHistory, 8000);
    return () => clearInterval(interval);
  }, [vendorId]);

  // Scroll to bottom of simulator chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleCopyWebhook = () => {
    const webhookUrl = `${window.location.origin}/api/twilio/sms`;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("Webhook URL copied successfully!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveSettings = async () => {
    try {
      const docRef = doc(db, 'vendors', vendorId, 'settings', 'sms_config');
      await setDoc(docRef, {
        welcomeText,
        isEnabled,
        updatedAt: new Date()
      }, { merge: true });
      toast.success("Mipangilio imehifadhiwa vizuri!");
    } catch (err: any) {
      toast.error("Imeshindwa kuhifadhi: " + err.message);
    }
  };

  const handleSaveMetaConfig = async (updatedTriggers?: any[]) => {
    try {
      const docRef = doc(db, 'vendors', vendorId, 'settings', 'meta_config');
      await setDoc(docRef, {
        welcomeMessage: metaWelcomeText,
        triggers: updatedTriggers || metaTriggers,
        updatedAt: new Date()
      }, { merge: true });
      toast.success("Chat Flow ya Meta imehifadhiwa vizuri!");
    } catch (err: any) {
      toast.error("Imeshindwa kuhifadhi Meta Config: " + err.message);
    }
  };

  const handleSaveFullMetaIntegration = async () => {
    try {
      const docRef = doc(db, 'vendors', vendorId, 'settings', 'meta_config');
      await setDoc(docRef, {
        metaAppId,
        metaAppSecret,
        metaBusinessId,
        metaPageId,
        metaInstagramId,
        metaWabaId,
        metaPhoneNumberId,
        metaAccessToken,
        metaVerifyToken,
        updatedAt: new Date()
      }, { merge: true });
      toast.success("Muunganisho wote wa Meta na Webhooks umehifadhiwa kikamilifu kwenye Database! 🟢💾");
    } catch (err: any) {
      toast.error("Imeshindwa kuhifadhi muunganisho wa Meta: " + err.message);
    }
  };

  const handleAddTrigger = () => {
    if (!newTriggerTitle.trim() || !newTriggerKeywords.trim() || !newTriggerResponse.trim()) {
      toast.error("Tafadhali jaza nafasi zote za Chat Flow Trigger!");
      return;
    }
    
    const newTrigger = {
      id: editingTriggerId || 't_' + Date.now(),
      title: newTriggerTitle,
      keywords: newTriggerKeywords,
      response: newTriggerResponse
    };
    
    let updated: any[] = [];
    if (editingTriggerId) {
      updated = metaTriggers.map(t => t.id === editingTriggerId ? newTrigger : t);
      setEditingTriggerId(null);
      toast.success("Trigger imebadilishwa kikamilifu!");
    } else {
      updated = [...metaTriggers, newTrigger];
      toast.success("Trigger mpya imeongezwa vizuri!");
    }
    
    setMetaTriggers(updated);
    setNewTriggerTitle('');
    setNewTriggerKeywords('');
    setNewTriggerResponse('');
    
    handleSaveMetaConfig(updated);
  };

  const handleEditTrigger = (t: any) => {
    setEditingTriggerId(t.id);
    setNewTriggerTitle(t.title);
    setNewTriggerKeywords(t.keywords);
    setNewTriggerResponse(t.response);
  };

  const handleDeleteTrigger = (id: string) => {
    const updated = metaTriggers.filter(t => t.id !== id);
    setMetaTriggers(updated);
    toast.success("Trigger imefutwa!");
    handleSaveMetaConfig(updated);
  };

  const sendSimulatedMessage = async (text: string) => {
    if (!text.trim()) return;

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Add User message
    const userMsg: Message = { sender: 'customer', text, timestamp: timeString };
    setChatMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setInputText('');

    try {
      let replyText = "";
      try {
        const response = await fetch('/api/twilio/simulate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phone: testPhoneNumber,
            message: text
          })
        });

        if (response.ok) {
          const data = await response.json();
          replyText = data.reply;
        }
      } catch (err) {
        console.warn("Server twilio simulate API not reached, using local fallback:", err);
      }

      if (!replyText) {
        replyText = await handleSMSInput(testPhoneNumber, text, null);
      }

      const botMsg: Message = {
        sender: 'bot',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, botMsg]);

    } catch (err: any) {
      toast.error("Hitilafu kwenye simulator: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    setChatMessages([
      {
        sender: 'bot',
        text: "Karibu! Majaribio yamefanywa mapya. Tuma 'HI' au bonyeza kuanza.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    toast.success("Majaribio yameanza upya!");
  };

  const syncSimulatedSessionState = async () => {
    try {
      const sessionKey = `${metaChannel}:${metaSenderId}`;
      const docRef = doc(db, 'meta_sessions', sessionKey);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.currentNodeId) {
          setActiveWorkflowNodeId(data.currentNodeId);
        } else {
          setActiveWorkflowNodeId(null);
        }
        if (data.variables) {
          setSimulatedVariables(data.variables);
        } else {
          setSimulatedVariables({});
        }
      } else {
        setActiveWorkflowNodeId(null);
        setSimulatedVariables({});
      }
    } catch (err) {
      console.warn("Could not sync simulated session state:", err);
    }
  };

  useEffect(() => {
    if (useWorkflow) {
      syncSimulatedSessionState();
    }
  }, [metaChannel, metaSenderId, useWorkflow]);

  const handleNodeDragStart = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    const node = metaNodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const canvasElement = document.getElementById('studio-canvas');
      if (!canvasElement) return;
      const canvasRect = canvasElement.getBoundingClientRect();
      
      const x = Math.max(10, Math.min(2800, (moveEvent.clientX - canvasRect.left - offsetX) / canvasScale + canvasElement.scrollLeft / canvasScale));
      const y = Math.max(10, Math.min(2000, (moveEvent.clientY - canvasRect.top - offsetY) / canvasScale + canvasElement.scrollTop / canvasScale));
      
      setMetaNodes(prev => prev.map(n => n.id === nodeId ? { ...n, position: { x, y } } : n));
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setMetaNodes(current => {
        handleSaveWorkflowConfig(current, metaEdges, useWorkflow);
        return current;
      });
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleSaveWorkflowConfig = async (nodesToSave = metaNodes, edgesToSave = metaEdges, workflowActive = useWorkflow, kbText = knowledgeBaseText) => {
    try {
      const docRef = doc(db, 'vendors', vendorId, 'settings', 'meta_config');
      await setDoc(docRef, {
        welcomeMessage: metaWelcomeText,
        triggers: metaTriggers,
        useWorkflow: workflowActive,
        nodes: nodesToSave,
        edges: edgesToSave,
        knowledgeBase: kbText,
        updatedAt: new Date()
      }, { merge: true });
    } catch (err: any) {
      console.warn("Could not persist flowchart configuration in Firestore:", err);
    }
  };

  const handleAddNode = (type: string) => {
    const id = 'n_' + Date.now();
    let data: any = { label: `Node ${type.toUpperCase()}` };
    
    if (type === 'message') {
      data = { label: 'Tuma Ujumbe Mpya', text: 'Andika ujumbe wako hapa...', nextNodeId: 'n_end' };
    } else if (type === 'question') {
      data = { label: 'Uliza Swali Mpya', text: 'Tafadhali andika swali hapa:', variableName: 'jibu_mteja', nextNodeId: 'n_end' };
    } else if (type === 'ai_decision') {
      data = { label: 'AI Intent Classifier', nextNodeId: 'n_welcome', intentMappings: [{ keywords: 'taxi', nextNodeId: 'n_end' }] };
    } else if (type === 'condition') {
      data = { label: 'Condition Node', variable: 'pickup', operator: 'equals', value: 'Mwenge', nextNodeId: 'n_end' };
    } else if (type === 'payment') {
      data = { label: 'Lipisha Malipo (Payment)', amount: 3000, nextNodeId: 'n_end' };
    } else if (type === 'create_order') {
      data = { label: 'Unda Order ya Papo Hapo', serviceType: 'taxi', nextNodeId: 'n_end' };
    } else if (type === 'ocr') {
      data = { label: 'AI OCR Reader', variableName: 'ocr_text', nextNodeId: 'n_end' };
    } else if (type === 'voice_bot') {
      data = { label: 'Voice Bot Assistant', prompt: 'Soma audio ya Kiswahili na ujibu', nextNodeId: 'n_end' };
    } else if (type === 'image_understanding') {
      data = { label: 'Gemini Vision Node', variableName: 'detected_food', nextNodeId: 'n_end' };
    } else if (type === 'live_map') {
      data = { label: 'Live Map Node', serviceType: 'taxi', nextNodeId: 'n_end' };
    } else if (type === 'ab_testing') {
      data = { label: 'A/B Testing Splitter', flowANodeId: 'n_end', flowBNodeId: 'n_end' };
    } else if (type === 'auto_translation') {
      data = { label: 'AI Auto Translation', fromLang: 'Kiswahili', toLang: 'English', nextNodeId: 'n_end' };
    } else if (type === 'event_automation') {
      data = { label: 'Event Trigger Automation', eventName: 'ride_completed', nextNodeId: 'n_end' };
    } else if (type === 'end') {
      data = { label: 'Kikomo cha Soga (End)', text: 'Asante kwa kutumia Papo Hapo!' };
    }
    
    const canvasElement = document.getElementById('studio-canvas');
    const scrollLeft = canvasElement?.scrollLeft || 0;
    const scrollTop = canvasElement?.scrollTop || 0;
    const x = scrollLeft + 150 + Math.random() * 50;
    const y = scrollTop + 150 + Math.random() * 50;
    
    const newNode = {
      id,
      type,
      position: { x, y },
      data
    };
    
    const updatedNodes = [...metaNodes, newNode];
    setMetaNodes(updatedNodes);
    setSelectedNodeId(id);
    handleSaveWorkflowConfig(updatedNodes, metaEdges, useWorkflow);
    toast.success(`Node ya "${type.toUpperCase()}" imeongezwa!`);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (nodeId === 'n_start') {
      toast.error("Huwezi kufuta Node ya kuanzia (Start)!");
      return;
    }
    const updatedNodes = metaNodes.filter(n => n.id !== nodeId);
    setMetaNodes(updatedNodes);
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    handleSaveWorkflowConfig(updatedNodes, metaEdges, useWorkflow);
    toast.success("Node imefutwa!");
  };

  const sendSimulatedMetaMessage = async (text: string) => {
    if (!text.trim()) return;

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const userMsg: Message = { sender: 'customer', text, timestamp: timeString };
    setMetaChatMessages(prev => [...prev, userMsg]);
    setIsLoadingMeta(true);
    setMetaInputText('');

    try {
      let replyText = "";
      try {
        const response = await fetch('/api/meta/simulate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            senderId: metaSenderId,
            message: text,
            channel: metaChannel
          })
        });

        if (response.ok) {
          const data = await response.json();
          replyText = data.reply;
        }
      } catch (e) {
        console.warn("Server meta simulate API not reached, using local fallback:", e);
      }

      if (!replyText) {
        replyText = await handleMetaInput(metaSenderId, text, metaChannel, null);
      }

      const botMsg: Message = {
        sender: 'bot',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMetaChatMessages(prev => [...prev, botMsg]);
      
      fetchMetaHistory();
      if (useWorkflow) {
        setTimeout(syncSimulatedSessionState, 1000);
      }

    } catch (err: any) {
      toast.error("Hitilafu kwenye Meta simulator: " + err.message);
    } finally {
      setIsLoadingMeta(false);
    }
  };

  const handleResetMetaChat = async () => {
    setMetaChatMessages([
      {
        sender: 'bot',
        text: "👋 Karibu Papo Hapo AI Assistant!\n\nMimi ni Chatbot wako mwenye uwezo wa AI. Unaweza kuandika ombi lako kwa Kiswahili au Sheng rahisi (mfano: \"Nahitaji taxi Mwenge kwenda Posta\", \"Kuna chips kuku?\", \"Nahitaji kukata tiketi ya basi\", au \"Naomba kinyozi leo\").\n\nNami nitagundua (Intent detection) na kukuletea orodha ya huduma punde! ✨",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setActiveWorkflowNodeId('n_start');
    setSimulatedVariables({});
    toast.success("Majaribio ya Meta yaanzishwa upya!");

    try {
      const sessionKey = `${metaChannel}:${metaSenderId}`;
      const docRef = doc(db, 'meta_sessions', sessionKey);
      await setDoc(docRef, {
        senderId: metaSenderId,
        channel: metaChannel,
        step: 'START',
        currentNodeId: 'n_start',
        variables: {},
        details: {},
        updatedAt: new Date()
      });
    } catch (err) {
      console.warn("Could not write reset state to session:", err);
    }
  };

  // Custom flowchart shortcuts for customer to easily check the Twilio scenario requested
  const presetShortcuts = [
    { label: "Anza (Tuma 'Hi')", text: "Hi", color: "bg-emerald-500 hover:bg-emerald-600" },
    { label: "Chagua 1 (Taxi)", text: "1", color: "bg-indigo-500 hover:bg-indigo-600" },
    { label: "Weka Njia (POSTA - MASAKI)", text: "POSTA - MASAKI", color: "bg-gray-700 hover:bg-gray-800" },
    { label: "Chagua 2 (Saluni)", text: "2", color: "bg-pink-500 hover:bg-pink-600" },
    { label: "Chagua 3 (Mabasi)", text: "3", color: "bg-cyan-500 hover:bg-cyan-600" },
    { label: "Route Dar (DAR-MWANZA)", text: "DAR-MWANZA", color: "bg-teal-500 hover:bg-teal-600" },
    { label: "Kibasi 1 (Papo Hapo)", text: "1", color: "bg-violet-500 hover:bg-violet-600" },
    { label: "Kiti (A12)", text: "A12", color: "bg-amber-500 hover:bg-amber-600" },
    { label: "Lipa Tigo/M-Pesa (0712345678)", text: "0712345678", color: "bg-orange-500 hover:bg-orange-600" }
  ];

  return (
    <div className="space-y-6 font-sans">
      
      {/* Tab Switching Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex bg-neutral-100 dark:bg-neutral-900 p-1 rounded-xl w-full sm:max-w-md border border-neutral-200/40 dark:border-neutral-800/60 shadow-xs">
          <button
            onClick={() => setActiveTab('meta')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
              activeTab === 'meta' 
                ? 'bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 shadow-sm border border-neutral-200/50 dark:border-neutral-800/30' 
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
            }`}
          >
            <Zap className="w-4 h-4 text-fuchsia-500 fill-fuchsia-500" />
            Meta Omnichannel (AI)
          </button>
          <button
            onClick={() => setActiveTab('twilio')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
              activeTab === 'twilio' 
                ? 'bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 shadow-sm border border-neutral-200/50 dark:border-neutral-800/30' 
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-500" />
            Twilio SMS Bot
          </button>
        </div>

        {/* Responsive View Switcher for Mobile/Tablet */}
        {activeTab === 'meta' && (
          <div className="flex xl:hidden bg-neutral-100 dark:bg-neutral-900 p-1 rounded-xl border border-neutral-200/50 dark:border-neutral-800 text-xs font-bold uppercase tracking-wider w-full sm:w-auto">
            <button
              onClick={() => setMobileViewMode('all')}
              className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg transition-all text-[10px] flex items-center justify-center gap-1.5 cursor-pointer ${
                mobileViewMode === 'all'
                  ? 'bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 shadow-xs border border-neutral-200/50 dark:border-neutral-800/50'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-indigo-500" />
              <span>Zote Mbili</span>
            </button>
            <button
              onClick={() => setMobileViewMode('studio')}
              className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg transition-all text-[10px] flex items-center justify-center gap-1.5 cursor-pointer ${
                mobileViewMode === 'studio'
                  ? 'bg-fuchsia-600 text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Flow Studio</span>
            </button>
            <button
              onClick={() => setMobileViewMode('phone')}
              className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg transition-all text-[10px] flex items-center justify-center gap-1.5 cursor-pointer ${
                mobileViewMode === 'phone'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Simu ya Jaribio</span>
            </button>
          </div>
        )}
      </div>

      {activeTab === 'meta' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 items-start w-full min-w-0 animate-fade-in">
          
          {/* Left panel: Meta Config, Webhooks, Live Logs */}
          <div className={`space-y-6 w-full min-w-0 xl:col-span-7 ${
            mobileViewMode === 'phone' ? 'hidden xl:block' : 'block'
          }`}>
            
            {/* Meta Intro banner */}
            <div className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 text-white p-6 rounded-2xl shadow-md relative overflow-hidden">
              <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4 scale-150">
                <Globe className="w-64 h-64" />
              </div>
              <div className="relative z-10 space-y-2">
                <span className="bg-white/20 text-white font-bold text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full inline-block">
                  META DEVELOPER SUITE INTEGRATION
                </span>
                <h2 className="text-2xl font-black uppercase tracking-tight italic leading-tight">Meta Omnichannel Social Commerce</h2>
                <p className="text-sm text-fuchsia-50/90 leading-relaxed font-normal max-w-xl">
                  Papo Hapo AI imewezeshwa kuunganishwa na Meta Cloud APIs. Wateja wanaweza kuagiza Taxi, kukata tiketi za mabasi, kuagiza chakula, na kuomba huduma za saluni moja kwa moja kupitia WhatsApp, Messenger, na Instagram!
                </p>
              </div>
            </div>

            {/* Webhook Configuration Details */}
            <Card className="border border-neutral-100 hover:shadow-xs transition-shadow duration-300 dark:border-neutral-800">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <CardTitle className="text-lg font-bold flex items-center gap-2 dark:text-neutral-100 uppercase tracking-wide">
                    <Shield className="w-5 h-5 text-fuchsia-500" />
                    <span>Sanidi Meta Developer Webhooks</span>
                  </CardTitle>

                  {/* Domain Selector Switcher */}
                  <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 p-1 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs">
                    <button
                      onClick={() => setSelectedWebhookDomain('vercel')}
                      className={`px-2.5 py-1 rounded-md font-bold uppercase tracking-wider text-[10px] transition-all cursor-pointer ${
                        selectedWebhookDomain === 'vercel'
                          ? 'bg-fuchsia-600 text-white shadow-xs'
                          : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
                      }`}
                    >
                      Vercel App
                    </button>
                    <button
                      onClick={() => setSelectedWebhookDomain('cloudrun')}
                      className={`px-2.5 py-1 rounded-md font-bold uppercase tracking-wider text-[10px] transition-all cursor-pointer ${
                        selectedWebhookDomain === 'cloudrun'
                          ? 'bg-fuchsia-600 text-white shadow-xs'
                          : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
                      }`}
                    >
                      AI Studio Dev
                    </button>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  Sajili Callback URL hii na neno la siri la uhakiki (Verify Token) kwenye Meta Developer Console:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5 p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/80 rounded-xl">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black uppercase tracking-wider text-neutral-500 block">
                      Meta Webhook Callback URL ({selectedWebhookDomain === 'vercel' ? 'Vercel Production Domain' : 'Preview Dev Domain'})
                    </label>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono font-bold bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-200">
                      {selectedWebhookDomain === 'vercel' ? 'https://dereva-tz.vercel.app' : 'AI Studio Cloud'}
                    </Badge>
                  </div>

                  <div className="flex gap-2 items-center mt-1">
                    <Input 
                      readOnly 
                      value={activeWebhookUrl} 
                      className="font-mono text-xs select-all bg-white dark:bg-black h-9 border-neutral-200 py-1"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleCopyMetaWebhook} 
                      className={`h-9 shrink-0 gap-1.5 ${copiedMetaWebhook ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200'}`}
                    >
                      {copiedMetaWebhook ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {copiedMetaWebhook ? 'Copied' : 'Copy'}
                      </span>
                    </Button>
                  </div>

                  {/* Live Webhook Ping Tester */}
                  <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t border-neutral-200/40 dark:border-neutral-800/40 mt-3">
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Jaribu kama Webhook URL inafanya kazi kabla ya kusajili Meta:
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={livePingStatus.testing}
                      onClick={handleTestLiveWebhook}
                      className="h-7 text-xs font-bold gap-1.5 border-fuchsia-500/30 text-fuchsia-600 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/30 shrink-0 self-end sm:self-auto"
                    >
                      <RefreshCw className={`w-3 h-3 ${livePingStatus.testing ? 'animate-spin' : ''}`} />
                      Pima Webhook Live
                    </Button>
                  </div>

                  {livePingStatus.responseText && (
                    <div className={`mt-2 p-2 rounded-lg text-xs font-mono border ${
                      livePingStatus.success 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400' 
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
                    }`}>
                      {livePingStatus.responseText}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/80 rounded-xl">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">Verify Token</span>
                    <span className="font-mono text-xs text-neutral-800 dark:text-neutral-200 block font-bold py-1 select-all">
                      papo_hapo_meta_secure_token_2026
                    </span>
                  </div>
                  <div className="space-y-1.5 p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/80 rounded-xl">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">AI Intent Router</span>
                    <span className="text-xs text-fuchsia-600 dark:text-fuchsia-400 font-bold block py-1 uppercase tracking-wider">
                      Gemini NLP Classifier Active
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Automation Studio (Visual Workflow Builder) Card */}
            <Card className="border border-neutral-100 dark:border-neutral-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800/80">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div>
                    <CardTitle className="text-lg font-black flex items-center gap-2 dark:text-neutral-100 uppercase tracking-wide">
                      <Zap className="w-5 h-5 text-fuchsia-500 fill-fuchsia-500" />
                      <span>Papo Hapo Automation Studio (V3.0)</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Tengeneza na ubuni mtiririko mzima wa mazungumzo (Visual Conversation Flow) bila code yoyote.
                    </CardDescription>
                  </div>
                  
                  {/* Visual Automation Toggle switch */}
                  <div className="flex items-center gap-3 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-900 rounded-xl border border-neutral-200/50 dark:border-neutral-800 shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Visual Flow?</span>
                    <button
                      onClick={() => {
                        const nextVal = !useWorkflow;
                        setUseWorkflow(nextVal);
                        handleSaveWorkflowConfig(metaNodes, metaEdges, nextVal);
                        toast.success(nextVal ? "Visual Flow Automation imewezeshwa! 🟢" : "Visual Flow Automation imezimwa (Legacy triggers are active).");
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        useWorkflow ? "bg-fuchsia-600" : "bg-neutral-300 dark:bg-neutral-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          useWorkflow ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-0 space-y-0">
                <AutomationStudioTabs
                  studioTab={studioTab}
                  setStudioTab={setStudioTab}
                  vendorId={vendorId}
                  db={db}
                  knowledgeBaseText={knowledgeBaseText}
                  setKnowledgeBaseText={setKnowledgeBaseText}
                  simulatedVariables={simulatedVariables}
                  setSimulatedVariables={setSimulatedVariables}
                  broadcastAudience={broadcastAudience}
                  setBroadcastAudience={setBroadcastAudience}
                  broadcastMessage={broadcastMessage}
                  setBroadcastMessage={setBroadcastMessage}
                  broadcastChannel={broadcastChannel}
                  setBroadcastChannel={setBroadcastChannel}
                  broadcastLogs={broadcastLogs}
                  setBroadcastLogs={setBroadcastLogs}
                  setMetaNodes={setMetaNodes}
                  setMetaEdges={setMetaEdges}
                  handleSaveWorkflowConfig={handleSaveWorkflowConfig}
                  useWorkflow={useWorkflow}
                  metaAppId={metaAppId}
                  setMetaAppId={setMetaAppId}
                  metaAppSecret={metaAppSecret}
                  setMetaAppSecret={setMetaAppSecret}
                  metaBusinessId={metaBusinessId}
                  setMetaBusinessId={setMetaBusinessId}
                  metaPageId={metaPageId}
                  setMetaPageId={setMetaPageId}
                  metaInstagramId={metaInstagramId}
                  setMetaInstagramId={setMetaInstagramId}
                  metaWabaId={metaWabaId}
                  setMetaWabaId={setMetaWabaId}
                  metaPhoneNumberId={metaPhoneNumberId}
                  setMetaPhoneNumberId={setMetaPhoneNumberId}
                  metaAccessToken={metaAccessToken}
                  setMetaAccessToken={setMetaAccessToken}
                  metaVerifyToken={metaVerifyToken}
                  setMetaVerifyToken={setMetaVerifyToken}
                  handleSaveFullMetaIntegration={handleSaveFullMetaIntegration}
                />

                {studioTab === 'canvas' && (
                  <div className="grid grid-cols-1 xl:grid-cols-3 divide-y xl:divide-y-0 xl:divide-x divide-neutral-100 dark:divide-neutral-800">
                  
                  {/* Left & Middle: Visual Flowchart Canvas (2/3 width) */}
                  <div className="xl:col-span-2 p-5 space-y-4">
                    {/* AI Copilot Input Bar */}
                    <div className="p-4 bg-fuchsia-50/40 dark:bg-fuchsia-950/10 border border-fuchsia-100/60 dark:border-fuchsia-900/30 rounded-2xl space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-fuchsia-500" />
                        <span className="text-[10.5px] font-black uppercase tracking-widest text-fuchsia-700 dark:text-fuchsia-400">AI Copilot Chatflow Builder (V4.0)</span>
                        <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/10 text-fuchsia-600 text-[8px] font-bold uppercase tracking-wider">Enterprise AI</span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input 
                          value={copilotPrompt}
                          onChange={(e) => setCopilotPrompt(e.target.value)}
                          placeholder="Andika flow unayotaka (e.g. 'Jenga taxi booking flow inayouliza pickup, destination kisha kutoa fare...')"
                          className="text-xs h-9 bg-white dark:bg-neutral-900 border-neutral-200 w-full"
                        />
                        <Button 
                          onClick={async () => {
                            if (!copilotPrompt.trim()) {
                              toast.error("Tafadhali andika maelezo ya flow unayotaka!");
                              return;
                            }
                            setGeneratingFlow(true);
                            try {
                              const res = await fetch('/api/meta/generate-flow', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  prompt: copilotPrompt,
                                  currentNodes: metaNodes && metaNodes.length > 0 ? metaNodes : undefined
                                })
                              });
                              if (!res.ok) throw new Error("Server error");
                              const data = await res.json();
                              if (data.nodes && data.nodes.length > 0) {
                                setMetaNodes(data.nodes);
                                // clear edges or recreate them based on connections
                                const derivedEdges: any[] = [];
                                data.nodes.forEach((n: any) => {
                                  if (n.data?.nextNodeId) {
                                    derivedEdges.push({ id: `e_${n.id}`, source: n.id, target: n.data.nextNodeId });
                                  }
                                  if (n.type === 'question' && n.data?.options) {
                                    n.data.options.forEach((opt: any, idx: number) => {
                                      if (opt.nextNodeId) {
                                        derivedEdges.push({ id: `e_${n.id}_opt_${idx}`, source: n.id, target: opt.nextNodeId });
                                      }
                                    });
                                  }
                                  if (n.type === 'ai_decision' && n.data?.intentMappings) {
                                    n.data.intentMappings.forEach((m: any, idx: number) => {
                                      if (m.nextNodeId) {
                                        derivedEdges.push({ id: `e_${n.id}_${idx}`, source: n.id, target: m.nextNodeId });
                                      }
                                    });
                                  }
                                });
                                setMetaEdges(derivedEdges);
                                handleSaveWorkflowConfig(data.nodes, derivedEdges, useWorkflow);
                                if (metaNodes && metaNodes.length > 0) {
                                  toast.success("AI Copilot imerekebisha na kuendeleza Flow iliyopo kikamilifu! 🤖✨");
                                } else {
                                  toast.success("AI Copilot imejenga Flow mpya ya Papo Hapo kikamilifu! 🤖✨");
                                }
                                setTimeout(() => handleFitView(), 200);
                              } else {
                                toast.error("Imeshindwa kutengeneza flow. Tafadhali jaribu tena.");
                              }
                            } catch (err) {
                              toast.error("Itifaki ya AI ilishindwa kujenga flow.");
                            } finally {
                              setGeneratingFlow(false);
                            }
                          }}
                          disabled={generatingFlow}
                          className="h-9 text-xs px-4 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-extrabold uppercase shrink-0 animate-pulse-subtle w-full sm:w-auto"
                        >
                          {generatingFlow ? (
                            <span className="flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" /> Inajenga...
                            </span>
                          ) : (
                            "Jenga Flow"
                          )}
                        </Button>
                      </div>

                      {/* Quick AI Prompt Presets */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[9.5px] font-black uppercase tracking-wider text-neutral-400">Mifano ya Haraka:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const p = "Nitengezee flow mteja akiuliza au akitaip habari imletee:\nKaribu kwenye Mfumo wa Huduma za Papo Hapo! 🌟\nTafadhali chagua huduma unayotaka kwa kutuma namba yake:\n1. 🚕 TAXI\n2. 💇‍♀️ SALUNI (Salons)\n3. 🚌 MABASI (Bus Tickets)\n4. 🥗 CHAKULA (Restaurants)\n5. 🥦 SOKO (Groceries)\n6. 💊 PHARMACY";
                            setCopilotPrompt(p);
                            toast.info("Prompt ya Mfumo wa Huduma 1-6 imewekwa. Bofya 'JENGA FLOW' au jaribu kuisahihisha!");
                          }}
                          className="px-2.5 py-1 rounded-lg bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300 text-[10px] font-bold border border-fuchsia-200 dark:border-fuchsia-900/50 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <Sparkles className="w-3 h-3 text-fuchsia-500" />
                          <span>🌟 Main Services Menu Flow (Taxi, Saluni, Mabasi, Chakula, Soko, Pharmacy)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCopilotPrompt("endelea au rekebisha kwamba akichagua TAXI au namba 1 basi aambiwe andike lokesheni anayo enda na abonyeze kitufe chakutuma location au aandike anapo kwenda na alipo");
                            toast.info("Prompt ya kuendeleza TAXI na Tuma Location imewekwa! Bofya 'JENGA FLOW'.");
                          }}
                          className="px-2 py-0.5 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px] font-bold border border-purple-200 dark:border-purple-800 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          📍 Endeleza TAXI (Location & Eneo)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCopilotPrompt("Jenga taxi booking flow inayouliza pickup location, destination, kisha kutoa fare na kutengeneza order DB");
                          }}
                          className="px-2 py-0.5 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-[10px] font-semibold transition-colors cursor-pointer"
                        >
                          🚕 Taxi Ride Flow
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCopilotPrompt("Jenga chakula & mgahawa order flow inayouliza chakula anachotaka na eneo la delivery");
                          }}
                          className="px-2 py-0.5 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-[10px] font-semibold transition-colors cursor-pointer"
                        >
                          🥗 Chakula Order Flow
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      {/* Node quick inserters bar */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none w-full sm:max-w-[70%] touch-pan-x">
                        <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400 shrink-0 mr-1">Ongeza Node:</span>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleAddNode('message')}
                          className="h-7 text-[9px] font-bold uppercase tracking-wider text-fuchsia-600 border-fuchsia-500/20 hover:bg-fuchsia-50 shrink-0"
                        >
                          <Send className="w-3 h-3 mr-1" /> Message
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleAddNode('question')}
                          className="h-7 text-[9px] font-bold uppercase tracking-wider text-emerald-600 border-emerald-500/20 hover:bg-emerald-50 shrink-0"
                        >
                          <HelpCircle className="w-3 h-3 mr-1" /> Question
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleAddNode('ai_decision')}
                          className="h-7 text-[9px] font-bold uppercase tracking-wider text-purple-600 border-purple-500/20 hover:bg-purple-50 shrink-0"
                        >
                          <Brain className="w-3 h-3 mr-1" /> AI Router
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleAddNode('create_order')}
                          className="h-7 text-[9px] font-bold uppercase tracking-wider text-indigo-600 border-indigo-500/20 hover:bg-indigo-50 shrink-0"
                        >
                          <ShoppingBag className="w-3 h-3 mr-1" /> Order DB
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleAddNode('ocr')}
                          className="h-7 text-[9px] font-bold uppercase tracking-wider text-rose-600 border-rose-500/20 hover:bg-rose-50 shrink-0"
                        >
                          <Brain className="w-3 h-3 mr-1" /> OCR
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleAddNode('voice_bot')}
                          className="h-7 text-[9px] font-bold uppercase tracking-wider text-teal-600 border-teal-500/20 hover:bg-teal-50 shrink-0"
                        >
                          <Smartphone className="w-3 h-3 mr-1" /> Voice
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleAddNode('image_understanding')}
                          className="h-7 text-[9px] font-bold uppercase tracking-wider text-orange-600 border-orange-500/20 hover:bg-orange-50 shrink-0"
                        >
                          <ShoppingBag className="w-3 h-3 mr-1" /> Vision
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleAddNode('live_map')}
                          className="h-7 text-[9px] font-bold uppercase tracking-wider text-sky-600 border-sky-500/20 hover:bg-sky-50 shrink-0"
                        >
                          <Globe className="w-3 h-3 mr-1" /> Live Map
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleAddNode('ab_testing')}
                          className="h-7 text-[9px] font-bold uppercase tracking-wider text-violet-600 border-violet-500/20 hover:bg-violet-50 shrink-0"
                        >
                          <GitBranch className="w-3 h-3 mr-1" /> A/B Test
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleAddNode('auto_translation')}
                          className="h-7 text-[9px] font-bold uppercase tracking-wider text-pink-600 border-pink-500/20 hover:bg-pink-50 shrink-0"
                        >
                          <Globe className="w-3 h-3 mr-1" /> Translate
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleAddNode('event_automation')}
                          className="h-7 text-[9px] font-bold uppercase tracking-wider text-yellow-600 border-yellow-500/20 hover:bg-yellow-50 shrink-0"
                        >
                          <Zap className="w-3 h-3 mr-1" /> Event
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleAddNode('end')}
                          className="h-7 text-[9px] font-bold uppercase tracking-wider text-neutral-600 border-neutral-500/20 hover:bg-neutral-50 shrink-0"
                        >
                          <StopCircle className="w-3 h-3 mr-1" /> End
                        </Button>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm("Je, una uhakika unataka kurudisha mtiririko wa soga kwenye muundo wa kwanza wa mfano?")) {
                              setMetaNodes(getInitialNodes());
                              handleSaveWorkflowConfig(getInitialNodes(), [], useWorkflow);
                              toast.success("Flow ya kwanza imerejeshwa vizuri!");
                            }
                          }}
                          className="h-7 text-[9px] font-black uppercase text-neutral-400 hover:text-red-500"
                        >
                          Reset
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            handleSaveWorkflowConfig(metaNodes, metaEdges, useWorkflow);
                            toast.success("Mabadiliko yote ya flowchart yamehifadhiwa kwenye Firebase! 🚀");
                          }}
                          className="h-7 text-[9px] font-extrabold uppercase tracking-wider bg-fuchsia-600 hover:bg-fuchsia-700 text-white shadow-sm"
                        >
                          Hifadhi Flow
                        </Button>
                      </div>
                    </div>

                    {/* Canvas Area Container */}
                    <div className={`relative border border-neutral-200/60 dark:border-neutral-800 rounded-2xl bg-neutral-50 dark:bg-neutral-950/40 p-1.5 transition-all duration-300 ${
                      isExpandedCanvas ? 'fixed inset-3 sm:inset-6 z-50 bg-white dark:bg-neutral-950 shadow-2xl flex flex-col p-3' : ''
                    }`}>
                      {/* Floating Canvas Controls Toolbar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-xl border border-neutral-200/60 dark:border-neutral-800 mb-2 z-30 shadow-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-fuchsia-500" />
                            <span>Zoom & View Controls:</span>
                          </span>
                          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5 border border-neutral-200/60 dark:border-neutral-700">
                            <button
                              type="button"
                              onClick={() => setCanvasScale(prev => Math.max(0.35, +(prev - 0.15).toFixed(2)))}
                              title="Zoom Out (-)"
                              className="px-2 py-1 hover:bg-white dark:hover:bg-neutral-700 rounded-md text-xs font-bold text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
                            >
                              -
                            </button>
                            <span className="px-2 text-[10px] font-mono font-bold text-fuchsia-600 dark:text-fuchsia-400 min-w-[45px] text-center">
                              {Math.round(canvasScale * 100)}%
                            </span>
                            <button
                              type="button"
                              onClick={() => setCanvasScale(prev => Math.min(1.8, +(prev + 0.15).toFixed(2)))}
                              title="Zoom In (+)"
                              className="px-2 py-1 hover:bg-white dark:hover:bg-neutral-700 rounded-md text-xs font-bold text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCanvasScale(1.0)}
                            className="px-2.5 py-1 text-[10px] font-bold text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200/50 dark:border-neutral-700 transition-colors cursor-pointer"
                          >
                            100% Reset
                          </button>
                          <button
                            type="button"
                            onClick={handleFitView}
                            className="px-2.5 py-1 text-[10px] font-extrabold uppercase text-purple-700 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg border border-purple-500/30 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <Maximize2 className="w-3 h-3 text-purple-500" />
                            <span>🎯 Center & Fit All Nodes</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsExpandedCanvas(!isExpandedCanvas)}
                            className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700 rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            {isExpandedCanvas ? (
                              <>
                                <Minimize2 className="w-3.5 h-3.5" />
                                <span>Rudi View Kawaida</span>
                              </>
                            ) : (
                              <>
                                <Maximize2 className="w-3.5 h-3.5" />
                                <span>🖥️ Skrini Nzima (Fullscreen)</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Grid background design */}
                      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#262626_1px,transparent_1px)] opacity-50 rounded-2xl pointer-events-none" />
                      
                      <div 
                        id="studio-canvas"
                        className={`relative w-full ${isExpandedCanvas ? 'flex-1 h-[calc(100vh-180px)]' : 'h-[500px] sm:h-[600px] md:h-[680px]'} overflow-auto rounded-2xl scrollbar-thin cursor-crosshair select-none`}
                        onClick={() => setSelectedNodeId(null)}
                      >
                        {/* Scaled Inner Canvas Wrapper */}
                        <div 
                          className="relative"
                          style={{ 
                            width: "3200px", 
                            height: "2200px",
                            transform: `scale(${canvasScale})`,
                            transformOrigin: "0 0"
                          }}
                        >
                          {/* Interactive SVG layer for custom curved connections */}
                          <svg 
                            className="absolute inset-0 pointer-events-none" 
                            style={{ width: "3200px", height: "2200px" }}
                          >
                            <defs>
                              <marker 
                                id="arrow" 
                                viewBox="0 0 10 10" 
                                refX="6" 
                                refY="5" 
                                markerWidth="5" 
                                markerHeight="5" 
                                orient="auto-start-reverse"
                              >
                                <path d="M 0 1 L 10 5 L 0 9 z" fill="#d946ef" />
                              </marker>
                            </defs>

                            {/* Compute and Draw curves */}
                            {metaNodes.map((node) => {
                              // 1. Standard defaults
                              const paths: React.ReactNode[] = [];
                              if (node.data?.nextNodeId) {
                                const path = drawLink(node.id, node.data.nextNodeId);
                                if (path) paths.push(path);
                              }

                              // 2. AI Intent mappings branches
                              if (node.type === 'ai_decision' && node.data?.intentMappings) {
                                node.data.intentMappings.forEach((mapping: any, idx: number) => {
                                  if (mapping.nextNodeId) {
                                    const path = drawLink(
                                      node.id, 
                                      mapping.nextNodeId, 
                                      "#8b5cf6", 
                                      mapping.keywords?.split(',')[0] || `Branch ${idx+1}`
                                    );
                                    if (path) paths.push(path);
                                  }
                                });
                              }

                              return paths;
                            })}
                          </svg>

                          {/* Visual Node Cards rendered as divs on absolute layout */}
                          <div className="absolute inset-0 pointer-events-auto" style={{ width: "3200px", height: "2200px" }}>
                          {metaNodes.map((node) => {
                            const isSelected = selectedNodeId === node.id;
                            const isActive = activeWorkflowNodeId === node.id;
                            
                            let headerColor = "bg-neutral-100 border-neutral-300 dark:bg-neutral-800 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200";
                            let nodeIcon = <Settings className="w-4 h-4" />;
                            
                            if (node.type === 'start') {
                              headerColor = "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400";
                              nodeIcon = <Play className="w-3.5 h-3.5 fill-amber-500/10" />;
                            } else if (node.type === 'message') {
                              headerColor = "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-600 dark:text-fuchsia-400";
                              nodeIcon = <Send className="w-3.5 h-3.5" />;
                            } else if (node.type === 'question') {
                              headerColor = "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400";
                              nodeIcon = <HelpCircle className="w-3.5 h-3.5" />;
                            } else if (node.type === 'ai_decision') {
                              headerColor = "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400";
                              nodeIcon = <Brain className="w-3.5 h-3.5" />;
                            } else if (node.type === 'condition') {
                              headerColor = "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400";
                              nodeIcon = <GitBranch className="w-3.5 h-3.5" />;
                            } else if (node.type === 'payment') {
                              headerColor = "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400";
                              nodeIcon = <CreditCard className="w-3.5 h-3.5" />;
                            } else if (node.type === 'create_order') {
                              headerColor = "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400";
                              nodeIcon = <ShoppingBag className="w-3.5 h-3.5" />;
                            } else if (node.type === 'ocr') {
                              headerColor = "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400";
                              nodeIcon = <Brain className="w-3.5 h-3.5" />;
                            } else if (node.type === 'voice_bot') {
                              headerColor = "bg-teal-500/10 border-teal-500/30 text-teal-600 dark:text-teal-400";
                              nodeIcon = <Smartphone className="w-3.5 h-3.5" />;
                            } else if (node.type === 'image_understanding') {
                              headerColor = "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400";
                              nodeIcon = <ShoppingBag className="w-3.5 h-3.5" />;
                            } else if (node.type === 'live_map') {
                              headerColor = "bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400";
                              nodeIcon = <Globe className="w-3.5 h-3.5" />;
                            } else if (node.type === 'ab_testing') {
                              headerColor = "bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400";
                              nodeIcon = <GitBranch className="w-3.5 h-3.5" />;
                            } else if (node.type === 'auto_translation') {
                              headerColor = "bg-pink-500/10 border-pink-500/30 text-pink-600 dark:text-pink-400";
                              nodeIcon = <Globe className="w-3.5 h-3.5" />;
                            } else if (node.type === 'event_automation') {
                              headerColor = "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400";
                              nodeIcon = <Zap className="w-3.5 h-3.5" />;
                            } else if (node.type === 'end') {
                              headerColor = "bg-neutral-500/10 border-neutral-500/30 text-neutral-600 dark:text-neutral-400";
                              nodeIcon = <StopCircle className="w-3.5 h-3.5" />;
                            }
                            
                            return (
                              <div
                                key={node.id}
                                style={{ left: `${node.position?.x || 0}px`, top: `${node.position?.y || 0}px` }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedNodeId(node.id);
                                }}
                                className={`absolute w-[190px] rounded-2xl border bg-white dark:bg-neutral-900 shadow-md hover:shadow-lg transition-all duration-300 select-none ${
                                  isSelected ? 'ring-2 ring-fuchsia-500 border-fuchsia-500 shadow-fuchsia-500/10 scale-102 z-20' : 'z-10'
                                } ${
                                  isActive ? 'ring-4 ring-emerald-500 ring-offset-2 dark:ring-offset-black animate-pulse z-30' : ''
                                }`}
                              >
                                {/* Dragging Header */}
                                <div
                                  onMouseDown={(e) => handleNodeDragStart(e, node.id)}
                                  className={`px-3 py-2 rounded-t-2xl border-b flex items-center justify-between cursor-grab active:cursor-grabbing ${headerColor}`}
                                >
                                  <div className="flex items-center gap-1.5 font-black text-[9.5px] uppercase tracking-wider truncate max-w-[80%]">
                                    {nodeIcon}
                                    <span>{node.data?.label || node.id}</span>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteNode(node.id);
                                    }}
                                    className="text-neutral-400 hover:text-red-500 p-0.5 rounded transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                                
                                {/* Content overview */}
                                <div className="p-3 text-[10px] text-neutral-500 dark:text-neutral-400 space-y-1">
                                  {node.type === 'message' && (
                                    <p className="line-clamp-2 italic text-neutral-600 dark:text-neutral-300">"{node.data?.text || 'Bila ujumbe'}"</p>
                                  )}
                                  {node.type === 'question' && (
                                    <div className="space-y-0.5">
                                      <p className="line-clamp-1 italic text-neutral-600 dark:text-neutral-300">❓ "{node.data?.text || 'Swali'}"</p>
                                      <p className="font-mono text-[8.5px] text-emerald-600 dark:text-emerald-400 font-bold">💾 Var: {node.data?.variableName || 'var'}</p>
                                    </div>
                                  )}
                                  {node.type === 'ai_decision' && (
                                    <p className="font-bold text-purple-600 dark:text-purple-400">⚡ NLP Intent Classifier ({node.data?.intentMappings?.length || 0} branches)</p>
                                  )}
                                  {node.type === 'condition' && (
                                    <p className="font-mono text-[8px] text-blue-600 font-bold">
                                      IF {node.data?.variable} == {node.data?.value}
                                    </p>
                                  )}
                                  {node.type === 'payment' && (
                                    <p className="font-bold text-yellow-600">💸 TSH {node.data?.amount || 0}</p>
                                  )}
                                  {node.type === 'create_order' && (
                                    <p className="font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest text-[8px]">🛠️ DB UNDA ORDER: {node.data?.serviceType?.toUpperCase()}</p>
                                  )}
                                  {node.type === 'end' && (
                                    <p className="line-clamp-1 text-neutral-400">⏹️ Kikomo cha soga</p>
                                  )}
                                  
                                  {/* Link descriptor */}
                                  {node.data?.nextNodeId && (
                                    <div className="pt-1.5 border-t border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between text-[8px] font-bold uppercase text-neutral-400 mt-1">
                                      <span>Inafuata:</span>
                                      <span className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded text-neutral-600 dark:text-neutral-350 truncate max-w-[60%]">
                                        {metaNodes.find(n => n.id === node.data.nextNodeId)?.data?.label || 'Mwisho'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                  </div>

                  {/* Right side: Selected Node Inspector Panel (1/3 width) */}
                  <div className="p-5 space-y-4 bg-neutral-50/50 dark:bg-neutral-900/10">
                    <div className="pb-3 border-b border-neutral-100 dark:border-neutral-800/80">
                      <h4 className="text-xs font-black uppercase tracking-wider text-neutral-500">Marekebisho ya Node (Node Inspector)</h4>
                      <p className="text-[10px] text-neutral-400 mt-0.5">Bofya node yoyote kwenye canvas ili kuanza hariri muundo wake.</p>
                    </div>

                    {selectedNodeId ? (() => {
                      const node = metaNodes.find(n => n.id === selectedNodeId);
                      if (!node) return <div className="text-center py-10 text-xs text-neutral-400">Node haipatikani</div>;

                      // Helper to update specific data field of selected node
                      const updateNodeData = (fields: any) => {
                        setMetaNodes(prev => prev.map(n => {
                          if (n.id === selectedNodeId) {
                            return {
                              ...n,
                              data: {
                                ...n.data,
                                ...fields
                              }
                            };
                          }
                          return n;
                        }));
                      };

                      return (
                        <div className="space-y-4 animate-fade-in">
                          <div className="p-3 bg-white dark:bg-neutral-950 border border-neutral-200/50 dark:border-neutral-800/80 rounded-2xl shadow-xs space-y-3.5">
                            {/* General Title */}
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Jina la Node (Label)</label>
                              <Input 
                                value={node.data?.label || ''}
                                onChange={(e) => updateNodeData({ label: e.target.value })}
                                className="h-8.5 text-xs bg-neutral-50/50 dark:bg-neutral-900"
                              />
                            </div>

                            {/* Conditional render depending on type */}
                            {node.type === 'message' && (
                              <div className="space-y-3 pt-1 border-t border-neutral-100 dark:border-neutral-800/50">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Maandishi ya Ujumbe (Text Body)</label>
                                  <Textarea 
                                    rows={5}
                                    value={node.data?.text || ''}
                                    onChange={(e) => updateNodeData({ text: e.target.value })}
                                    placeholder="Andika ujumbe hapa... (Unaweza kutumia emoji na herufi nene kama *neno*)"
                                    className="text-xs bg-neutral-50/50 dark:bg-neutral-900"
                                  />
                                </div>
                              </div>
                            )}

                            {node.type === 'question' && (
                              <div className="space-y-3 pt-1 border-t border-neutral-100 dark:border-neutral-800/50">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Maandishi ya Swali (Question Text)</label>
                                  <Textarea 
                                    rows={3}
                                    value={node.data?.text || ''}
                                    onChange={(e) => updateNodeData({ text: e.target.value })}
                                    placeholder="Tafadhali andika swali la kumuuliza mteja..."
                                    className="text-xs bg-neutral-50/50 dark:bg-neutral-900"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Jina la Kigezo cha Kuhifadhi (Save to Variable)</label>
                                  <Input 
                                    value={node.data?.variableName || ''}
                                    onChange={(e) => updateNodeData({ variableName: e.target.value })}
                                    placeholder="Mfano: pickup"
                                    className="h-8 text-xs font-mono bg-neutral-50/50 dark:bg-neutral-900"
                                  />
                                </div>
                              </div>
                            )}

                            {node.type === 'ai_decision' && (
                              <div className="space-y-3 pt-1 border-t border-neutral-100 dark:border-neutral-800/50">
                                <div className="flex justify-between items-center">
                                  <label className="text-[9px] font-black uppercase tracking-wider text-purple-500">Gemini Intent Mappings</label>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      const mappings = node.data?.intentMappings || [];
                                      updateNodeData({
                                        intentMappings: [...mappings, { keywords: '', nextNodeId: 'n_end' }]
                                      });
                                    }}
                                    className="h-6 text-[8px] font-black text-purple-600 uppercase tracking-widest hover:bg-purple-50 p-1"
                                  >
                                    + Ongeza Njia (Branch)
                                  </Button>
                                </div>

                                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                  {(node.data?.intentMappings || []).map((mapping: any, idx: number) => (
                                    <div key={idx} className="p-2.5 bg-neutral-100/50 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/80 rounded-xl space-y-2">
                                      <div className="flex justify-between items-center">
                                        <span className="text-[8.5px] font-black uppercase tracking-wider text-neutral-400">Branch #{idx + 1}</span>
                                        <button 
                                          onClick={() => {
                                            const mappings = [...(node.data?.intentMappings || [])];
                                            mappings.splice(idx, 1);
                                            updateNodeData({ intentMappings: mappings });
                                          }}
                                          className="text-neutral-400 hover:text-red-500 text-[8.5px] font-black uppercase"
                                        >
                                          Futa
                                        </button>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-neutral-400 uppercase">Maneno Muhimu / Keywords</label>
                                        <Input 
                                          value={mapping.keywords || ''}
                                          onChange={(e) => {
                                            const mappings = [...(node.data?.intentMappings || [])];
                                            mappings[idx].keywords = e.target.value;
                                            updateNodeData({ intentMappings: mappings });
                                          }}
                                          placeholder="taxi, boda, bajaji"
                                          className="h-7 text-[10px] bg-white dark:bg-neutral-950 font-mono"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-neutral-400 uppercase">Inapokwenda (Target Node ID)</label>
                                        <select
                                          value={mapping.nextNodeId || ''}
                                          onChange={(e) => {
                                            const mappings = [...(node.data?.intentMappings || [])];
                                            mappings[idx].nextNodeId = e.target.value;
                                            updateNodeData({ intentMappings: mappings });
                                          }}
                                          className="w-full text-[10px] h-7 px-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                                        >
                                          <option value="">-- Chagua Node --</option>
                                          {metaNodes.filter(n => n.id !== node.id).map(n => (
                                            <option key={n.id} value={n.id}>{n.data?.label || n.id}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {node.type === 'create_order' && (
                              <div className="space-y-3 pt-1 border-t border-neutral-100 dark:border-neutral-800/50">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Aina ya Huduma ya Papo Hapo (Service Type)</label>
                                  <select
                                    value={node.data?.serviceType || 'taxi'}
                                    onChange={(e) => updateNodeData({ serviceType: e.target.value })}
                                    className="w-full text-xs h-8.5 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                                  >
                                    <option value="taxi">🚕 Taxi & Delivery Riders</option>
                                    <option value="food">🍔 Food & Restaurants</option>
                                    <option value="parcel">📦 Parcel Courier Services</option>
                                    <option value="salon">💇‍♀️ Salon & Wellness</option>
                                    <option value="bus">🚌 Mabasi Tickets</option>
                                  </select>
                                  <span className="text-[8px] text-neutral-400 block mt-1 leading-relaxed">
                                    Inapoingia hapa, mfumo utachukua kigezo cha <code>{"{pickup}"}</code> na <code>{"{destination}"}</code> na kuunda order halisi kwenye Firestore.
                                  </span>
                                </div>
                              </div>
                            )}

                            {node.type === 'end' && (
                              <div className="space-y-3 pt-1 border-t border-neutral-100 dark:border-neutral-800/50">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Ujumbe wa Mwisho (Final Farewell Text)</label>
                                  <Textarea 
                                    rows={4}
                                    value={node.data?.text || ''}
                                    onChange={(e) => updateNodeData({ text: e.target.value })}
                                    placeholder="Andika shukrani na kisha maliza soga..."
                                    className="text-xs bg-neutral-50/50 dark:bg-neutral-900"
                                  />
                                </div>
                              </div>
                            )}

                            {node.type === 'ocr' && (
                              <div className="space-y-3 pt-1 border-t border-neutral-100 dark:border-neutral-800/50">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Kigezo cha Risiti/Kitambulisho (Extracted Text Variable)</label>
                                  <Input 
                                    value={node.data?.variableName || ''}
                                    onChange={(e) => updateNodeData({ variableName: e.target.value })}
                                    placeholder="Mfano: control_number"
                                    className="h-8.5 text-xs bg-neutral-50/50 dark:bg-neutral-900 font-mono"
                                  />
                                </div>
                              </div>
                            )}

                            {node.type === 'voice_bot' && (
                              <div className="space-y-3 pt-1 border-t border-neutral-100 dark:border-neutral-800/50">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Instruction ya Voice Assistant</label>
                                  <Textarea 
                                    rows={3}
                                    value={node.data?.prompt || ''}
                                    onChange={(e) => updateNodeData({ prompt: e.target.value })}
                                    placeholder="Mfano: Sikiliza sauti ya mteja kisha taja gharama..."
                                    className="text-xs bg-neutral-50/50 dark:bg-neutral-900"
                                  />
                                </div>
                              </div>
                            )}

                            {node.type === 'image_understanding' && (
                              <div className="space-y-3 pt-1 border-t border-neutral-100 dark:border-neutral-800/50">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Kigezo cha Kutunza Kitu Kilichotambuliwa (Output Variable)</label>
                                  <Input 
                                    value={node.data?.variableName || ''}
                                    onChange={(e) => updateNodeData({ variableName: e.target.value })}
                                    placeholder="Mfano: detected_product"
                                    className="h-8.5 text-xs bg-neutral-50/50 dark:bg-neutral-900 font-mono"
                                  />
                                </div>
                              </div>
                            )}

                            {node.type === 'live_map' && (
                              <div className="space-y-3 pt-1 border-t border-neutral-100 dark:border-neutral-800/50">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Aina ya Ramani (Tracking Service)</label>
                                  <select
                                    value={node.data?.serviceType || 'taxi'}
                                    onChange={(e) => updateNodeData({ serviceType: e.target.value })}
                                    className="w-full text-xs h-8.5 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                                  >
                                    <option value="taxi">🚕 Taxi & Bodaboda Tracking</option>
                                    <option value="food">🍔 Food Vendor Delivery Status</option>
                                  </select>
                                </div>
                              </div>
                            )}

                            {node.type === 'ab_testing' && (
                              <div className="space-y-3 pt-1 border-t border-neutral-100 dark:border-neutral-800/50">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Flow A Target Node</label>
                                  <select
                                    value={node.data?.flowANodeId || ''}
                                    onChange={(e) => updateNodeData({ flowANodeId: e.target.value })}
                                    className="w-full text-xs h-8.5 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                                  >
                                    <option value="">-- Chagua Node ya Flow A --</option>
                                    {metaNodes.filter(n => n.id !== node.id).map(n => (
                                      <option key={n.id} value={n.id}>{n.data?.label || n.id}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Flow B Target Node</label>
                                  <select
                                    value={node.data?.flowBNodeId || ''}
                                    onChange={(e) => updateNodeData({ flowBNodeId: e.target.value })}
                                    className="w-full text-xs h-8.5 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                                  >
                                    <option value="">-- Chagua Node ya Flow B --</option>
                                    {metaNodes.filter(n => n.id !== node.id).map(n => (
                                      <option key={n.id} value={n.id}>{n.data?.label || n.id}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}

                            {node.type === 'auto_translation' && (
                              <div className="space-y-3 pt-1 border-t border-neutral-100 dark:border-neutral-800/50">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Kutoka Lugha (From Language)</label>
                                  <Input 
                                    value={node.data?.fromLang || 'Kiswahili'}
                                    onChange={(e) => updateNodeData({ fromLang: e.target.value })}
                                    className="h-8.5 text-xs bg-neutral-50/50 dark:bg-neutral-900"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Kwenda Lugha (To Language)</label>
                                  <Input 
                                    value={node.data?.toLang || 'English'}
                                    onChange={(e) => updateNodeData({ toLang: e.target.value })}
                                    className="h-8.5 text-xs bg-neutral-50/50 dark:bg-neutral-900"
                                  />
                                </div>
                              </div>
                            )}

                            {node.type === 'event_automation' && (
                              <div className="space-y-3 pt-1 border-t border-neutral-100 dark:border-neutral-800/50">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Jina la Tukio (Trigger Event Name)</label>
                                  <select
                                    value={node.data?.eventName || 'ride_completed'}
                                    onChange={(e) => updateNodeData({ eventName: e.target.value })}
                                    className="w-full text-xs h-8.5 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                                  >
                                    <option value="ride_completed">🚖 Ride Completed</option>
                                    <option value="payment_success">💳 Payment Success</option>
                                    <option value="order_delivered">🍔 Order Delivered</option>
                                    <option value="birthday">🎂 Customer Birthday</option>
                                  </select>
                                </div>
                              </div>
                            )}

                            {/* Node connection selector (Default Link) */}
                            {node.type !== 'end' && (
                              <div className="space-y-1 pt-3 border-t border-neutral-100 dark:border-neutral-800/50">
                                <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Uunganisho Mkuu (Default Link To Node)</label>
                                <select
                                  value={node.data?.nextNodeId || ''}
                                  onChange={(e) => updateNodeData({ nextNodeId: e.target.value })}
                                  className="w-full text-xs h-8.5 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none font-sans"
                                >
                                  <option value="">-- Mwisho / Hakuna --</option>
                                  {metaNodes.filter(n => n.id !== node.id && n.id !== 'n_start').map(n => (
                                    <option key={n.id} value={n.id}>{n.data?.label || n.id}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                          </div>

                          {/* Quick details summary */}
                          <div className="p-3 bg-neutral-100/50 dark:bg-neutral-950/20 border border-neutral-200/40 dark:border-neutral-800/60 rounded-xl">
                            <span className="text-[8.5px] font-black uppercase tracking-wider text-neutral-400 block mb-1">ID na Aina</span>
                            <div className="flex gap-2 text-[9px] font-mono">
                              <span className="px-1.5 py-0.5 bg-white dark:bg-neutral-900 border rounded font-bold text-neutral-500">ID: {node.id}</span>
                              <span className="px-1.5 py-0.5 bg-fuchsia-500/10 text-fuchsia-600 rounded font-bold uppercase">{node.type}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="text-center py-20 bg-white dark:bg-neutral-950 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 p-6">
                        <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center mx-auto mb-3">
                          <Settings className="w-6 h-6 text-neutral-400" />
                        </div>
                        <h5 className="font-bold text-xs text-neutral-800 dark:text-neutral-200">Hakuna Node iliyochaguliwa</h5>
                        <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed max-w-[200px] mx-auto">Bofya node yoyote kwenye studio flowchart kuanza kufanya marekebisho ya ujumbe, branching au variables.</p>
                      </div>
                    )}
                  </div>

                </div>
                )}
              </CardContent>
            </Card>

            {/* Live Message History */}
            <Card className="border border-neutral-100 dark:border-neutral-800">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2 uppercase tracking-wide dark:text-neutral-100">
                      <MessageSquare className="w-4 h-4 text-indigo-500" />
                      <span>Live Chat Monitor (Papo Hapo AI Log)</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Fuatilia soga za wateja wako wanaowasiliana kupitia WhatsApp, Messenger na Instagram.
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchMetaHistory} 
                    className="h-8 gap-1.5 text-xs font-bold uppercase text-neutral-500 hover:text-indigo-600"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync Live</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                  {metaHistory.length === 0 ? (
                    <div className="text-center py-6 text-xs text-neutral-400">
                      Hakuna ujumbe uliopokelewa bado...
                    </div>
                  ) : (
                    metaHistory.map((chat: any) => {
                      const badgeColor = 
                        chat.channel === 'whatsapp' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400' :
                        chat.channel === 'instagram' ? 'bg-pink-100 text-pink-800 dark:bg-pink-950/50 dark:text-pink-400' :
                        'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-400';
                      
                      return (
                        <div key={chat.id} className="p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-xl space-y-2 text-xs transition-colors hover:bg-neutral-100/50 dark:hover:bg-neutral-850">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${badgeColor}`}>
                                {chat.channel}
                              </span>
                              <span className="font-mono text-[10px] text-neutral-500 font-bold select-all">
                                {chat.senderId}
                              </span>
                            </div>
                            <span className="text-[9px] text-neutral-400">
                              {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-neutral-200/40 dark:border-neutral-800/50">
                            <div>
                              <span className="text-[9px] font-black text-neutral-400 block uppercase tracking-wide">Mteja:</span>
                              <p className="text-neutral-700 dark:text-neutral-300 font-semibold whitespace-pre-wrap">{chat.message}</p>
                            </div>
                            <div className="bg-white dark:bg-neutral-950 p-2 rounded-lg border border-neutral-200/20 dark:border-neutral-800/30">
                              <span className="text-[9px] font-black text-neutral-400 block uppercase tracking-wide">Papo Hapo AI:</span>
                              <p className="text-neutral-850 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed">{chat.reply}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Right panel: Meta physical phone simulator */}
          <div className={`w-full min-w-0 xl:col-span-5 flex flex-col items-center justify-start ${
            mobileViewMode === 'studio' ? 'hidden xl:flex' : 'flex'
          }`}>
            
            {/* Simulator Platform Selector */}
            <div className="flex bg-neutral-100 dark:bg-neutral-900 p-1 rounded-full mb-4 w-full max-w-[320px] sm:max-w-[340px] border border-neutral-200/40 dark:border-neutral-800/60 shadow-inner">
              <button
                onClick={() => setMetaChannel('whatsapp')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-[9.5px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  metaChannel === 'whatsapp' 
                    ? 'bg-emerald-600 text-white shadow-xs' 
                    : 'text-neutral-500 hover:text-emerald-600'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp
              </button>
              <button
                onClick={() => setMetaChannel('messenger')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-[9.5px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  metaChannel === 'messenger' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-neutral-500 hover:text-blue-600'
                }`}
              >
                <Facebook className="w-3.5 h-3.5" />
                Messenger
              </button>
              <button
                onClick={() => setMetaChannel('instagram')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-[9.5px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  metaChannel === 'instagram' 
                    ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-xs' 
                    : 'text-neutral-500 hover:text-pink-500'
                }`}
              >
                <Instagram className="w-3.5 h-3.5" />
                Instagram
              </button>
            </div>

            {/* physical frame wrapper */}
            <div className="relative w-full max-w-[310px] xs:max-w-[330px] sm:max-w-[360px] h-[610px] sm:h-[670px] bg-neutral-950 rounded-[38px] sm:rounded-[48px] p-2.5 sm:p-3.5 shadow-2xl border-2 sm:border-4 border-neutral-800 ring-4 sm:ring-8 md:ring-12 ring-neutral-900/90 flex flex-col justify-between overflow-hidden mx-auto">
              
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[22px] bg-neutral-950 rounded-b-2xl z-50 flex items-center justify-center">
                <div className="w-12 h-1 bg-neutral-800 rounded-full mb-1"></div>
                <div className="w-2.5 h-2.5 bg-neutral-900 rounded-full ml-2 mb-1 border border-neutral-800/20"></div>
              </div>

              {/* Physical side buttons */}
              <div className="absolute -left-[4px] top-28 w-[4px] h-10 bg-neutral-800 rounded-r-xs"></div>
              <div className="absolute -left-[4px] top-44 w-[4px] h-12 bg-neutral-800 rounded-r-xs"></div>
              <div className="absolute -right-[4px] top-36 w-[4px] h-14 bg-neutral-800 rounded-l-xs"></div>

              {/* Smartphone screen canvas */}
              <div className="w-full h-full bg-stone-50 dark:bg-neutral-900/40 rounded-[34px] p-3 pt-6 pb-2.5 flex flex-col justify-between overflow-hidden">
                
                {/* Clock / Carrier bar inside phone */}
                <div className="flex justify-between items-center px-3 pt-1 pb-2 border-b border-neutral-200/60 dark:border-white/5 text-neutral-800 dark:text-neutral-300 font-sans z-20">
                  <span className="text-[10.5px] font-bold">14:05</span>
                  <div className="flex gap-1 items-center">
                    <Wifi className="w-3 h-3 text-emerald-500" />
                    <span className="text-[9px] font-black tracking-widest text-emerald-500">4G</span>
                    <span className="text-[9px] font-medium ml-1">Live</span>
                    <Battery className="w-3.5 h-3.5 ml-0.5 text-orange-500" />
                  </div>
                </div>

                {/* Simulated active channel header with custom background */}
                <div className="py-2 px-1 border-b border-neutral-200/30 dark:border-white/5 flex items-center justify-between shadow-xs bg-white/40 dark:bg-stone-950/20 backdrop-blur-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shadow-inner ${
                      metaChannel === 'whatsapp' ? 'bg-emerald-600' :
                      metaChannel === 'instagram' ? 'bg-gradient-to-tr from-pink-600 to-orange-500' :
                      'bg-blue-600'
                    }`}>
                      {metaChannel === 'whatsapp' ? <MessageCircle className="w-4 h-4" /> :
                       metaChannel === 'instagram' ? <Instagram className="w-4 h-4" /> :
                       <Facebook className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-neutral-800 dark:text-neutral-100 uppercase leading-none tracking-tight">
                        {metaChannel === 'whatsapp' ? 'WhatsApp Business' :
                         metaChannel === 'instagram' ? 'Instagram Bot' :
                         'Messenger Bot'}
                      </h4>
                      <span className="text-[8.5px] text-emerald-500 font-bold tracking-widest uppercase">● Papo Hapo Assistant</span>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleResetMetaChat} 
                    className="w-7 h-7 text-neutral-500 hover:text-red-500 rounded-full"
                    title="Anza Upya"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Scrolling Bubbles Window */}
                <div className="flex-1 overflow-y-auto py-3 px-1.5 space-y-3 scrollbar-none scroll-smooth">
                  <AnimatePresence initial={false}>
                    {metaChatMessages.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.15 }}
                        className={`flex flex-col max-w-[85%] ${msg.sender === 'customer' ? 'ml-auto items-end animate-fade-in' : 'mr-auto items-start animate-fade-in'}`}
                      >
                        <div className={`p-2.5 rounded-2xl text-[11px] leading-relaxed shadow-sm font-sans ${
                          msg.sender === 'customer' 
                            ? (metaChannel === 'whatsapp' ? 'bg-emerald-600 text-white rounded-br-none' :
                               metaChannel === 'instagram' ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-br-none' :
                               'bg-blue-600 text-white rounded-br-none')
                            : 'bg-white dark:bg-neutral-950 dark:text-neutral-100 border border-neutral-100 dark:border-neutral-805 rounded-bl-none text-neutral-800'
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                        <span className="text-[8px] text-neutral-400 font-mono mt-1 px-1">{msg.timestamp}</span>
                      </motion.div>
                    ))}
                    {isLoadingMeta && (
                      <div className="flex flex-col items-start max-w-[80%] mr-auto">
                        <div className="bg-white dark:bg-neutral-950 p-2.5 rounded-2xl rounded-bl-none border border-neutral-100 flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${metaChannel === 'whatsapp' ? 'bg-emerald-600' : 'bg-fuchsia-600'}`} style={{ animationDelay: '0ms' }} />
                          <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${metaChannel === 'whatsapp' ? 'bg-emerald-600' : 'bg-fuchsia-600'}`} style={{ animationDelay: '150ms' }} />
                          <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${metaChannel === 'whatsapp' ? 'bg-emerald-600' : 'bg-fuchsia-600'}`} style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                  </AnimatePresence>
                  <div ref={chatEndRef} />
                </div>

                {/* Preset shortcuts for quick simulation */}
                <div className="pb-1">
                  <span className="text-[8.5px] font-black uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block mb-1 px-1">
                    Bofya Mifano Kuendesha AI Flow:
                  </span>
                  <div className="flex gap-1.5 overflow-x-auto pb-2 pt-0.5 px-0.5 scrollbar-none scroll-smooth">
                    <button
                      onClick={() => sendSimulatedMetaMessage("Habari! Naomba dereva wa Taxi kutoka Posta kwenda Mwenge")}
                      disabled={isLoadingMeta}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-[9px] font-black uppercase tracking-wider whitespace-nowrap active:scale-95 duration-100 shrink-0 select-none cursor-pointer shadow-xs"
                    >
                      🚕 Omba Taxi
                    </button>
                    <button
                      onClick={() => sendSimulatedMetaMessage("Mambo! Nataka kuagiza chakula chips kuku hapa Burger Point")}
                      disabled={isLoadingMeta}
                      className="px-2.5 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-full text-[9px] font-black uppercase tracking-wider whitespace-nowrap active:scale-95 duration-100 shrink-0 select-none cursor-pointer shadow-xs"
                    >
                      🍔 Chips Kuku
                    </button>
                    <button
                      onClick={() => sendSimulatedMetaMessage("Inakuaje! Naomba tiketi ya basi kwenda Mwanza leo")}
                      disabled={isLoadingMeta}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-[9px] font-black uppercase tracking-wider whitespace-nowrap active:scale-95 duration-100 shrink-0 select-none cursor-pointer shadow-xs"
                    >
                      🚌 Basi Mwanza
                    </button>
                    <button
                      onClick={() => sendSimulatedMetaMessage("Natafuta kinyozi wa salon leo Mwenge")}
                      disabled={isLoadingMeta}
                      className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-full text-[9px] font-black uppercase tracking-wider whitespace-nowrap active:scale-95 duration-100 shrink-0 select-none cursor-pointer shadow-xs"
                    >
                      💇‍♀️ Salon Mwenge
                    </button>
                    <button
                      onClick={() => sendSimulatedMetaMessage("Hi! Nahitaji kutuma parcel Posta kwenda Kariakoo")}
                      disabled={isLoadingMeta}
                      className="px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-[9px] font-black uppercase tracking-wider whitespace-nowrap active:scale-95 duration-100 shrink-0 select-none cursor-pointer shadow-xs"
                    >
                      📦 Tuma Parcel
                    </button>
                  </div>
                </div>

                {/* Input form */}
                <form 
                  onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                    e.preventDefault();
                    if (metaInputText.trim()) {
                      sendSimulatedMetaMessage(metaInputText);
                    }
                  }}
                  className="flex gap-1.5 items-center relative z-20 pt-1"
                >
                  <Input
                    value={metaInputText}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMetaInputText(e.target.value)}
                    placeholder="Andika ujumbe hapa..."
                    className="flex-1 bg-white dark:bg-neutral-950 rounded-full h-8 text-[10.5px] px-3.5 focus-visible:ring-fuchsia-500 border-neutral-200/85 pr-10 font-sans"
                  />
                  <Button 
                    type="submit" 
                    size="icon" 
                    disabled={isLoadingMeta || !metaInputText.trim()}
                    className={`w-8 h-8 rounded-full text-white shrink-0 active:scale-90 ${
                      metaChannel === 'whatsapp' ? 'bg-emerald-600 hover:bg-emerald-700' :
                      metaChannel === 'instagram' ? 'bg-gradient-to-r from-pink-500 to-orange-500' :
                      'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </form>

                {/* Bottom navigation line */}
                <div className="w-24 h-1 bg-neutral-900 dark:bg-white/40 rounded-full mx-auto mt-2"></div>
              </div>

            </div>

          </div>

        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 font-sans items-start animate-fade-in">
          
          {/* Left panel: Config, Webhooks, Info */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Intro banner */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white p-6 rounded-2xl shadow-md relative overflow-hidden">
              <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4 scale-150">
                <Smartphone className="w-64 h-64" />
              </div>
              <div className="relative z-10 space-y-2">
                <span className="bg-white/20 text-white font-bold text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full inline-block">
                  INTEGRATION ALIVE (AUTOMATIC WAY)
                </span>
                <h2 className="text-2xl font-black uppercase tracking-tight italic">Twilio SMS Bot</h2>
                <p className="text-sm text-emerald-50/90 leading-relaxed font-normal max-w-xl">
                  Unganisha mfumo wako mzima wa Papo Hapo na huduma za Twilio WhatsApp API na SMS. Wateja wako wanaweza kuagiza Taxi, kukata tiketi za Mabasi, kufanya booking saluni na kuagiza chakula moja kwa moja kupitia WhatsApp na ujumbe wa kawaida wa SMS!
                </p>
              </div>
            </div>

            {/* Webhook Configuration Details */}
            <Card className="border border-neutral-100 hover:shadow-xs transition-shadow duration-300 dark:border-neutral-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2 dark:text-neutral-100 uppercase tracking-wide">
                  <Globe className="w-5 h-5 text-emerald-500" />
                  <span>Sanidi Twilio WhatsApp & SMS Webhook</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Hatua rahisi za kuunganisha namba yako ya Twilio WhatsApp API au SMS:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5 p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/80 rounded-xl">
                  <label className="text-xs font-black uppercase tracking-wider text-neutral-500 block">
                    Twilio Webhook Endpoint URL (Hii inafanya kazi kwa SMS na WhatsApp zote!)
                  </label>
                  <div className="flex gap-2 items-center mt-1">
                    <Input 
                      readOnly 
                      value={`${window.location.origin}/api/twilio/sms`} 
                      className="font-mono text-xs select-all bg-white dark:bg-black h-9 border-neutral-200 py-1"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleCopyWebhook} 
                      className={`h-9 shrink-0 gap-1.5 ${copied ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200'}`}
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {copied ? 'Copied' : 'Copy'}
                      </span>
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-xs space-y-2 text-neutral-600 dark:text-neutral-400 leading-relaxed bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10">
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-[10px]">NJIA A: WhatsApp Integration (Twilio Sandbox)</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Ingia kwenye <a href="https://twilio.com/console" target="_blank" rel="noopener noreferrer" className="underline font-bold text-emerald-600">Twilio Console</a>.</li>
                      <li>Nenda <b>Messaging</b> &gt; <b>Try it out</b> &gt; <b>Send a WhatsApp Message</b>.</li>
                      <li>Tuma ujumbe uliopo (mfano: <i>join sandbox-name</i>) kwenda namba ya WhatsApp ya Twilio Sandbox (<b>+1 415 523 8886</b>).</li>
                      <li>Chini ya sehemu ya <b>Sandbox Settings</b>, weka Webhook URL ya juu kwenye <b>"WHEN A MESSAGE COMES IN"</b>.</li>
                      <li>Chagua njia ya <b>HTTP POST</b> na ubonyeze <b>Save</b>!</li>
                    </ol>
                  </div>

                  <div className="text-xs space-y-2 text-neutral-600 dark:text-neutral-400 leading-relaxed bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
                    <p className="font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider text-[10px]">NJIA B: SMS Integration (Namba za Kawaida)</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Nenda sehemu ya <b>Active Numbers</b> kwenye Twilio.</li>
                      <li>Chagua namba yako ya simu ya kibiashara.</li>
                      <li>Tembea chini mpaka sehemu ya <b>Messaging</b>.</li>
                      <li>Chini ya <b>A MESSAGE COMES IN</b>, weka <b>Webhook</b> na ubandike URL uliyonakili hapo juu.</li>
                      <li>Chagua <b>HTTP POST</b> na ubonyeze <b>Save</b>!</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Global Settings Configuration */}
            <Card className="border border-neutral-100 dark:border-neutral-800">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2 uppercase tracking-wide dark:text-neutral-100">
                  <Settings className="w-5 h-5 text-orange-500" />
                  <span>Auto-Responder Customize</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Sanidi ujumbe wa kwanza kulingana na profile ya biashara yako:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
                  <div className="space-y-0.5">
                    <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 block">Auto-Response Active</span>
                    <span className="text-xs text-neutral-500">Washa mfumo wa kujibu ujumbe kiotomatiki</span>
                  </div>
                  <Button
                    variant={isEnabled ? 'default' : 'outline'}
                    onClick={() => setIsEnabled(!isEnabled)}
                    className={`rounded-full h-8 px-4 font-bold text-xs uppercase tracking-wider transition-all duration-300 ${isEnabled ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'text-neutral-500'}`}
                  >
                    {isEnabled ? 'ACTIVE ●' : 'DISABLED'}
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-widest block">
                    Greeting Message (Meseji ya Kwanza)
                  </label>
                  <Textarea
                    rows={6}
                    value={welcomeText}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setWelcomeText(e.target.value)}
                    placeholder="Karibu kwenye mfumo..."
                    className="text-xs focus-visible:ring-orange-500 border-neutral-200 placeholder:text-neutral-400 font-sans leading-relaxed"
                  />
                  <span className="text-[10px] text-neutral-500 block">
                    Itatumwa kama jibu pale mteja anapotuma neno la mwanzo kama "Habari", "HI", au "Mambo".
                  </span>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-widest block">
                    Test Customer Phone (Namba ya Majaribio)
                  </label>
                  <Input 
                    value={testPhoneNumber}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestPhoneNumber(e.target.value)}
                    placeholder="+255712345678"
                    className="text-xs font-mono select-all bg-white dark:bg-stone-950/80 border-neutral-200 h-9"
                  />
                  <span className="text-[10px] text-neutral-500 block">
                    Namba hii inatumiwa kwenye simulator yetu kulia kuhifadhi soga na session.
                  </span>
                </div>

                <Button 
                  onClick={handleSaveSettings} 
                  className="w-full h-10 mt-2 bg-neutral-900 text-white dark:bg-white dark:text-black font-extrabold text-xs uppercase tracking-widest hover:bg-neutral-800 dark:hover:bg-neutral-100 shrink-0 transition-transform active:scale-[0.98]"
                >
                  Hifadhi Maelezo ya SMS
                </Button>
              </CardContent>
            </Card>

          </div>

          {/* Right panel: SMS Phone Model Simulator */}
          <div className="lg:col-span-5 flex flex-col items-center">
            
            <div className="relative w-full max-w-[340px] h-[670px] bg-neutral-950 rounded-[48px] p-3.5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] border-4 border-neutral-900 ring-12 ring-neutral-900 flex flex-col justify-between overflow-hidden">
              
              {/* Top Notch speaker and camera shape */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[22px] bg-neutral-950 rounded-b-2xl z-50 flex items-center justify-center">
                <div className="w-12 h-1 bg-neutral-800 rounded-full mb-1"></div>
                <div className="w-2.5 h-2.5 bg-neutral-900 rounded-full ml-2 mb-1 border border-neutral-800/20"></div>
              </div>

              {/* Glowing Side buttons simulated shadow/reflection */}
              <div className="absolute -left-[4px] top-28 w-[4px] h-10 bg-neutral-800 rounded-r-xs"></div>
              <div className="absolute -left-[4px] top-44 w-[4px] h-12 bg-neutral-800 rounded-r-xs"></div>
              <div className="absolute -right-[4px] top-36 w-[4px] h-14 bg-neutral-800 rounded-l-xs"></div>

              {/* Smartphone Screen Content Canvas */}
              <div className="w-full h-full bg-stone-50 dark:bg-neutral-900/40 rounded-[34px] p-3 pt-6 pb-2.5 flex flex-col justify-between overflow-hidden selection:bg-orange-500/30">
                
                {/* Screen Header inside Phone */}
                <div className="flex justify-between items-center px-3 pt-1 pb-2 border-b border-neutral-200/60 dark:border-white/5 text-neutral-800 dark:text-neutral-300 font-sans z-20">
                  <span className="text-[10.5px] font-bold">14:05</span>
                  <div className="flex gap-1 items-center">
                    <Wifi className="w-3 h-3 text-emerald-500" />
                    <span className="text-[9px] font-black tracking-widest text-emerald-500">4G</span>
                    <span className="text-[9px] font-medium ml-1">Lipa</span>
                    <Battery className="w-3.5 h-3.5 ml-0.5 text-orange-500" />
                  </div>
                </div>

                {/* Chatbot Thread Contact Info Header */}
                <div className="py-2 px-1 border-b border-neutral-200/30 dark:border-white/5 flex items-center justify-between shadow-xs bg-white/40 dark:bg-stone-950/20 backdrop-blur-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-600 to-orange-500 flex items-center justify-center text-white text-xs font-black shadow-inner">
                      P
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-neutral-800 dark:text-neutral-100 uppercase leading-none tracking-tight">Papo Hapo Bot</h4>
                      <span className="text-[8.5px] text-emerald-500 font-bold tracking-widest uppercase">● SMS Auto-Responder</span>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleResetChat} 
                    className="w-7 h-7 text-neutral-500 hover:text-red-500 rounded-full"
                    title="Reset Chat"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Scrolling Bubbles Window (Custom Scrollbar) */}
                <div className="flex-1 overflow-y-auto py-3 px-1.5 space-y-3 scrollbar-none scroll-smooth">
                  <AnimatePresence initial={false}>
                    {chatMessages.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.15 }}
                        className={`flex flex-col max-w-[85%] ${msg.sender === 'customer' ? 'ml-auto items-end animate-fade-in' : 'mr-auto items-start animate-fade-in'}`}
                      >
                        <div className={`p-2.5 rounded-2xl text-[11px] leading-relaxed shadow-sm font-sans ${
                          msg.sender === 'customer' 
                            ? 'bg-orange-600 text-white rounded-br-none' 
                            : 'bg-white dark:bg-neutral-950 dark:text-neutral-100 border border-neutral-100 dark:border-neutral-805 rounded-bl-none text-neutral-800'
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                        <span className="text-[8px] text-neutral-400 font-mono mt-1 px-1">{msg.timestamp}</span>
                      </motion.div>
                    ))}
                    {isLoading && (
                      <div className="flex flex-col items-start max-w-[80%] mr-auto">
                        <div className="bg-white dark:bg-neutral-950 p-2.5 rounded-2xl rounded-bl-none border border-neutral-100 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                  </AnimatePresence>
                  <div ref={chatEndRef} />
                </div>

                {/* Quick SMS Presets Toolbar */}
                <div className="pb-1">
                  <span className="text-[8.5px] font-black uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block mb-1 px-1">
                    Bofya kuendesha Flow Jaribio:
                  </span>
                  <div className="flex gap-1.5 overflow-x-auto pb-2 pt-0.5 px-0.5 scrollbar-none scroll-smooth">
                    {presetShortcuts.map((sc, i) => (
                      <button
                        key={i}
                        onClick={() => sendSimulatedMessage(sc.text)}
                        disabled={isLoading}
                        className={`px-2.5 py-1.5 rounded-full text-[9.5px] font-black uppercase tracking-wider text-white whitespace-nowrap active:scale-95 duration-100 shrink-0 select-none shadow-xs cursor-pointer ${sc.color}`}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Simulated Keyboard Text Input Form */}
                <form 
                  onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                    e.preventDefault();
                    if (inputText.trim()) {
                      sendSimulatedMessage(inputText);
                    }
                  }}
                  className="flex gap-1.5 items-center relative z-20 pt-1"
                >
                  <Input
                    value={inputText}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputText(e.target.value)}
                    placeholder="Andika SMS hapa..."
                    className="flex-1 bg-white dark:bg-neutral-950 rounded-full h-8 text-[10.5px] px-3.5 focus-visible:ring-orange-500 border-neutral-200/80 pr-10 font-sans"
                  />
                  <Button 
                    type="submit" 
                    size="icon" 
                    disabled={isLoading || !inputText.trim()}
                    className="w-8 h-8 rounded-full bg-orange-600 text-white shrink-0 active:scale-90 hover:bg-orange-700"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </form>

                {/* Bottom Screen Navigation Bar */}
                <div className="w-24 h-1 bg-neutral-900 dark:bg-white/40 rounded-full mx-auto mt-2"></div>
              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
};
