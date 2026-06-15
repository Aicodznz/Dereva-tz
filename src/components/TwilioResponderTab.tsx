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
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface Message {
  sender: 'customer' | 'bot';
  text: string;
  timestamp: string;
}

interface TwilioResponderTabProps {
  vendorId: string;
  vendorCategory: string;
}

export const TwilioResponderTab: React.FC<TwilioResponderTabProps> = ({ vendorId, vendorCategory }) => {
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
    fetchSMSConfig();
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

  const sendSimulatedMessage = async (text: string) => {
    if (!text.trim()) return;

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Add User message
    const userMsg: Message = { sender: 'customer', text, timestamp: timeString };
    setChatMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setInputText('');

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

      if (!response.ok) {
        throw new Error("Simulation endpoint returned error code: " + response.status);
      }

      const data = await response.json();
      
      // Add Bot reply
      const botMsg: Message = {
        sender: 'bot',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, botMsg]);

    } catch (err: any) {
      toast.error("Hitilafu kwenye simulator: " + err.message);
      setChatMessages(prev => [...prev, {
        sender: 'bot',
        text: "🚨 Mfumo unashindwa kuunganisha kwa sasa. Tafadhali hakikisha server imekamilika kurestart.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 font-sans items-start">
      
      {/* Left panel: Config, Webhooks, Info */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Intro banner */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-6 rounded-2xl shadow-md relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4 scale-150">
            <Smartphone className="w-64 h-64" />
          </div>
          <div className="relative z-10 space-y-2">
            <span className="bg-white/20 text-white font-bold text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full inline-block">
              INTEGRATION ALIVE
            </span>
            <h2 className="text-2xl font-black uppercase tracking-tight italic">Twilio SMS Auto Responder</h2>
            <p className="text-sm text-orange-50/90 leading-relaxed font-normal max-w-xl">
              Unganisha mfumo wako mzima wa Papo Hapo na huduma za SMS za Twilio. Wateja wanaweza kuagiza Taxi, kukata tiketi za Mabasi, kufanya booking saluni na kuagiza chakula moja kwa moja kupitia ujumbe wa kawaida wa SMS na WhatsApp!
            </p>
          </div>
        </div>

        {/* Webhook Configuration Details */}
        <Card className="border border-neutral-100 hover:shadow-xs transition-shadow duration-300 dark:border-neutral-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2 dark:text-neutral-100 uppercase tracking-wide">
              <Globe className="w-5 h-5 text-orange-500" />
              <span>Sanidi Twilio Console Webhook</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Hatua rahisi za kuunganisha namba yako ya Twilio:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5 p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/80 rounded-xl">
              <label className="text-xs font-black uppercase tracking-wider text-neutral-500 block">
                Twilio Webhook Endpoint URL
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

            <div className="text-xs space-y-2 text-neutral-600 dark:text-neutral-400 leading-relaxed bg-orange-500/5 p-4 rounded-xl border border-orange-500/10">
              <p className="font-bold text-orange-600 dark:text-orange-400">Jinsi ya kuweka kwenye Twilio Dashboard:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Ingia kwenye <a href="https://twilio.com/console" target="_blank" rel="noopener noreferrer" className="underline font-bold text-orange-600">twilio.com</a> na ununue au ufungue namba ya Sandbox.</li>
                <li>Nenda kwenye sehemu ya <b>Active Numbers</b> na uchague namba yako.</li>
                <li>Tembea chini mpaka sehemu ya <b>Messaging</b>.</li>
                <li>Chini ya <b>A MESSAGE COMES IN</b>, weka <b>Webhook</b> na ubandike URL uliyonakili (copy) juu.</li>
                <li>Chagua njia ya <b>HTTP POST</b> na ubonyeze <b>Save</b>!</li>
              </ol>
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
              Configure greetings text custom for your business profile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="space-y-0.5">
                <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 block">Auto-Response Active</span>
                <span className="text-xs text-neutral-500">Enable automated SMS/WhatsApp replying algorithms</span>
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

      {/* Right panel: Phone Model Simulator */}
      <div className="lg:col-span-5 flex flex-col items-center">
        
        {/* Smartphone physical model frame wrapper */}
        <div className="relative w-full max-w-[340px] h-[670px] bg-neutral-950 rounded-[48px] p-3.5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] border-4 border-neutral-900 ring-12 ring-neutral-900 flex flex-col justify-between overflow-hidden">
          
          {/* Top Notch speaker and camera shape */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[22px] bg-neutral-950 rounded-b-2xl z-50 flex items-center justify-center">
            <div className="w-12 h-1 bg-neutral-800 rounded-full mb-1"></div>
            <div className="w-2.5 h-2.5 bg-neutral-900 rounded-full ml-2 mb-1 border border-neutral-800/20"></div>
          </div>

          {/* Glowing Side buttons simulated shadow/reflection */}
          <div className="absolute -left-[4px] top-28 w-[4px] h-10 bg-neutral-800 rounded-r-xs"></div>
          <div className="absolute -left-[4px] top-44 w-[4px] h-12 bg-neutral-800 rounded-r-xs"></div>
          <div className="absolute -left-[4px] top-58 w-[4px] h-12 bg-neutral-800 rounded-r-xs"></div>
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
                  <span className="text-[8.5px] text-emerald-500 font-bold tracking-widest uppercase">● Auto Responder</span>
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
  );
};
