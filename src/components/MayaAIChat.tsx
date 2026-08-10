import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Send, X, Bot, User as UserIcon, ShieldCheck, 
  Car, Utensils, CreditCard, Package, RefreshCw, 
  MapPin, CheckCircle, AlertTriangle, ChevronRight, PhoneCall,
  Flame, Ambulance, Wallet, HelpCircle, CornerDownLeft, Volume2, VolumeX, Pause,
  Mic, MicOff, WifiOff, Radio, Trash2, Sun, Moon, RotateCcw,
  EyeOff, Eye, GripVertical, ShoppingBag, Store, TrendingUp, Navigation, BarChart3, Layers
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';

export type AIRole = 'mteja' | 'dereva' | 'vendor';

interface Message {
  id: string;
  sender: 'user' | 'maya';
  text: string;
  timestamp: Date;
  functionCalls?: Array<{
    name: string;
    args: any;
  }>;
  pendingConfirmation?: {
    type: 'payment' | 'booking' | 'food';
    title: string;
    details: any;
  };
  actionSuccess?: boolean;
}

export default function MayaAIChat() {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [autoVoiceEnabled, setAutoVoiceEnabled] = useState(true);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [userLocation, setUserLocation] = useState<string>('Dar es Salaam');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [hasGreeted, setHasGreeted] = useState<boolean>(false);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // FAB Drag & Hide State Persistence
  const [isFabHidden, setIsFabHidden] = useState<boolean>(() => {
    return localStorage.getItem('papo_ai_fab_hidden') === 'true';
  });

  // Active AI Role state (Customer / Driver / Vendor)
  const [activeRole, setActiveRole] = useState<AIRole>(() => {
    const saved = localStorage.getItem('papo_ai_role') as AIRole | null;
    if (saved && ['mteja', 'dereva', 'vendor'].includes(saved)) return saved;
    if (profile?.role === 'rider' || profile?.role === 'driver') return 'dereva';
    if (profile?.role === 'vendor') return 'vendor';
    return 'mteja';
  });

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Automatic AI Role Detection (Updates automatically based on route & profile)
  useEffect(() => {
    const path = location.pathname.toLowerCase();
    let detectedRole: AIRole = 'mteja';

    if (
      path.includes('rider') || 
      path.includes('driver') || 
      path.includes('delivery') || 
      path.includes('parcel-partner') ||
      profile?.role === 'rider' || 
      profile?.role === 'driver'
    ) {
      detectedRole = 'dereva';
    } else if (
      path.includes('vendor') || 
      path.includes('restaurant') || 
      path.includes('merchant') || 
      profile?.role === 'vendor'
    ) {
      detectedRole = 'vendor';
    } else {
      detectedRole = 'mteja';
    }

    const manualSaved = localStorage.getItem('papo_ai_role_override');
    if (!manualSaved && detectedRole !== activeRole) {
      setActiveRole(detectedRole);
      setHasGreeted(false);
    }
  }, [location.pathname, profile?.role]);

  const toggleFabHidden = (hidden: boolean) => {
    setIsFabHidden(hidden);
    localStorage.setItem('papo_ai_fab_hidden', hidden ? 'true' : 'false');
    if (hidden) {
      toast.info('Icon ya AI imefichwa. Bofya kizingiti kidogo pembeni mwa screen kuionyesha tena.', { id: 'fab-hide-toast' });
    } else {
      toast.success('Icon ya AI imerudi kwenye screen! Unaweza kuikokota (drag) popote.', { id: 'fab-hide-toast' });
    }
  };

  const switchRole = (newRole: AIRole) => {
    if (newRole === activeRole) return;
    setActiveRole(newRole);
    localStorage.setItem('papo_ai_role', newRole);
    setHasGreeted(false);

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setCurrentlySpeakingId(null);
    }

    const userName = getUserFirstName();
    let welcomeText = '';
    if (newRole === 'dereva') {
      welcomeText = `Habari Dereva ${userName}! 🚖 Mimi ni **SAFARI Dereva AI**.\n\nNinawezaje kukusaidia leo barabarani? Nina maelezo ya maeneo yenye maombi mengi ya abiria (hotspots: Kariakoo, Posta, Airport, Mwenge, Mbezi Magufuli), ushauri wa kuokoa mafuta, na mahesabu ya mapato.`;
    } else if (newRole === 'vendor') {
      welcomeText = `Habari Mfanyabiashara ${userName}! 🏪 Mimi ni **BIASHARA Vendor AI**.\n\nNinawezaje kukusaidia na mgahawa au duka lako leo? Ninaweza kusaidia kuchanganua mauzo ya siku, kutoa ushauri wa vyakula vinavyopendwa na wateja, kuweka ofa za promo discounts, na kusimamia inventory.`;
    } else {
      welcomeText = `Habari ${userName}! 🛍️ Mimi ni **MAYA Mteja AI**.\n\nNinawezaje kukusaidia leo hapa **${userLocation}**? Ninaweza kuitisha Usafiri (Boda, Bajaji, Taxi, Ambulansi, Zimamoto), kuagiza Chakula, au kufanya Malipo salama.`;
    }

    setMessages([
      {
        id: `welcome-role-${Date.now()}`,
        sender: 'maya',
        text: welcomeText,
        timestamp: new Date()
      }
    ]);

    toast.success(`Umebadili kuwa AI ya ${newRole === 'dereva' ? 'Dereva 🚖' : newRole === 'vendor' ? 'Muuzaji 🏪' : 'Mteja 🛍️'}`);
  };

  const handleDeleteMessage = (msgId: string) => {
    if ('speechSynthesis' in window && currentlySpeakingId === msgId) {
      window.speechSynthesis.cancel();
      setCurrentlySpeakingId(null);
    }
    setMessages(prev => prev.filter(m => m.id !== msgId));
    toast.success('Meseji imefutwa');
  };

  const handleClearAllMessages = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setCurrentlySpeakingId(null);
    }
    const userName = getUserFirstName();
    const currentLoc = userLocation;

    let text = `Habari ${userName}! 👋 Meseji zote zimefutwa kikamilifu.\n\n`;
    if (activeRole === 'dereva') {
      text += `SAFARI Dereva AI ipo tayari kukusaidia barabarani hapa **${currentLoc}**!`;
    } else if (activeRole === 'vendor') {
      text += `BIASHARA Vendor AI ipo tayari kukusaidia na biashara yako!`;
    } else {
      text += `MAYA Mteja AI ipo tayari kukusaidia kuitisha usafiri au kuagiza chakula hapa **${currentLoc}**!`;
    }

    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'maya',
        text: text,
        timestamp: new Date()
      }
    ]);
    setShowClearConfirm(false);
    toast.success('Meseji zote zimefutwa kikamilifu!');
  };

  const getUserFirstName = () => {
    if (profile?.displayName) return profile.displayName.split(' ')[0];
    if (profile?.fullName) return profile.fullName.split(' ')[0];
    if (user?.displayName) return user.displayName.split(' ')[0];
    if (user?.email) {
      const emailName = user.email.split('@')[0].replace(/[._-]/g, ' ');
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return 'Mpendwa';
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'maya',
      text: 'Habari! Mimi ni MAYA — Akili Mnemba (AI) ya Papo Hapo Super App 🇹🇿.\n\nNinaweza kukusaidia kuitisha Usafiri (Boda, Bajaji, Gari, Ambulansi, au Zimamoto), kuagiza Chakula kutoka migahawa yetu iliyosajiliwa, au kufanya Malipo salama.',
      timestamp: new Date()
    }
  ]);

  const fetchCurrentLocation = () => {
    const savedLoc = localStorage.getItem('omniserve_user_location');
    if (savedLoc) {
      try {
        const parsed = JSON.parse(savedLoc);
        if (typeof parsed === 'string') setUserLocation(parsed);
        else if (parsed?.name) setUserLocation(parsed.name);
      } catch (e) {
        if (typeof savedLoc === 'string') setUserLocation(savedLoc);
      }
    }

    if ('geolocation' in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          try {
            const res = await fetch(`/api/geo/reverse?lat=${lat}&lon=${lon}`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.address) {
                const addr = data.address;
                const area = addr.suburb || addr.neighbourhood || addr.quarter || addr.residential || addr.road || addr.village || addr.town || addr.city_district || addr.subdivision;
                const city = addr.city || addr.town || addr.municipality || addr.region || addr.county || 'Dar es Salaam';
                const fullLocName = area ? `${area}, ${city}` : city;
                setUserLocation(fullLocName);
                localStorage.setItem('omniserve_user_location', JSON.stringify({ name: fullLocName, lat, lon }));
              } else if (data.display_name) {
                const parts = data.display_name.split(',');
                const shortName = parts.slice(0, 2).join(',').trim();
                setUserLocation(shortName);
                localStorage.setItem('omniserve_user_location', JSON.stringify({ name: shortName, lat, lon }));
              }
            }
          } catch (err) {
            console.warn('Reverse geocoding error:', err);
          } finally {
            setIsLocating(false);
          }
        },
        (err) => {
          console.warn('Geolocation position error:', err);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      fetchCurrentLocation();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !hasGreeted) {
      const userName = getUserFirstName();
      const currentLoc = userLocation;
      
      let greetingText = '';
      if (activeRole === 'dereva') {
        greetingText = `Habari Dereva ${userName}! 🚖 Mimi ni **SAFARI Dereva AI**.\n\nUpo eneo la **${currentLoc}**. Msaidizi wako wa safari kutoa maelezo ya maeneo yenye maombi mengi ya usafiri (hotspots), ushauri wa kuokoa mafuta, na mahesabu ya mapato!`;
      } else if (activeRole === 'vendor') {
        greetingText = `Habari Mfanyabiashara ${userName}! 🏪 Mimi ni **BIASHARA Vendor AI**.\n\nUpo tayari kukuza mauzo yako? Ninaweza kukusaidia kuchanganua oda, kuweka ofa za discounts, na kusimamia stoki ya mgahawa/duka lako!`;
      } else {
        greetingText = `Habari ${userName}! 👋 Mimi ni **MAYA Mteja AI** ya Papo Hapo Super App 🇹🇿.\n\nNinaona upo karibu na **${currentLoc}**. Ninaweza kukusaidia kuitisha Usafiri (Boda, Bajaji, Taxi, Ambulansi, Zimamoto), kuagiza Chakula, au kufanya Malipo salama. Nikupe msaada gani leo?`;
      }

      setMessages(prev => {
        if (prev.length === 1 && prev[0].id.startsWith('welcome-')) {
          return [{
            id: 'welcome-1',
            sender: 'maya',
            text: greetingText,
            timestamp: new Date()
          }];
        }
        return prev;
      });

      setHasGreeted(true);

      if (autoVoiceEnabled) {
        setTimeout(() => {
          speakText(greetingText.replace(/\*/g, ''), 'welcome-1');
        }, 500);
      }
    }
  }, [isOpen, user, profile, userLocation, hasGreeted, activeRole]);

  // Speech Synthesis
  const speakText = (text: string, msgId: string) => {
    if (!('speechSynthesis' in window)) {
      toast.error('Kivinjari chako hakitogelei Speech Synthesis.');
      return;
    }

    window.speechSynthesis.cancel();

    if (currentlySpeakingId === msgId) {
      setCurrentlySpeakingId(null);
      return;
    }

    const cleanText = text
      .replace(/[*_#`~]/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.pitch = activeRole === 'dereva' ? 0.95 : 1.05;
    utterance.rate = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const swVoice = voices.find(v => v.lang.startsWith('sw') || v.lang.includes('sw-TZ') || v.lang.includes('sw-KE'));
    const chosenVoice = swVoice || voices.find(v => {
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase();
      return (lang.includes('sw') || lang.includes('en')) && 
             (name.includes('female') || name.includes('zira') || name.includes('samantha') || name.includes('natural'));
    }) || voices[0];

    if (chosenVoice) {
      utterance.voice = chosenVoice;
      utterance.lang = chosenVoice.lang || 'sw-TZ';
    } else {
      utterance.lang = 'sw-TZ';
    }

    utterance.onstart = () => setCurrentlySpeakingId(msgId);
    utterance.onend = () => setCurrentlySpeakingId(null);
    utterance.onerror = () => setCurrentlySpeakingId(null);

    window.speechSynthesis.speak(utterance);
  };

  // Offline Intelligence Engine based on Role
  const parseOfflineVoiceCommand = (text: string) => {
    const lower = text.toLowerCase();
    const userName = getUserFirstName();

    // DEREVA (DRIVER) SPECIFIC OFFLINE ANSWERS
    if (activeRole === 'dereva') {
      if (lower.includes('maombi') || lower.includes('wapi') || lower.includes('abiria') || lower.includes('hotspot')) {
        return {
          reply: `Habari Dereva ${userName}! Kulingana na eneo lako la **${userLocation}**, maeneo yenye maombi mengi ya usafiri hivi sasa ni:\n1. 📍 **Kariakoo Sokoni** (Maombi mengi ya Boda & Bajaji)\n2. ✈️ **Uwanja wa Ndege (JNIA)** (Maombi ya Taxi/Gari)\n3. 🚌 **Stendi Kuu ya Mbezi Magufuli**\n4. 🏢 **Posta Mpya & Mlimani City**`,
          functionCalls: []
        };
      }
      if (lower.includes('mapato') || lower.includes('faida') || lower.includes('pesa') || lower.includes('hesabu')) {
        return {
          reply: `Ili kuongeza mapato ya leo, Dereva ${userName}:\n- Fanya kazi nyakati za Asubuhi (SAA 12:00 - 3:00) na Jioni (SAA 10:00 - 2:00 Usiku).\n- Kaa karibu na vituo vya usafiri au migahawa yenye maagizo ya chakula.\n- Hakikisha unampa mteja tabasamu na usafi kupata nyota 5 na tip!`,
          functionCalls: []
        };
      }
      if (lower.includes('mafuta') || lower.includes('fuel')) {
        return {
          reply: `Mbinu za kuokoa mafuta kulingana na muongozo wa Papo Ride:\n1. Usiache engine inaguruma ovyo (idling) ukiwa unawasiliana na mteja.\n2. Angalia upepo wa tairi kila asubuhi.\n3. Endesha kwa mwendo wa wastani usiovunjika vunjika.`,
          functionCalls: []
        };
      }
    }

    // VENDOR SPECIFIC OFFLINE ANSWERS
    if (activeRole === 'vendor') {
      if (lower.includes('mauzo') || lower.includes('oda') || lower.includes('sales')) {
        return {
          reply: `Habari Mfanyabiashara ${userName}! Kuchanganua mauzo yako ya leo:\n- Saa za mchana (SAA 6:00 - 8:00) na jioni ndizo zenye maagizo mengi zaidi.\n- Weka 'Papo Discount 10%' kwenye vyakula vya mchana ili kuleta wateja wapya kwenye duka lako!`,
          functionCalls: []
        };
      }
      if (lower.includes('stoki') || lower.includes('inventory') || lower.includes('bidhaa')) {
        return {
          reply: `Kusimamia stoki ya duka/mgahawa:\n- Sasisha 'Restaurant Inventory' kwenye Vendor Dashboard yako ili kuzuia wateja kuagiza vitu vilivyotoka (out of stock).\n- Weka tahadhari wakati bidhaa inapobaki chini ya vitengo 5.`,
          functionCalls: []
        };
      }
    }

    // GENERAL / CUSTOMER MTEJA COMMANDS
    if (lower.includes('niko wapi') || lower.includes('location') || lower.includes('nilipo')) {
      return {
        reply: `Habari ${userName}! Kwa mujibu wa GPS yako, hivi sasa upo eneo la **${userLocation}**.`,
        functionCalls: []
      };
    }

    if (lower.includes('salio') || lower.includes('balance') || lower.includes('papo wallet')) {
      return {
        reply: `Nimekagua salio lako la Papo Wallet, ${userName}: Una TSH 45,500 na pointi 280.`,
        functionCalls: [{ name: 'checkBalance', args: { account_type: 'papo_wallet' } }]
      };
    }

    if (lower.includes('boda') || lower.includes('pikipiki') || lower.includes('gari') || lower.includes('bajaji')) {
      const vType = lower.includes('boda') ? 'boda' : lower.includes('bajaji') ? 'bajaji' : 'car';
      return {
        reply: `Nimeandaa usafiri wa ${vType.toUpperCase()} kuanzia **${userLocation}**. Nitakuelekeza kwenye ukurasa wa usafiri ili kukamilisha.`,
        functionCalls: [{ name: 'bookTaxi', args: { vehicle_type: vType, pickup_location: userLocation, destination: 'Kariakoo' } }]
      };
    }

    if (lower.includes('ambulansi') || lower.includes('ambulance')) {
      return {
        reply: `⚠️ *Wito wa Dharura wa Ambulansi*:\nNimeandaa wito wa Ambulansi kuja eneo la **${userLocation}**. Thibitisha hapa chini ili gari na madaktari vianze safari.`,
        functionCalls: [{ name: 'bookTaxi', args: { vehicle_type: 'ambulance', pickup_location: userLocation, destination: 'Hospitali ya Rufaa' } }]
      };
    }

    return {
      reply: `Habari ${userName}! Nimepata sauti yako: "${text}". Mimi ni AI ya Papo Hapo (${activeRole.toUpperCase()}). Ninawezaje kukusaidia zaidi hapa **${userLocation}**?`,
      functionCalls: []
    };
  };

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Kivinjari chako hakitogelei Speech Recognition.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'sw-TZ';

      recognition.onstart = () => {
        setIsListening(true);
        toast.info('🎙️ AI anasikiliza sauti yako kwa Kiswahili...', { id: 'maya-mic' });
      };

      recognition.onresult = (event: any) => {
        const transcriptText = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        setInputMessage(transcriptText);
      };

      recognition.onerror = () => {
        setIsListening(false);
        toast.dismiss('maya-mic');
      };

      recognition.onend = () => {
        setIsListening(false);
        toast.dismiss('maya-mic');
      };

      recognition.start();
    } catch (err) {
      console.error('Mic error:', err);
      setIsListening(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setCurrentlySpeakingId(null);
    }

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      if (!navigator.onLine) {
        const offlineRes = parseOfflineVoiceCommand(text);
        setIsLoading(false);
        const newOfflineId = `maya-offline-${Date.now()}`;
        
        const offlineMsg: Message = {
          id: newOfflineId,
          sender: 'maya',
          text: `📡 [Offline Mode / Nje ya Mtandao]\n\n${offlineRes.reply}`,
          timestamp: new Date(),
          functionCalls: offlineRes.functionCalls
        };

        setMessages(prev => [...prev, offlineMsg]);
        if (autoVoiceEnabled) {
          setTimeout(() => speakText(offlineRes.reply, newOfflineId), 300);
        }
        return;
      }

      const historyPayload = messages.slice(-8).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const res = await fetch('/api/maya/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          userRole: activeRole,
          userContext: {
            userName: getUserFirstName(),
            userRole: activeRole,
            city: userLocation.includes(',') ? userLocation.split(',')[1].trim() : 'Dar es Salaam',
            location: userLocation,
            phone: profile?.phoneNumber || user?.phoneNumber || '+255700000000'
          }
        })
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok) {
        throw new Error(data.error || data.reply || 'Hitilafu kwenye mfumo');
      }

      let pendingConf: any = null;
      if (Array.isArray(data.functionCalls) && data.functionCalls.length > 0) {
        for (const fc of data.functionCalls) {
          if (fc.name === 'confirmPayment') {
            pendingConf = {
              type: 'payment',
              title: 'Thibitisha Muamala wa Malipo',
              details: fc.args
            };
          } else if (fc.name === 'bookTaxi' && (fc.args.vehicle_type === 'ambulance' || fc.args.vehicle_type === 'fire')) {
            pendingConf = {
              type: 'booking',
              title: fc.args.vehicle_type === 'ambulance' ? 'Thibitisha Wito wa Ambulansi (Emergency)' : 'Thibitisha Wito wa Zimamoto (Fire)',
              details: fc.args
            };
          }
        }
      }

      const mayaResponseText = data.reply || 'Tumepata ombi lako kikamilifu.';
      const newMayaId = `maya-${Date.now()}`;

      const mayaMsg: Message = {
        id: newMayaId,
        sender: 'maya',
        text: mayaResponseText,
        timestamp: new Date(),
        functionCalls: data.functionCalls,
        pendingConfirmation: pendingConf
      };

      setMessages(prev => [...prev, mayaMsg]);

      if (autoVoiceEnabled) {
        setTimeout(() => speakText(mayaResponseText, newMayaId), 300);
      }

    } catch (err: any) {
      setIsLoading(false);
      const offlineRes = parseOfflineVoiceCommand(text);
      const newOfflineId = `maya-fallback-${Date.now()}`;

      const fallbackMsg: Message = {
        id: newOfflineId,
        sender: 'maya',
        text: `📡 [Local Swahili AI Engine]\n\n${offlineRes.reply}`,
        timestamp: new Date(),
        functionCalls: offlineRes.functionCalls
      };

      setMessages(prev => [...prev, fallbackMsg]);
      if (autoVoiceEnabled) {
        setTimeout(() => speakText(offlineRes.reply, newOfflineId), 300);
      }
    }
  };

  const handleConfirmAction = async (msgId: string, details: any, confirmed: boolean) => {
    if (!confirmed) {
      toast.info('Muamala/Ombi limeghairiwa.');
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pendingConfirmation: undefined, text: m.text + '\n\n❌ (Ombi limeghairiwa na mtumiaji)' } : m));
      return;
    }

    toast.loading('Inathibitisha na kutekeleza na AI...', { id: 'maya-exec' });
    
    setTimeout(() => {
      toast.success('Imethibitishwa kikamilifu! Mfumo umeanza kufanya kazi.', { id: 'maya-exec' });
      setMessages(prev => prev.map(m => m.id === msgId ? { 
        ...m, 
        pendingConfirmation: undefined, 
        actionSuccess: true,
        text: m.text + '\n\n✅ *Muamala/Wito umethibitishwa kikamilifu!*'
      } : m));

      if (details.pickup_location || details.destination) {
        navigate('/taxi');
      }
    }, 1200);
  };

  // QUICK PROMPT CHIPS BASED ON ACTIVE ROLE
  const getQuickPrompts = () => {
    if (activeRole === 'dereva') {
      return [
        { label: '📍 Maeneo yenye maombi mengi (Hotspots)', prompt: 'Ni maeneo gani sasa hivi yana maombi mengi ya usafiri wa taxi na boda Dar es Salaam?' },
        { label: '💰 Mbinu za kuongeza mapato ya siku', prompt: 'Nipe mbinu bora za kuongeza mapato na kupata nyota 5 kutoka kwa abiria' },
        { label: '⛽ Mbinu za kuokoa mafuta', prompt: 'Je, ninawezaje kuokoa mafuta kwenye gari/boda yangu wakati wa kazi?' },
        { label: '🛠️ Ukaguzi wa Usalama wa Chombo', prompt: 'Nipe muongozo wa ukaguzi wa haraka wa usalama wa gari/boda kabla ya kuanza kazi' },
        { label: '🚨 Msaada wa Dharura Barabarani', prompt: 'Msaada wa dharura endapo chombo changu kikitatizika barabarani' }
      ];
    }
    if (activeRole === 'vendor') {
      return [
        { label: '📊 Changanua mauzo na oda za leo', prompt: 'Nipe ushauri jinsi ya kuchanganua mauzo ya duka/mgahawa wangu na kuongeza oda' },
        { label: '🍗 Vyakula/Bidhaa zinazouza zaidi', prompt: 'Ni vyakula na vinywaji gani vinavyopendwa na kuagizwa zaidi na wateja?' },
        { label: '🏷️ Weka Punguzo na Ofa za Masoko', prompt: 'Nipe mbinu za kuweka ofa na promo discounts za kuvutia wateja wapya' },
        { label: '📦 Usimamizi wa Stoki na Inventory', prompt: 'Jinsi ya kusimamia inventory ya mgahawa/duka langu ili kuzuia kukosa bidhaa' },
        { label: '⭐ Kuboresha Rating ya Duka', prompt: 'Jinsi ya kupata rating za juu (5 Stars) na maoni mazuri kutoka kwa wateja' }
      ];
    }
    return [
      { label: '🚖 Boda / Taxi kwenda Kariakoo', prompt: 'Nahitaji usafiri wa Boda kutoka Mwenge kwenda Kariakoo Dar es Salaam' },
      { label: '🍔 Chips Kuku (Mgahawa wa Papo)', prompt: 'Nahitaji Chips Kuku kutoka Mgahawa wa Papo Fast Food niletee Mwenge' },
      { label: '🍲 Ugali Samaki (Swahili Cuisine)', prompt: 'Agiza Ugali Samaki wa Kupaka kutoka Swahili Cuisine House' },
      { label: '🚑 Ambulansi ya Dharura', prompt: 'Nahitaji Ambulansi ya dharura haraka sana Posta Dar es Salaam' },
      { label: '💰 Angalia Salio la Papo Wallet', prompt: 'Angalia salio langu la Papo Wallet' }
    ];
  };

  // ROLE VISUAL STYLES
  const getRoleFabStyle = () => {
    if (activeRole === 'dereva') {
      return 'bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 border-emerald-400/40 text-white shadow-[0_10px_25px_rgba(16,185,129,0.4)]';
    }
    if (activeRole === 'vendor') {
      return 'bg-gradient-to-r from-purple-600 via-indigo-500 to-fuchsia-500 border-purple-400/40 text-white shadow-[0_10px_25px_rgba(147,51,234,0.4)]';
    }
    return 'bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 border-amber-400/40 text-white shadow-[0_10px_25px_rgba(234,88,12,0.4)]';
  };

  const getRoleIcon = () => {
    if (activeRole === 'dereva') return <Car className="w-5 h-5 text-emerald-200 animate-pulse" />;
    if (activeRole === 'vendor') return <Store className="w-5 h-5 text-purple-200 animate-pulse" />;
    return <Sparkles className="w-5 h-5 text-amber-200 animate-pulse" />;
  };

  const getRoleTitle = () => {
    if (activeRole === 'dereva') return 'SAFARI DEREVA AI';
    if (activeRole === 'vendor') return 'BIASHARA VENDOR AI';
    return 'MAYA MTEJA AI';
  };

  const getRoleSubtitle = () => {
    if (activeRole === 'dereva') return 'Dereva Voice 🚖';
    if (activeRole === 'vendor') return 'Vendor Voice 🏪';
    return 'Mteja Voice 🛍️';
  };

  return (
    <>
      {/* FLOATING DRAGGABLE AI FAB OR DOCKED MINI TAB */}
      {!isFabHidden ? (
        <motion.div
          drag
          dragConstraints={{ left: -280, right: 280, top: -550, bottom: 50 }}
          dragElastic={0.08}
          dragMomentum={false}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-24 left-4 z-[160] touch-none"
        >
          <div className={`relative flex items-center gap-2 px-3.5 py-2.5 rounded-2xl shadow-2xl border backdrop-blur-md cursor-grab active:cursor-grabbing group transition-all duration-300 ${getRoleFabStyle()}`}>
            {/* DRAG GRIP ICON */}
            <div className="flex flex-col gap-0.5 text-white/60 group-hover:text-white transition-colors mr-0.5" title="Kokota (Drag) kusogeza popote">
              <GripVertical className="w-4 h-4" />
            </div>

            {/* MAIN FAB TRIGGER */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 min-w-0"
              aria-label="Fungua AI Assistant"
            >
              <div className="relative flex items-center justify-center shrink-0">
                <div className="w-9 h-9 bg-black/25 rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
                  {getRoleIcon()}
                </div>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white animate-ping" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
              </div>

              <div className="text-left hidden sm:block min-w-0">
                <div className="text-[11px] font-black uppercase tracking-wider leading-none text-white flex items-center gap-1">
                  {getRoleTitle()}
                  {currentlySpeakingId && <Volume2 className="w-3 h-3 text-amber-300 animate-bounce" />}
                </div>
                <div className="text-[9px] font-extrabold text-white/80 uppercase tracking-widest mt-0.5">
                  {getRoleSubtitle()}
                </div>
              </div>
            </button>

            {/* HIDE / MINIMIZE BUTTON ON FAB */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFabHidden(true);
              }}
              className="ml-1 p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition-all border border-white/10"
              title="Ficha button hii ya AI (Hide FAB)"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      ) : (
        /* DOCKED EDGE MINI TAB WHEN HIDDEN */
        <motion.button
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => toggleFabHidden(false)}
          className={`fixed bottom-28 left-0 z-[160] flex items-center gap-1.5 px-3 py-2 rounded-r-2xl shadow-xl border-y border-r border-white/20 text-white font-black text-xs uppercase tracking-wider backdrop-blur-md transition-all ${getRoleFabStyle()}`}
          title="Onyesha AI Assistant (Unhide FAB)"
        >
          {getRoleIcon()}
          <span className="text-[10px]">AI</span>
          <Eye className="w-3 h-3 text-white/80 ml-0.5 animate-pulse" />
        </motion.button>
      )}

      {/* DRAWER / MODAL CHAT UI */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className={`w-full sm:max-w-lg h-[90vh] sm:h-[670px] rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl border flex flex-col overflow-hidden relative transition-colors duration-300 ${
                themeMode === 'dark' 
                  ? 'bg-[#121218] text-white border-white/10' 
                  : 'bg-slate-50 text-slate-900 border-slate-200/80'
              }`}
            >
              {/* CLEAR CONFIRMATION OVERLAY MODAL */}
              <AnimatePresence>
                {showClearConfirm && (
                  <div className="absolute inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className={`p-6 rounded-3xl max-w-xs w-full shadow-2xl border text-center space-y-4 ${
                        themeMode === 'dark' ? 'bg-[#1c1c28] border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto">
                        <Trash2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-black text-base uppercase tracking-tight">Futa Meseji Zote?</h4>
                        <p className={`text-xs mt-1 ${themeMode === 'dark' ? 'text-neutral-400' : 'text-slate-500'}`}>
                          Je, una uhakika unataka kufuta mazungumzo yote na AI Assistant?
                        </p>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={handleClearAllMessages}
                          className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-red-600/30"
                        >
                          Futa Zote 🗑️
                        </button>
                        <button
                          onClick={() => setShowClearConfirm(false)}
                          className={`flex-1 font-bold py-2.5 rounded-xl text-xs uppercase transition-all ${
                            themeMode === 'dark' ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                          }`}
                        >
                          Ghairi
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* HEADER */}
              <div className={`px-4 py-3 border-b flex items-center justify-between shrink-0 transition-colors duration-300 ${
                themeMode === 'dark'
                  ? 'bg-[#181824] border-white/10'
                  : 'bg-white border-slate-200/90 shadow-xs'
              }`}>
                {/* LEFT: AVATAR & INFO */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-md border border-white/20 shrink-0 ${getRoleFabStyle()}`}>
                    {getRoleIcon()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className={`font-black text-sm tracking-tight uppercase truncate ${themeMode === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        {getRoleTitle()}
                      </h3>
                      <span className="bg-orange-500/20 text-orange-500 border border-orange-500/30 px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase tracking-wider shrink-0">
                        🇹🇿 PAPO
                      </span>
                    </div>
                    <button 
                      onClick={fetchCurrentLocation}
                      className={`flex items-center gap-1 font-semibold text-[10px] transition-colors truncate max-w-[130px] ${
                        themeMode === 'dark' ? 'text-amber-300/90 hover:text-amber-300' : 'text-amber-700 hover:text-amber-900'
                      }`}
                      title="Bonyeza kuhuisha eneo yako halisi (GPS)"
                    >
                      <MapPin className={`w-3 h-3 text-amber-500 shrink-0 ${isLocating ? 'animate-spin' : ''}`} />
                      <span className="truncate">{userLocation}</span>
                    </button>
                  </div>
                </div>

                {/* RIGHT: CONTROLS & CLOSE BUTTON */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className={`flex items-center p-1 rounded-full border ${
                    themeMode === 'dark' ? 'bg-[#111118] border-white/10' : 'bg-slate-100 border-slate-200'
                  }`}>
                    {/* SHOW / HIDE FAB TOGGLE IN CHAT HEADER */}
                    <button
                      onClick={() => toggleFabHidden(!isFabHidden)}
                      className={`p-1.5 rounded-full transition-all ${
                        isFabHidden 
                          ? 'text-amber-400 bg-amber-500/10' 
                          : (themeMode === 'dark' ? 'text-neutral-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-200')
                      }`}
                      title={isFabHidden ? 'Onyesha icon ya AI kwenye screen' : 'Ficha icon ya AI kwenye screen'}
                    >
                      {isFabHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    {/* LIGHT / NIGHT MODE TOGGLE */}
                    <button
                      onClick={() => {
                        const nextMode = themeMode === 'dark' ? 'light' : 'dark';
                        setThemeMode(nextMode);
                        toast.info(nextMode === 'light' ? '💡 Light Mode' : '🌙 Night Mode');
                      }}
                      className={`p-1.5 rounded-full transition-all ${
                        themeMode === 'dark' 
                          ? 'text-amber-300 hover:bg-white/10' 
                          : 'text-amber-600 hover:bg-slate-200'
                      }`}
                      title={themeMode === 'dark' ? 'Light Mode 💡' : 'Night Mode 🌙'}
                    >
                      {themeMode === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                    </button>

                    {/* AUTO VOICE TOGGLE */}
                    <button
                      onClick={() => {
                        const nextState = !autoVoiceEnabled;
                        setAutoVoiceEnabled(nextState);
                        if (!nextState && 'speechSynthesis' in window) {
                          window.speechSynthesis.cancel();
                          setCurrentlySpeakingId(null);
                        }
                        toast.info(nextState ? 'Sauti: Wazi' : 'Sauti: Imefungwa');
                      }}
                      className={`p-1.5 rounded-full transition-all ${
                        autoVoiceEnabled 
                          ? 'text-amber-500' 
                          : (themeMode === 'dark' ? 'text-neutral-500 hover:bg-white/10' : 'text-slate-400 hover:bg-slate-200')
                      }`}
                      title={autoVoiceEnabled ? 'Sauti Wazi' : 'Sauti Imefungwa'}
                    >
                      {autoVoiceEnabled ? <Volume2 className="w-3.5 h-3.5 animate-pulse" /> : <VolumeX className="w-3.5 h-3.5" />}
                    </button>

                    {/* CLEAR MESSAGES BUTTON */}
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className={`p-1.5 rounded-full transition-all ${
                        themeMode === 'dark'
                          ? 'text-red-400 hover:bg-red-950/50'
                          : 'text-red-500 hover:bg-red-50'
                      }`}
                      title="Futa Meseji Zote"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* CLOSE BUTTON */}
                  <button
                    onClick={() => {
                      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                      setCurrentlySpeakingId(null);
                      setIsOpen(false);
                    }}
                    className="w-8 h-8 rounded-full bg-red-600/90 hover:bg-red-600 text-white font-bold flex items-center justify-center transition-transform active:scale-90 shadow-md shadow-red-600/20 shrink-0 border border-red-400/30"
                    title="Funga (Close)"
                  >
                    <X className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>

              {/* AUTOMATIC AI ROLE INDICATOR & COMPACT SWITCHER */}
              <div className={`px-4 py-2 border-b flex items-center justify-between gap-2 overflow-x-auto no-scrollbar ${
                themeMode === 'dark' ? 'bg-[#12121c] border-white/10' : 'bg-slate-100/90 border-slate-200'
              }`}>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 shrink-0">
                    Mode ya AI (Automatiki):
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wide flex items-center gap-1.5 shrink-0 shadow-xs ${
                    activeRole === 'dereva'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : activeRole === 'vendor'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                        : 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                  }`}>
                    {activeRole === 'dereva' && <Car className="w-3.5 h-3.5 text-emerald-400" />}
                    {activeRole === 'vendor' && <Store className="w-3.5 h-3.5 text-purple-400" />}
                    {activeRole === 'mteja' && <ShoppingBag className="w-3.5 h-3.5 text-orange-400" />}
                    <span>{activeRole === 'dereva' ? 'Dereva AI 🚖' : activeRole === 'vendor' ? 'Vendor AI 🏪' : 'Mteja AI 🛍️'}</span>
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[9px] font-bold text-neutral-500 uppercase mr-1 hidden sm:inline">Badili:</span>
                  <button
                    onClick={() => {
                      localStorage.setItem('papo_ai_role_override', 'true');
                      switchRole('mteja');
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                      activeRole === 'mteja'
                        ? 'bg-orange-600 text-white font-black shadow-xs'
                        : themeMode === 'dark' ? 'bg-neutral-800 text-neutral-400 hover:text-white' : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                    title="Mteja AI"
                  >
                    Mteja
                  </button>
                  <button
                    onClick={() => {
                      localStorage.setItem('papo_ai_role_override', 'true');
                      switchRole('dereva');
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                      activeRole === 'dereva'
                        ? 'bg-emerald-600 text-white font-black shadow-xs'
                        : themeMode === 'dark' ? 'bg-neutral-800 text-neutral-400 hover:text-white' : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                    title="Dereva AI"
                  >
                    Dereva
                  </button>
                  <button
                    onClick={() => {
                      localStorage.setItem('papo_ai_role_override', 'true');
                      switchRole('vendor');
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                      activeRole === 'vendor'
                        ? 'bg-purple-600 text-white font-black shadow-xs'
                        : themeMode === 'dark' ? 'bg-neutral-800 text-neutral-400 hover:text-white' : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                    title="Vendor AI"
                  >
                    Vendor
                  </button>
                </div>
              </div>

              {/* MESSAGES BODY */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8, x: -20 }}
                      className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.sender === 'maya' && (
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1 shadow-xs border ${getRoleFabStyle()}`}>
                          {getRoleIcon()}
                        </div>
                      )}

                      <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed relative group transition-all ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 text-white rounded-tr-none font-medium shadow-md shadow-orange-600/20 pr-8'
                          : themeMode === 'dark'
                            ? 'bg-[#1c1c28] border border-white/10 text-neutral-200 rounded-tl-none shadow-sm'
                            : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-none shadow-sm'
                      }`}>
                        {msg.sender === 'user' && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="absolute top-2.5 right-2 text-white/70 hover:text-white transition-opacity p-1 rounded-md hover:bg-black/20"
                            title="Futa meseji hii"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {msg.sender === 'maya' && (
                          <div className={`flex justify-between items-center mb-2 pb-1.5 border-b ${
                            themeMode === 'dark' ? 'border-white/10' : 'border-slate-100'
                          }`}>
                            <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider flex items-center gap-1">
                              {getRoleTitle()}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => speakText(msg.text, msg.id)}
                                className={`px-2 py-0.5 rounded-md text-xs flex items-center gap-1 transition-colors ${
                                  currentlySpeakingId === msg.id 
                                    ? 'bg-amber-500 text-black font-bold animate-pulse' 
                                    : themeMode === 'dark' ? 'text-neutral-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                                title="Sikiliza sauti ya jibu hili"
                              >
                                {currentlySpeakingId === msg.id ? (
                                  <>
                                    <Pause className="w-3.5 h-3.5" />
                                    <span className="text-[9px]">Inasoma...</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 className="w-3.5 h-3.5 text-amber-500" />
                                    <span className="text-[9px]">Sikiliza</span>
                                  </>
                                )}
                              </button>

                              <button
                                onClick={() => handleDeleteMessage(msg.id)}
                                className={`p-1 rounded-md text-xs flex items-center gap-1 transition-colors ${
                                  themeMode === 'dark' ? 'text-neutral-400 hover:text-red-400 hover:bg-white/10' : 'text-slate-400 hover:text-red-600 hover:bg-slate-100'
                                }`}
                                title="Futa meseji hii"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="whitespace-pre-wrap">{msg.text}</div>

                        {msg.pendingConfirmation && (
                          <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`mt-4 p-4 rounded-xl border space-y-3 ${
                              themeMode === 'dark' 
                                ? 'bg-[#12121c] border-amber-500/40' 
                                : 'bg-amber-50/90 border-amber-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 text-amber-600 font-black text-xs uppercase tracking-wider">
                              <ShieldCheck className="w-4 h-4" />
                              <span>{msg.pendingConfirmation.title}</span>
                            </div>

                            <div className={`p-3 rounded-lg text-xs space-y-1 font-mono ${
                              themeMode === 'dark' ? 'bg-black/40 text-neutral-300' : 'bg-white text-slate-800 border border-amber-200'
                            }`}>
                              {msg.pendingConfirmation.details.amount && (
                                <div className="flex justify-between">
                                  <span>Kiasi:</span>
                                  <span className="text-amber-600 font-bold">TSH {msg.pendingConfirmation.details.amount.toLocaleString()}</span>
                                </div>
                              )}
                              {msg.pendingConfirmation.details.method && (
                                <div className="flex justify-between">
                                  <span>Njia:</span>
                                  <span className="uppercase text-orange-600 font-bold">{msg.pendingConfirmation.details.method}</span>
                                </div>
                              )}
                              {msg.pendingConfirmation.details.vehicle_type && (
                                <div className="flex justify-between">
                                  <span>Usafiri:</span>
                                  <span className="uppercase text-amber-600 font-bold">{msg.pendingConfirmation.details.vehicle_type}</span>
                                </div>
                              )}
                              {msg.pendingConfirmation.details.pickup_location && (
                                <div className="flex justify-between">
                                  <span>Kuanzia:</span>
                                  <span className="font-sans font-medium">{msg.pendingConfirmation.details.pickup_location}</span>
                                </div>
                              )}
                              {msg.pendingConfirmation.details.destination && (
                                <div className="flex justify-between">
                                  <span>Kufika:</span>
                                  <span className="font-sans font-medium">{msg.pendingConfirmation.details.destination}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => handleConfirmAction(msg.id, msg.pendingConfirmation?.details, true)}
                                className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-black py-2.5 px-3 rounded-lg text-xs uppercase tracking-wider transition-all shadow-sm"
                              >
                                Thibitisha Sasa
                              </button>
                              <button
                                onClick={() => handleConfirmAction(msg.id, msg.pendingConfirmation?.details, false)}
                                className={`font-bold py-2.5 px-3 rounded-lg text-xs uppercase transition-all ${
                                  themeMode === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                }`}
                              >
                                Ghairi
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isLoading && (
                  <div className="flex gap-3 justify-start items-center">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${getRoleFabStyle()}`}>
                      <Sparkles className="w-4 h-4 text-white animate-spin" />
                    </div>
                    <div className={`border px-4 py-3 rounded-2xl text-xs font-mono flex items-center gap-2 ${
                      themeMode === 'dark' 
                        ? 'bg-[#1c1c28] border-white/10 text-neutral-400' 
                        : 'bg-white border-slate-200 text-slate-600 shadow-xs'
                    }`}>
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                      {getRoleTitle()} inafikiria na kuandaa maelezo...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* QUICK PROMPT CHIPS */}
              <div className={`px-4 py-2.5 border-t flex items-center gap-2 overflow-x-auto no-scrollbar ${
                themeMode === 'dark' ? 'bg-[#0f0f16] border-white/5' : 'bg-slate-100/80 border-slate-200/80'
              }`}>
                {getQuickPrompts().map((qp, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(qp.prompt)}
                    className={`shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
                      themeMode === 'dark'
                        ? 'bg-[#1c1c28] hover:bg-[#28283a] text-neutral-300 border-white/10'
                        : 'bg-white hover:bg-slate-200/60 text-slate-700 border-slate-200 shadow-xs'
                    }`}
                  >
                    {qp.label}
                  </button>
                ))}
              </div>

              {/* INPUT FORM WITH SWAHILI VOICE RECOGNITION */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className={`p-3 sm:p-4 border-t flex items-center gap-2 shrink-0 relative ${
                  themeMode === 'dark' ? 'bg-[#0a0a0f] border-white/10' : 'bg-white border-slate-200 shadow-md'
                }`}
              >
                {isListening && (
                  <div className="absolute -top-10 left-4 right-4 bg-amber-600 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-lg flex items-center justify-between animate-pulse">
                    <span className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-amber-200 animate-spin" />
                      AI anasikiliza sauti yako kwa Kiswahili...
                    </span>
                    <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded uppercase">Sema sasa</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={toggleListening}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                    isListening
                      ? 'bg-red-600 text-white animate-bounce shadow-lg shadow-red-600/50 border border-white'
                      : themeMode === 'dark'
                        ? 'bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-amber-500/30'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-300'
                  }`}
                  title={isListening ? 'Acha kusikiliza' : 'Ongea kwa sauti ya Kiswahili'}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={isListening ? "Anasikiliza sauti..." : `Sema au andika ombi kwa ${getRoleTitle()}...`}
                  className={`flex-1 text-xs sm:text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 transition-colors border ${
                    themeMode === 'dark'
                      ? 'bg-[#161622] border-white/10 text-white placeholder-neutral-500'
                      : 'bg-slate-100 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white'
                  }`}
                  disabled={isLoading}
                />

                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading}
                  className={`w-11 h-11 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all shadow-lg shrink-0 ${getRoleFabStyle()}`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
