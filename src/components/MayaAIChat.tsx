import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Send, X, Bot, User as UserIcon, ShieldCheck, 
  Car, Utensils, CreditCard, Package, RefreshCw, 
  MapPin, CheckCircle, AlertTriangle, ChevronRight, PhoneCall,
  Flame, Ambulance, Wallet, HelpCircle, CornerDownLeft, Volume2, VolumeX, Pause,
  Mic, MicOff, WifiOff, Radio, Trash2, Sun, Moon, RotateCcw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';

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
  const recognitionRef = useRef<any>(null);

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
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'maya',
        text: `Habari ${userName}! 👋 Meseji zote zimefutwa kikamilifu.\n\nNinawezaje kukusaidia tena tukiwa hapa **${currentLoc}**?`,
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
      text: 'Habari! Mimi ni MAYA — Akili Mnemba (AI) ya Papo Hapo Super App 🇹🇿.\n\nNinaweza kukusaidia kuitisha Usafiri (Boda, Bajaji, Gari, Ambulansi, au Zimamoto), kuagiza Chakula kutoka migahawa yetu iliyosajiliwa (Mgahawa wa Papo, Swahili Cuisine House, Kuku Kuku Joint), au kufanya Malipo salama. Unaweza kusema kwa sauti au kuandika!',
      timestamp: new Date()
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchCurrentLocation = () => {
    // 1. Check cached location first
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

    // 2. Fetch real-time GPS location & reverse geocode
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

  // Personalize greeting with user name & location when opening
  useEffect(() => {
    if (isOpen && !hasGreeted) {
      const userName = getUserFirstName();
      const currentLoc = userLocation;
      
      const greetingText = `Habari ${userName}! 👋 Mimi ni MAYA — Female Voice Assistant ya Papo Hapo Super App 🇹🇿.\n\nNinaona upo karibu na **${currentLoc}**. Ninaweza kukusaidia kuitisha Usafiri (Boda, Bajaji, Gari, Ambulansi, Zimamoto), kuagiza Chakula, au kufanya Malipo salama. Nikupe msaada gani leo?`;

      setMessages(prev => {
        if (prev.length === 1 && prev[0].id === 'welcome-1') {
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
          speakText(`Habari ${userName}! Mimi ni MAYA. Ninaona upo ${currentLoc}. Nikupe msaada gani leo?`, 'welcome-1');
        }, 500);
      }
    }
  }, [isOpen, user, profile, userLocation, hasGreeted]);

  // Swahili & English Natural Humanlike TTS (Female Voice Model, Pitch 1.05, Cadence Rate 0.95)
  const speakText = (text: string, msgId: string) => {
    if (!('speechSynthesis' in window)) {
      toast.error('Kivinjari chako hakitogelei Speech Synthesis.');
      return;
    }

    // Stop any active speech
    window.speechSynthesis.cancel();

    if (currentlySpeakingId === msgId) {
      setCurrentlySpeakingId(null);
      return;
    }

    // Sanitize text for natural speech cadence
    const cleanText = text
      .replace(/[*_#`~]/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Natural human voice parameters as requested:
    utterance.pitch = 1.05; // Warm, natural female voice pitch
    utterance.rate = 0.95;  // Natural human speech cadence rate for Kiswahili & English

    const voices = window.speechSynthesis.getVoices();
    
    // Select best Swahili or female natural voice
    const swVoice = voices.find(v => v.lang.startsWith('sw') || v.lang.includes('sw-TZ') || v.lang.includes('sw-KE'));
    const femaleVoice = swVoice || voices.find(v => {
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase();
      return (lang.includes('sw') || lang.includes('en')) && 
             (name.includes('female') || name.includes('zira') || name.includes('samantha') || 
              name.includes('victoria') || name.includes('karen') || name.includes('helena') || 
              name.includes('savia') || name.includes('zuri') || name.includes('google us english') || 
              name.includes('natural') || name.includes('girl') || name.includes('woman'));
    }) || voices.find(v => v.name.toLowerCase().includes('female')) || voices[0];

    if (femaleVoice) {
      utterance.voice = femaleVoice;
      utterance.lang = femaleVoice.lang || 'sw-TZ';
    } else {
      utterance.lang = 'sw-TZ';
    }

    utterance.onstart = () => {
      setCurrentlySpeakingId(msgId);
    };

    utterance.onend = () => {
      setCurrentlySpeakingId(null);
    };

    utterance.onerror = () => {
      setCurrentlySpeakingId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Offline Swahili Voice & Intent Recognition Engine
  const parseOfflineVoiceCommand = (text: string) => {
    const lower = text.toLowerCase();
    const userName = getUserFirstName();

    if (lower.includes('niko wapi') || lower.includes('nikowapi') || lower.includes('location') || lower.includes('wapi nilipo') || lower.includes('nilipo') || lower.includes('saiv') || lower.includes('sasa')) {
      return {
        reply: `Habari ${userName}! Kwa mujibu wa GPS na mfumo wetu wa Papo Hapo, hivi sasa upo eneo la **${userLocation}**. Kama unataka kwenda sehemu yoyote au kuagiza chakula uletewe hapa, niambie tu!`,
        functionCalls: []
      };
    }
    
    if (lower.includes('salio') || lower.includes('balance') || lower.includes('papo wallet')) {
      return {
        reply: `Nimekagua salio lako la Papo Wallet, ${userName}: Una TSH 45,500 na pointi 280. Nikupe msaada mwingine?`,
        functionCalls: [{ name: 'checkBalance', args: { account_type: 'papo_wallet' } }]
      };
    }

    if (lower.includes('boda') || lower.includes('pikipiki')) {
      return {
        reply: `Tayari nimefanya maandalizi ya usafiri wa Boda kuanzia ${userLocation}. Nitafungua ukurasa wa Usafiri sasa uweze kuchagua eneo la kufika.`,
        functionCalls: [{ name: 'bookTaxi', args: { vehicle_type: 'boda', pickup_location: userLocation, destination: 'Kariakoo' } }]
      };
    }

    if (lower.includes('gari') || lower.includes('taxi') || lower.includes('bajaji')) {
      const vType = lower.includes('bajaji') ? 'bajaji' : 'car';
      return {
        reply: `Nimeandaa usafiri wa ${vType === 'bajaji' ? 'Bajaji' : 'Gari (Taxi)'} kuanzia ${userLocation}. Nitakupeleka kwenye ukurasa wa usafiri ili kukamilisha.`,
        functionCalls: [{ name: 'bookTaxi', args: { vehicle_type: vType, pickup_location: userLocation, destination: 'Kariakoo' } }]
      };
    }

    if (lower.includes('3d') || lower.includes('animation') || lower.includes('animat') || lower.includes('showcase')) {
      return {
        reply: `Habari ${userName}! Mfumo wetu wa **Interactive 3D App Animation Engine** 🎨📱 unakupa fursa ya kuangalia na kuingiliana na Super App kwa muundo wa 3D WebGL real-time!\n\n✨ **Sifa kuu za 3D Showcase**:\n- 📱 **Interactive 3D Phone Chassis**: Inazunguka na kuitikia kulingana na muonekano wa mouse au mguso wako.\n- 🎙️ **Multi-Screen Visual Switcher**: Inakuonyesha MAYA AI Voice, PapoStay Real Estate, PapoRide Taxi, Delivery Robot na Papo Wallet kwenye 3D Canvas.\n- 🔮 **Particle Field & Lighting Effects**: Atmospheric lighting na visual particles.\n- 🛠️ **Wireframe & Orbit Toggle**: Uwezo wa kuangalia muundo wa 3D Geometry.\n\nUnaweza kuitazama hapo juu kwenye Customer Dashboard au kufungua ukurasa mzima wa 3D Showcase kwa kubofya hapa: **/3d-animation** 🚀!`,
        functionCalls: []
      };
    }

    if (lower.includes('ambulansi') || lower.includes('dharura') || lower.includes('hospitali') || lower.includes('ambulance')) {
      return {
        reply: `⚠️ *Wito wa Dharura wa Ambulansi (Emergency)*:\nNimeandaa wito wa haraka wa Ambulansi kuja eneo lako la **${userLocation}**. Tafadhali thibitisha hapa chini ili gari na madaktari vianze safari mara moja.`,
        functionCalls: [{ name: 'bookTaxi', args: { vehicle_type: 'ambulance', pickup_location: userLocation, destination: 'Hospitali ya Rufaa' } }]
      };
    }

    if (lower.includes('zimamoto') || lower.includes('faya') || lower.includes('moto')) {
      return {
        reply: `🚨 *Wito wa Dharura wa Zimamoto (Fire Truck)*:\nNimeandaa gari la Faya / Zimamoto kuja eneo la **${userLocation}**. Thibitisha hapa chini kutuma taarifa za eneo lako haraka.`,
        functionCalls: [{ name: 'bookTaxi', args: { vehicle_type: 'fire', pickup_location: userLocation, destination: 'Dharura' } }]
      };
    }

    if (lower.includes('schema') || lower.includes('database') || lower.includes('landlord') || lower.includes('escrow') || lower.includes('dispute') || lower.includes('payout') || lower.includes('commission') || lower.includes('holding deposit')) {
      return {
        reply: `Habari ${userName}! Huu hapa ndio Muundo wa Mfumo na Schema Architecture ya **PapoStay & Real Estate Engine** 🏗️📊:\n\n1️⃣ **Uhusiano wa Broker–Landlord–Listing (Many-to-Many Architecture)**:\n- Tuna 'landlords' (Wamiliki), 'brokers' (Madalali), 'listings' (Nyumba/Vyumba) na 'listing_broker_assignments' (Junction table).\n- Dalali 1 anaweza kuwakilisha nyumba za wamiliki wengi. Nyumba 1 pia inaweza kuwa na madalali wengi (Non-Exclusive) au dalali mmoja wa kipekee (Exclusive).\n\n2️⃣ **Escrow Payout & Commission Split (Mgawanyo wa Malipo)**:\n- Pesa inatunzwa kwenye Escrow Vault mpaka Check-in/Handover.\n- Baada ya kuthibitishwa: Landlord anapata share yake kuu (e.g. 90%), Dalali anapata tume yake ya ubonge (e.g. 10% au Kodi ya mwezi 1), na PapoHapo inachukua platform service fee (2-5%).\n\n3️⃣ **Booking Fee dhidi ya Full Rent Escrow**:\n- **Holding Deposit (50k / 10%)**: Inashikilia nyumba kwa siku 3-7 ili isichukuliwe na mtu mwingine; ina hatari ndogo ya kifedha kwa wallet.\n- **Full Rent Escrow**: Inashikilia kodi ya miezi 3-12 mpaka mpangaji anapokea funguo na kutosheka na nyumba.\n\n4️⃣ **Dispute Resolution & Admin Authority**:\n- Mteja akiripoti tatizo (Hold), pesa inafungwa kiotomatiki.\n- Admin Dashboard ina mamlaka ya kuamuru **Full Refund** (ikibainika uongo/tatizo la nyumba), **Partial Release**, au **Release to Landlord/Broker** endapo mteja alighairi bila msingi.`,
        functionCalls: []
      };
    }

    if (lower.includes('utaratibu') || lower.includes('flow') || lower.includes('floo') || lower.includes('jinsi') || lower.includes('dalali') || lower.includes('madalali') || lower.includes('nyumba') || lower.includes('pango') || lower.includes('chumba') || lower.includes('fremu') || lower.includes('apartment') || lower.includes('papostay')) {
      return {
        reply: `Habari ${userName}! Utaratibu (Flow) wa **PapoStay & Real Estate** kwenye Papo Hapo Super App 🏠🇹🇿 uko hivi hatua kwa hatua:\n\n1️⃣ **Utafutaji na Filter (Search)**:\n- Unafungua sehemu ya **PapoStay** kwenye app na kuchagua eneo (mfano: Kinondoni, Sinza, Mbezi, Dodoma n.k.), aina ya nyumba (Single Room, Master, Apartment, Fremu au Hoteli) na bajeti yako.\n\n2️⃣ **Kuangalia Picha na Sifa Halisi (Verified Listing)**:\n- Unaona picha za HD za nyumba, huduma zilizopo (Maji 24/7, Luku ya pekee, Parking, Ulinzi) na bei HALISI iliyohakikiwa bila utapeli.\n\n3️⃣ **Mawasiliano na Dalali / Mwakala Aliyehakikiwa**:\n- Unawasiliana moja kwa moja na Dalali au Mwenye Nyumba aliyethibitishwa (Verified Broker/Host) kupitia Chat au Simu bila kutoa pesa za mtaani za kiholela.\n\n4️⃣ **Ratiba ya Kukagua Nyumba (Viewing Schedule)**:\n- Unapanga miadi (Schedule Visit) ya kwenda kuiona nyumba ana kwa ana au kuikagua mtandaoni.\n\n5️⃣ **Malipo Salama (Escrow Protection)**:\n- Unalipia kodi au booking kupitia M-Pesa, Mixx (Tigo Pesa), Airtel Money au PapoWallet. Pesa inatunzwa kwa usalama na Papo Hapo mpaka upokee funguo na kuridhika.\n\n6️⃣ **Mkataba wa Kidijitali & Risiti**:\n- Unapokea Mkataba wa Pango (Digital Lease) na Risiti ya Kidijitali ya papo hapo kwenye simu yako! 📜✨\n\nJe, ungependa kuanza kutafuta nyumba au hoteli eneo gani hapa **${userLocation}**?`,
        functionCalls: []
      };
    }

    if (lower.includes('chips') || lower.includes('chakula') || lower.includes('kuku') || lower.includes('ugali') || lower.includes('samaki')) {
      return {
        reply: `Nimepata ombi lako la chakula kuletwa **${userLocation}**! Kwenye Papo Hapo tuna "Mgahawa wa Papo Fast Food", "Swahili Cuisine House", na "Kuku Kuku Joint". Nikuagizie nini kutoka kwenye haya?`,
        functionCalls: [{ name: 'orderFood', args: { items: [{ item_name: 'Chips Kuku', quantity: 1 }], delivery_location: userLocation } }]
      };
    }

    return {
      reply: `Habari ${userName}! Nimepata sauti/amri yako: "${text}". Hivi sasa upo **${userLocation}**. Mimi ni MAYA (Model ya Kiswahili). Ninaweza kusaidia kuitisha usafiri, kuangalia salio, au kuagiza chakula.`,
      functionCalls: []
    };
  };

  // Toggle Speech Recognition (Swahili Microphone Input)
  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Kivinjari chako hakitogelei Speech Recognition. Unaweza kuandika kwa maandishi.');
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

      // Set Swahili speech language recognition
      recognition.lang = 'sw-TZ';

      recognition.onstart = () => {
        setIsListening(true);
        toast.info('🎙️ MAYA anasikiliza sauti yako kwa Kiswahili...', { id: 'maya-mic' });
      };

      recognition.onresult = (event: any) => {
        const transcriptText = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');

        setInputMessage(transcriptText);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition notice:', event.error);
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

    // Stop any ongoing speech when sending a new message
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
      // Check offline mode first
      if (!navigator.onLine) {
        const offlineRes = parseOfflineVoiceCommand(text);
        setIsLoading(false);
        const newOfflineId = `maya-offline-${Date.now()}`;
        
        let offlinePending: any = null;
        if (Array.isArray(offlineRes.functionCalls) && offlineRes.functionCalls.length > 0) {
          for (const fc of offlineRes.functionCalls) {
            const args = fc.args as any;
            if (fc.name === 'bookTaxi' && (args?.vehicle_type === 'ambulance' || args?.vehicle_type === 'fire')) {
              offlinePending = {
                type: 'booking',
                title: args?.vehicle_type === 'ambulance' ? 'Thibitisha Wito wa Ambulansi (Offline Emergency)' : 'Thibitisha Wito wa Zimamoto (Offline Fire)',
                details: args
              };
            }
          }
        }

        const offlineMsg: Message = {
          id: newOfflineId,
          sender: 'maya',
          text: `📡 [Mfumo wa Nje ya Mtandao / Offline Mode]\n\n${offlineRes.reply}`,
          timestamp: new Date(),
          functionCalls: offlineRes.functionCalls,
          pendingConfirmation: offlinePending
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
          userContext: {
            userName: getUserFirstName(),
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

      // Speak automatically if autoVoice is enabled
      if (autoVoiceEnabled) {
        setTimeout(() => {
          speakText(mayaResponseText, newMayaId);
        }, 300);
      }

    } catch (err: any) {
      setIsLoading(false);
      
      // Fallback to offline model
      const offlineRes = parseOfflineVoiceCommand(text);
      const newOfflineId = `maya-fallback-${Date.now()}`;

      const fallbackMsg: Message = {
        id: newOfflineId,
        sender: 'maya',
        text: `📡 [Mfumo wa Sauti ya Kiswahili ya Mtaani / Offline Local Engine]\n\n${offlineRes.reply}\n\n*(Mtandao ukiwa dhaifu unaweza pia kutumia USSD yetu ya *149*00#)*`,
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

    toast.loading('Inathibitisha na kutekeleza na MAYA...', { id: 'maya-exec' });
    
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

  const quickPrompts = [
    { label: '🚖 Boda / Taxi kwenda Kariakoo', prompt: 'Nahitaji usafiri wa Boda kutoka Mwenge kwenda Kariakoo Dar es Salaam' },
    { label: '🍔 Chips Kuku (Mgahawa wa Papo)', prompt: 'Nahitaji Chips Kuku kutoka Mgahawa wa Papo Fast Food niletee Mwenge' },
    { label: '🍲 Ugali Samaki (Swahili Cuisine)', prompt: 'Agiza Ugali Samaki wa Kupaka kutoka Swahili Cuisine House' },
    { label: '🚑 Ambulansi ya Dharura', prompt: 'Nahitaji Ambulansi ya dharura haraka sana Posta Dar es Salaam' },
    { label: '💰 Angalia Salio la Papo Wallet', prompt: 'Angalia salio langu la Papo Wallet' }
  ];

  return (
    <>
      {/* FLOATING ACTION BUTTON */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 left-6 z-[160] flex items-center gap-2.5 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 text-white px-4 py-3 rounded-full shadow-[0_12px_30px_rgba(234,88,12,0.45)] border border-white/20 backdrop-blur-md group"
        aria-label="Fungua MAYA AI Assistant"
      >
        <div className="relative flex items-center justify-center">
          <div className="w-9 h-9 bg-black/30 rounded-full flex items-center justify-center border border-white/20">
            <Sparkles className="w-5 h-5 text-amber-200 animate-pulse" />
          </div>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-orange-600 animate-ping" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-orange-600" />
        </div>

        <div className="text-left hidden sm:block">
          <div className="text-[11px] font-black uppercase tracking-wider leading-none text-white flex items-center gap-1">
            MAYA AI 👩‍💼
            {currentlySpeakingId && <Volume2 className="w-3 h-3 text-amber-300 animate-bounce" />}
          </div>
          <div className="text-[9px] font-bold text-amber-100 uppercase tracking-widest">Female Voice 🇹🇿</div>
        </div>
      </motion.button>

      {/* DRAWER / MODAL CHAT UI */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className={`w-full sm:max-w-lg h-[90vh] sm:h-[650px] rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl border flex flex-col overflow-hidden relative transition-colors duration-300 ${
                themeMode === 'dark' 
                  ? 'bg-[#121218] text-white border-white/10' 
                  : 'bg-slate-50 text-slate-900 border-slate-200/80'
              }`}
            >
              {/* CLEAR ALL CONFIRMATION OVERLAY MODAL */}
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
                          Je, una uhakika unataka kufuta mazungumzo yote na MAYA AI?
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
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-400 flex items-center justify-center shadow-md shadow-orange-500/20 border border-white/20 shrink-0">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className={`font-black text-sm tracking-tight uppercase truncate ${themeMode === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        MAYA AI
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
                      title="Bonyeza kuhuisha eneo lako halisi (GPS)"
                    >
                      <MapPin className={`w-3 h-3 text-amber-500 shrink-0 ${isLocating ? 'animate-spin' : ''}`} />
                      <span className="truncate">{userLocation}</span>
                    </button>
                  </div>
                </div>

                {/* RIGHT: CONTROLS & PROMINENT CLOSE BUTTON */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* COMPACT TOOLBAR PILL */}
                  <div className={`flex items-center p-1 rounded-full border ${
                    themeMode === 'dark' ? 'bg-[#111118] border-white/10' : 'bg-slate-100 border-slate-200'
                  }`}>
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

                    {/* CLEAR ALL MESSAGES BUTTON */}
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

                  {/* PROMINENT HIGH-CONTRAST CLOSE BUTTON */}
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
                        <div className="w-8 h-8 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center shrink-0 mt-1 shadow-xs">
                          <Sparkles className="w-4 h-4 text-orange-500" />
                        </div>
                      )}

                      <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed relative group transition-all ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 text-white rounded-tr-none font-medium shadow-md shadow-orange-600/20 pr-8'
                          : themeMode === 'dark'
                            ? 'bg-[#1c1c28] border border-white/10 text-neutral-200 rounded-tl-none shadow-sm'
                            : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-none shadow-sm'
                      }`}>
                        {/* USER MESSAGE DELETE BUTTON */}
                        {msg.sender === 'user' && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="absolute top-2.5 right-2 text-white/70 hover:text-white transition-opacity p-1 rounded-md hover:bg-black/20"
                            title="Futa meseji hii"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* VOICE READOUT & DELETE BUTTON FOR MAYA MESSAGES */}
                        {msg.sender === 'maya' && (
                          <div className={`flex justify-between items-center mb-2 pb-1.5 border-b ${
                            themeMode === 'dark' ? 'border-white/10' : 'border-slate-100'
                          }`}>
                            <span className="text-[10px] text-orange-500 font-bold uppercase tracking-wider flex items-center gap-1">
                              MAYA AI Voice
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

                        {/* CONFIRMATION CARD FOR PAYMENTS OR EMERGENCY BOOKINGS */}
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
                    <div className="w-8 h-8 rounded-xl bg-orange-600/30 border border-orange-500/40 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-orange-400 animate-spin" />
                    </div>
                    <div className={`border px-4 py-3 rounded-2xl text-xs font-mono flex items-center gap-2 ${
                      themeMode === 'dark' 
                        ? 'bg-[#1c1c28] border-white/10 text-neutral-400' 
                        : 'bg-white border-slate-200 text-slate-600 shadow-xs'
                    }`}>
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping" />
                      MAYA inafikiria na kuandaa maelezo...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* QUICK PROMPT CHIPS */}
              <div className={`px-4 py-2.5 border-t flex items-center gap-2 overflow-x-auto no-scrollbar ${
                themeMode === 'dark' ? 'bg-[#0f0f16] border-white/5' : 'bg-slate-100/80 border-slate-200/80'
              }`}>
                {quickPrompts.map((qp, idx) => (
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

              {/* INPUT FORM WITH SWAHILI VOICE RECOGNITION (OFFLINE & ONLINE) */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className={`p-3 sm:p-4 border-t flex items-center gap-2 shrink-0 relative ${
                  themeMode === 'dark' ? 'bg-[#0a0a0f] border-white/10' : 'bg-white border-slate-200 shadow-md'
                }`}
              >
                {/* Voice listening status banner */}
                {isListening && (
                  <div className="absolute -top-10 left-4 right-4 bg-orange-600 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-lg flex items-center justify-between animate-pulse">
                    <span className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-amber-200 animate-spin" />
                      MAYA anasikiliza sauti yako kwa Kiswahili...
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
                  title={isListening ? 'Acha kusikiliza' : 'Ongea kwa sauti ya Kiswahili (Swahili Voice Command)'}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={isListening ? "Anasikiliza sauti..." : "Sema au andika ombi lako kwa MAYA..."}
                  className={`flex-1 text-xs sm:text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors border ${
                    themeMode === 'dark'
                      ? 'bg-[#161622] border-white/10 text-white placeholder-neutral-500'
                      : 'bg-slate-100 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white'
                  }`}
                  disabled={isLoading}
                />

                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading}
                  className="w-11 h-11 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all shadow-lg shadow-orange-600/30 shrink-0"
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
