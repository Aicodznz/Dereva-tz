import React, { useState, useEffect } from 'react';
import { 
  Bot, BatteryCharging, Navigation, ShieldCheck, Lock, Unlock, 
  Volume2, AlertTriangle, Play, Pause, RefreshCw, Cpu, Radio, 
  MapPin, Compass, Eye, Smartphone, Zap, Code, Wrench, CheckCircle2,
  ChevronRight, Terminal, Sparkles, Sliders, Server, Layers, Camera,
  Crosshair, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../LanguageContext';
import { toast } from 'sonner';

interface RobotTelemetry {
  id: string;
  name: string;
  code: string;
  status: 'delivering' | 'idle' | 'charging' | 'returning' | 'maintenance';
  battery: number;
  speed: number; // km/h
  temp: number; // Celsius
  location: string;
  coordinates: { lat: number; lng: number };
  targetAddress: string;
  customerPhone: string;
  pinCode: string;
  doorLocked: boolean;
  lidarActive: boolean;
  lteSignal: number; // %
  obstacleDistance: number; // cm
  cameraStreamUrl: string;
  cargoWeight: number; // kg
}

export default function DeliveryRobotManager() {
  const { language, t } = useLanguage();
  const isSw = language === 'sw';
  const [activeTab, setActiveTab] = useState<'fleet' | 'diy_guide' | 'firmware' | 'ussd_remote'>('fleet');

  // Simulated Fleet Data
  const [robots, setRobots] = useState<RobotTelemetry[]>([
    {
      id: 'bot-01',
      name: 'PapoBot Alpha-1',
      code: 'PB-DAR-01',
      status: 'delivering',
      battery: 84,
      speed: 12.4,
      temp: 34.2,
      location: 'Kariakoo Market, Uhuru Street',
      coordinates: { lat: -6.8162, lng: 39.2783 },
      targetAddress: 'Posta Mpya, Azikiwe Street #14',
      customerPhone: '+255 712 345 678',
      pinCode: '4829',
      doorLocked: true,
      lidarActive: true,
      lteSignal: 92,
      obstacleDistance: 145,
      cameraStreamUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
      cargoWeight: 4.2
    },
    {
      id: 'bot-02',
      name: 'PapoBot Express-2',
      code: 'PB-DAR-02',
      status: 'idle',
      battery: 98,
      speed: 0.0,
      temp: 31.0,
      location: 'Masaki Hub, Haile Selassie Rd',
      coordinates: { lat: -6.7584, lng: 39.2885 },
      targetAddress: 'Waiting at Hub',
      customerPhone: 'N/A',
      pinCode: '1234',
      doorLocked: true,
      lidarActive: true,
      lteSignal: 98,
      obstacleDistance: 320,
      cameraStreamUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=600&q=80',
      cargoWeight: 0.0
    },
    {
      id: 'bot-03',
      name: 'PapoBot Titan-3',
      code: 'PB-DOD-01',
      status: 'returning',
      battery: 42,
      speed: 14.1,
      temp: 38.5,
      location: 'Dodoma Central, Nyerere Sq',
      coordinates: { lat: -6.1729, lng: 35.7410 },
      targetAddress: 'Returning to Dodoma Depot',
      customerPhone: '+255 788 990 112',
      pinCode: '9012',
      doorLocked: false,
      lidarActive: true,
      lteSignal: 85,
      obstacleDistance: 210,
      cameraStreamUrl: 'https://images.unsplash.com/photo-1535378620166-273708d44e4c?auto=format&fit=crop&w=600&q=80',
      cargoWeight: 1.1
    }
  ]);

  const [selectedBotId, setSelectedBotId] = useState<string>('bot-01');
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [voiceAnnouncement, setVoiceAnnouncement] = useState<string>('Habari! PapoBot imewasili na mzigo wako. Ingiza PIN kufungua.');
  const [isAnnouncing, setIsAnnouncing] = useState<boolean>(false);

  const activeBot = robots.find(r => r.id === selectedBotId) || robots[0];

  // Simulation interval for movement & telemetry ticks
  useEffect(() => {
    const interval = setInterval(() => {
      setRobots(prev => prev.map(bot => {
        if (bot.status === 'delivering' || bot.status === 'returning') {
          const speedVar = (Math.random() * 2 - 1) * 0.5;
          const newSpeed = Math.max(5, Math.min(18, bot.speed + speedVar));
          const obstacle = Math.floor(Math.random() * 200) + 50;
          return {
            ...bot,
            speed: parseFloat(newSpeed.toFixed(1)),
            obstacleDistance: obstacle,
            battery: Math.max(5, parseFloat((bot.battery - 0.05).toFixed(1)))
          };
        }
        return bot;
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const toggleDoorLock = (botId: string) => {
    setRobots(prev => prev.map(r => {
      if (r.id === botId) {
        const nextState = !r.doorLocked;
        toast.success(
          nextState 
            ? (isSw ? 'Kufuli la Kifurushi limefungwa kikamilifu! 🔒' : 'Cargo compartment locked securely! 🔒')
            : (isSw ? 'Kufuli la Kifurushi limefunguka! 🔓' : 'Cargo compartment unlocked! 🔓')
        );
        return { ...r, doorLocked: nextState };
      }
      return r;
    }));
  };

  const handleManualDrive = (direction: string) => {
    toast.info(isSw ? `Amri ya kuendesha: ${direction.toUpperCase()} 🎮` : `Manual drive command: ${direction.toUpperCase()} 🎮`);
  };

  const playVoiceAlert = () => {
    setIsAnnouncing(true);
    toast.success(isSw ? 'Sauti inatangazwa kupitia Spika ya Roboti... 🔊' : 'Voice broadcast triggered on Robot Speaker... 🔊');
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(voiceAnnouncement);
      utterance.lang = 'sw-TZ';
      window.speechSynthesis.speak(utterance);
    }
    setTimeout(() => setIsAnnouncing(false), 3000);
  };

  const verifyUnlockPin = () => {
    if (enteredPin === activeBot.pinCode) {
      toggleDoorLock(activeBot.id);
      setEnteredPin('');
      toast.success(isSw ? 'PIN Ni Sahihi! Kifurushi kimefunguka.' : 'PIN Verified! Compartment opened.');
    } else {
      toast.error(isSw ? 'PIN Si Sahihi! Jaribu tena.' : 'Incorrect PIN! Try again.');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* TOP HERO HEADER */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-orange-950/40 border border-neutral-800 p-6 md:p-10 shadow-2xl">
          <div className="absolute -right-10 -top-10 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-mono font-semibold tracking-wider uppercase">
                <Bot className="w-4 h-4 animate-pulse" />
                PapoBot Autonomous Fleet v2.4
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white">
                {isSw ? 'Roboti ya Kuwasilisha Mzigo' : 'Autonomous Delivery Robot'}
              </h1>
              <p className="text-neutral-400 max-w-2xl text-sm md:text-base leading-relaxed">
                {isSw 
                  ? 'Mfumo wa kisasa wa kuwasilisha chakula na vifurushi bila dereva kupitia PapoBot. Fuatilia mawasiliano ya sensorer, GPS Live, kufuli la PIN la USSD, na muundo wa kutengeneza Roboti nchini Tanzania.'
                  : 'Real-time telemetry, remote drive controls, IoT hardware schematics, and automated PIN locker verification for Papo Hapo autonomous last-mile delivery robots.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setActiveTab('fleet')}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'fleet'
                    ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20 scale-105'
                    : 'bg-neutral-800/80 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                <Activity className="w-4 h-4" />
                {isSw ? 'Kituo cha Fleet' : 'Fleet Telemetry'}
              </button>

              <button
                onClick={() => setActiveTab('diy_guide')}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'diy_guide'
                    ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20 scale-105'
                    : 'bg-neutral-800/80 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                <Wrench className="w-4 h-4" />
                {isSw ? 'Muundo & Vifaa (DIY Blueprint)' : 'Hardware & DIY Spec'}
              </button>

              <button
                onClick={() => setActiveTab('firmware')}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'firmware'
                    ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20 scale-105'
                    : 'bg-neutral-800/80 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                <Code className="w-4 h-4" />
                {isSw ? 'Firmware / Python' : 'Python ROS2 Firmware'}
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: FLEET DASHBOARD & REMOTE CONTROL */}
        {activeTab === 'fleet' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* ROBOT SELECTOR SIDEBAR (3 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2 text-neutral-200">
                  <Radio className="w-5 h-5 text-orange-400 animate-pulse" />
                  {isSw ? 'Roboti Zilizopo' : 'Active Delivery Robots'}
                </h2>
                <span className="text-xs font-mono bg-neutral-800 text-neutral-400 px-2.5 py-1 rounded-full">
                  {robots.length} Online
                </span>
              </div>

              <div className="space-y-3">
                {robots.map(bot => (
                  <button
                    key={bot.id}
                    onClick={() => setSelectedBotId(bot.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      selectedBotId === bot.id
                        ? 'bg-neutral-900 border-orange-500 shadow-xl ring-1 ring-orange-500/50'
                        : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold">
                          <Bot className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-neutral-100">{bot.name}</p>
                          <p className="text-[10px] font-mono text-neutral-400">{bot.code}</p>
                        </div>
                      </div>

                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        bot.status === 'delivering' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        bot.status === 'returning' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-neutral-800 text-neutral-400'
                      }`}>
                        {bot.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-neutral-800/80 text-[11px] text-neutral-400 font-mono">
                      <div className="flex items-center gap-1">
                        <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{bot.battery}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-orange-400" />
                        <span>{bot.speed} km/h</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Lock className={`w-3.5 h-3.5 ${bot.doorLocked ? 'text-red-400' : 'text-emerald-400'}`} />
                        <span>{bot.doorLocked ? 'Locked' : 'Open'}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* UNLOCK COMPARTMENT CARD FOR CUSTOMER */}
              <div className="p-5 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-4">
                <div className="flex items-center gap-2 text-orange-400 font-bold text-sm">
                  <ShieldCheck className="w-4 h-4" />
                  {isSw ? 'Fungua Kifurushi (Customer PIN)' : 'Unlock Parcel Locker'}
                </div>
                <p className="text-xs text-neutral-400">
                  {isSw 
                    ? `Ingiza PIN ya tarakimu 4 kuleta amri ya kufungua mfuniko wa PapoBot (${activeBot.name}). PIN ya mfano: ${activeBot.pinCode}`
                    : `Enter the 4-digit PIN sent to customer SMS to open cargo door on ${activeBot.name}. Demo PIN: ${activeBot.pinCode}`}
                </p>

                <div className="flex gap-2">
                  <input
                    type="password"
                    maxLength={4}
                    value={enteredPin}
                    onChange={(e) => setEnteredPin(e.target.value)}
                    placeholder="E.g. 4829"
                    className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-center font-mono text-lg tracking-widest text-white focus:border-orange-500 outline-none"
                  />
                  <button
                    onClick={verifyUnlockPin}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1"
                  >
                    <Unlock className="w-4 h-4" />
                    {isSw ? 'Fungua' : 'Unlock'}
                  </button>
                </div>
              </div>
            </div>

            {/* MAIN TELEMETRY & LIVE CAMERA MONITOR (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* LIVE CAMERA & OBSTACLE OVERLAY */}
              <div className="relative rounded-3xl overflow-hidden bg-neutral-900 border border-neutral-800 aspect-video shadow-2xl">
                <img 
                  src={activeBot.cameraStreamUrl} 
                  alt="Robot AI Camera Stream"
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-neutral-950/60" />

                {/* AI Bounding Box Overlay Simulation */}
                <div className="absolute top-1/3 left-1/3 w-36 h-28 border-2 border-emerald-400/80 rounded-lg flex flex-col justify-between p-1.5 animate-pulse">
                  <div className="flex justify-between items-center text-[10px] font-mono bg-emerald-950/80 text-emerald-300 px-1.5 rounded">
                    <span>PEDESTRIAN</span>
                    <span>98%</span>
                  </div>
                  <div className="text-[9px] font-mono text-emerald-400 self-end">
                    DIST: {activeBot.obstacleDistance}cm
                  </div>
                </div>

                {/* HUD Overlay Stats */}
                <div className="absolute top-4 left-4 flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs font-mono">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-white font-bold">LIVE CAM 1080p</span>
                  </div>
                  <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs font-mono text-orange-400 font-bold">
                    LIDAR 360° ACTIVE
                  </div>
                </div>

                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs font-mono text-neutral-300">
                    LTE 4G: <span className="text-emerald-400 font-bold">{activeBot.lteSignal}%</span>
                  </div>
                </div>

                {/* Bottom HUD bar */}
                <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-lg p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-neutral-400 font-mono">CURRENT LOCATION</p>
                    <p className="text-sm font-bold text-white flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-orange-400" />
                      {activeBot.location}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-neutral-400 font-mono">DESTINATION ADDRESS</p>
                    <p className="text-sm font-bold text-orange-400 flex items-center gap-1.5">
                      <Navigation className="w-4 h-4" />
                      {activeBot.targetAddress}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleDoorLock(activeBot.id)}
                      className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                        activeBot.doorLocked 
                          ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30' 
                          : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30'
                      }`}
                    >
                      {activeBot.doorLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      {activeBot.doorLocked ? (isSw ? 'Funga Mfuniko' : 'Door Locked') : (isSw ? 'Mfuniko Wazi' : 'Door Unlocked')}
                    </button>
                  </div>
                </div>
              </div>

              {/* TELEMETRY GAUGES GRID */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
                  <div className="flex justify-between text-neutral-400 text-xs font-mono">
                    <span>BATTERY PACK</span>
                    <BatteryCharging className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-2xl font-black text-white">{activeBot.battery}%</p>
                  <p className="text-[10px] text-neutral-500">24V LiFePO4 Cell</p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
                  <div className="flex justify-between text-neutral-400 text-xs font-mono">
                    <span>MOTORS SPEED</span>
                    <Zap className="w-4 h-4 text-orange-400" />
                  </div>
                  <p className="text-2xl font-black text-white">{activeBot.speed} <span className="text-xs font-normal text-neutral-400">km/h</span></p>
                  <p className="text-[10px] text-neutral-500">4x 250W Geared DC</p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
                  <div className="flex justify-between text-neutral-400 text-xs font-mono">
                    <span>TEMP & SENSORS</span>
                    <Cpu className="w-4 h-4 text-sky-400" />
                  </div>
                  <p className="text-2xl font-black text-white">{activeBot.temp}°C</p>
                  <p className="text-[10px] text-neutral-500">CPU Thermal Normal</p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
                  <div className="flex justify-between text-neutral-400 text-xs font-mono">
                    <span>CARGO LOAD</span>
                    <Layers className="w-4 h-4 text-purple-400" />
                  </div>
                  <p className="text-2xl font-black text-white">{activeBot.cargoWeight} <span className="text-xs font-normal text-neutral-400">kg</span></p>
                  <p className="text-[10px] text-neutral-500">Max Capacity: 25.0 kg</p>
                </div>
              </div>

              {/* REMOTE MANUAL JOYPAD CONTROLS */}
              <div className="p-6 rounded-3xl bg-neutral-900/90 border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Crosshair className="w-5 h-5 text-orange-400" />
                    {isSw ? 'Uendeshaji wa Mbali (Manual Remote Override)' : 'Remote Joypad & Voice Alert Override'}
                  </h3>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                    Latency: 18ms
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* JOYPAD BUTTONS */}
                  <div className="flex flex-col items-center justify-center p-4 bg-neutral-950 rounded-2xl border border-neutral-800">
                    <p className="text-xs text-neutral-400 font-mono mb-3">DRIVE DIRECTION (REMOTELY)</p>
                    <div className="grid grid-cols-3 gap-2 w-48">
                      <div />
                      <button 
                        onClick={() => handleManualDrive('forward')}
                        className="p-3 rounded-xl bg-neutral-800 hover:bg-orange-500 hover:text-black transition-all flex items-center justify-center font-bold text-white"
                      >
                        <ArrowUp className="w-5 h-5" />
                      </button>
                      <div />

                      <button 
                        onClick={() => handleManualDrive('left')}
                        className="p-3 rounded-xl bg-neutral-800 hover:bg-orange-500 hover:text-black transition-all flex items-center justify-center font-bold text-white"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>

                      <button 
                        onClick={() => handleManualDrive('stop')}
                        className="p-3 rounded-xl bg-red-600 hover:bg-red-500 transition-all flex items-center justify-center font-bold text-white"
                      >
                        <Pause className="w-5 h-5" />
                      </button>

                      <button 
                        onClick={() => handleManualDrive('right')}
                        className="p-3 rounded-xl bg-neutral-800 hover:bg-orange-500 hover:text-black transition-all flex items-center justify-center font-bold text-white"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </button>

                      <div />
                      <button 
                        onClick={() => handleManualDrive('reverse')}
                        className="p-3 rounded-xl bg-neutral-800 hover:bg-orange-500 hover:text-black transition-all flex items-center justify-center font-bold text-white"
                      >
                        <ArrowDown className="w-5 h-5" />
                      </button>
                      <div />
                    </div>
                  </div>

                  {/* VOICE ANNOUNCER & HORN */}
                  <div className="space-y-3 flex flex-col justify-between">
                    <div>
                      <label className="text-xs text-neutral-400 font-mono block mb-1">
                        {isSw ? 'Tangazo la Sauti la Roboti (Speaker Text-to-Speech)' : 'Robot Speaker Voice Announcement'}
                      </label>
                      <textarea
                        rows={2}
                        value={voiceAnnouncement}
                        onChange={(e) => setVoiceAnnouncement(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:border-orange-500 outline-none"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={playVoiceAlert}
                        disabled={isAnnouncing}
                        className="flex-1 bg-orange-500 hover:bg-orange-400 text-black font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2"
                      >
                        <Volume2 className="w-4 h-4" />
                        {isSw ? 'Tangaza kwa Sauti' : 'Broadcast Voice'}
                      </button>

                      <button
                        onClick={() => toast.warning(isSw ? 'King' : 'Horn Alert Dispatched!')}
                        className="bg-neutral-800 hover:bg-neutral-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        {isSw ? 'Piga Honi' : 'Sound Horn'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: DIY BLUEPRINT & HARDWARE GUIDE */}
        {activeTab === 'diy_guide' && (
          <div className="space-y-8">
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                  <Wrench className="w-7 h-7 text-orange-400" />
                  {isSw ? 'Mwongozo wa Kutengeneza Roboti (Hardware & DIY Blueprint)' : 'Hardware Blueprint & Component Assembly Guide'}
                </h2>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  {isSw 
                    ? 'Hatua kwa hatua jinsi ya kuunda na kuunganisha Roboti ya Kuwasilisha Mzigo (PapoBot) kwa kutumia Raspberry Pi, sensorer za LIDAR/Ultrasonic, SIM7600 LTE Modem, na kufuli la umeme la Solenoid Lock.'
                    : 'A complete end-to-end hardware specification and wiring topology for building physical delivery robots for East African road conditions.'}
                </p>
              </div>

              {/* HARDWARE SPECIFICATIONS GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-white">1. Main Microcontroller & AI Brain</h3>
                  <ul className="text-xs text-neutral-400 space-y-1.5 list-disc pl-4 font-mono">
                    <li>Raspberry Pi 4 / 5 (4GB or 8GB RAM)</li>
                    <li>Nvidia Jetson Nano (for AI Computer Vision)</li>
                    <li>Ubuntu 22.04 LTS with ROS2 Humble</li>
                    <li>128GB High-Speed MicroSD Card</li>
                  </ul>
                </div>

                <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                    <Radio className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-white">2. IoT Connectivity & GPS</h3>
                  <ul className="text-xs text-neutral-400 space-y-1.5 list-disc pl-4 font-mono">
                    <li>SIM7600G-H 4G LTE HAT (GSM, SMS, USSD)</li>
                    <li>NEO-6M / NEO-8M High Precision GPS</li>
                    <li>External High-Gain LTE & GPS Antenna</li>
                    <li>Swahili SMS/USSD Command Protocol</li>
                  </ul>
                </div>

                <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400 font-bold">
                    <Eye className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-white">3. Navigation & Obstacle Sensors</h3>
                  <ul className="text-xs text-neutral-400 space-y-1.5 list-disc pl-4 font-mono">
                    <li>RPLIDAR A1 2D 360° Laser Scanner</li>
                    <li>4x HC-SR04 Waterproof Ultrasonic Sensors</li>
                    <li>MPU6050 6-DOF Gyroscope & Accelerometer</li>
                    <li>1080p Wide-Angle USB Camera (YUY2/MJPEG)</li>
                  </ul>
                </div>

                <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-white">4. Chassis & Motors System</h3>
                  <ul className="text-xs text-neutral-400 space-y-1.5 list-disc pl-4 font-mono">
                    <li>4WD Heavy-Duty Aluminum Frame Chassis</li>
                    <li>4x 24V 250W High-Torque DC Geared Motors</li>
                    <li>2x BTS7960 43A High Power Motor Drivers</li>
                    <li>All-Terrain Off-Road Rubber Wheels</li>
                  </ul>
                </div>

                <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 font-bold">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-white">5. Parcel Locker & Security</h3>
                  <ul className="text-xs text-neutral-400 space-y-1.5 list-disc pl-4 font-mono">
                    <li>12V Solenoid Heavy Duty Electric Lock</li>
                    <li>Relay Module 5V Trigger (Optocoupler)</li>
                    <li>8-ohm 10W Waterproof PAM8403 Speaker</li>
                    <li>RGB Addressable LED Status Light Ring</li>
                  </ul>
                </div>

                <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                    <BatteryCharging className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-white">6. Power & Solar Hybrid System</h3>
                  <ul className="text-xs text-neutral-400 space-y-1.5 list-disc pl-4 font-mono">
                    <li>24V 20Ah LiFePO4 Rechargeable Battery Pack</li>
                    <li>Step-Down Buck Converters (24V to 12V / 5V 5A)</li>
                    <li>20W Top Mounted Solar Panel</li>
                    <li>Smart BMS Protection Board with Overcurrent Cutoff</li>
                  </ul>
                </div>

              </div>

              {/* STEP BY STEP ASSEMBLY PROCEDURE */}
              <div className="border-t border-neutral-800 pt-6 space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  {isSw ? 'Hatua za kuunda na kuunganisha wires (Assembly Workflow)' : 'Step-by-Step DIY Assembly Workflow'}
                </h3>

                <div className="space-y-3 text-xs md:text-sm text-neutral-300">
                  <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-mono font-bold flex items-center justify-center shrink-0">1</span>
                    <div>
                      <p className="font-bold text-white">{isSw ? 'Ujenzi wa Body na Motors' : 'Chassis & Motor Wiring'}</p>
                      <p className="text-neutral-400 text-xs mt-1">
                        {isSw 
                          ? 'Unganisha motors 4 za DC kwenye BTS7960 Motor Driver Modules. Hakikisha relay ya usalama imewekwa kati ya battery na driver.' 
                          : 'Connect 4x 24V DC geared motors to BTS7960 motor driver pins (PWM, R_EN, L_EN) linked to Raspberry Pi GPIO.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-mono font-bold flex items-center justify-center shrink-0">2</span>
                    <div>
                      <p className="font-bold text-white">{isSw ? 'Uwekaji wa Sensorer & Camera' : 'Sensor Installation & Telemetry'}</p>
                      <p className="text-neutral-400 text-xs mt-1">
                        {isSw 
                          ? 'Weka LIDAR juu ya Roboti, Ultrasonic mbele na nyuma kuzuia kugonga vitu au mashimo, pamoja na SIM7600 Module kwenye Raspberry Pi.' 
                          : 'Mount 360 LIDAR at the highest point. Attach Ultrasonic sensors to front bumper. Connect SIM7600 LTE HAT via USB/UART.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-mono font-bold flex items-center justify-center shrink-0">3</span>
                    <div>
                      <p className="font-bold text-white">{isSw ? 'Kufuli la Kifurushi na Spika' : 'Locker Solenoid & Audio System'}</p>
                      <p className="text-neutral-400 text-xs mt-1">
                        {isSw 
                          ? 'Unganisha 12V Solenoid Lock kupitia Relay Module. Tenga PIN kwenye mfumo wa USSD/App ili mteja anapoingiza PIN sahihi, Relay inafungua kufuli.' 
                          : 'Wire 12V Solenoid lock to Relay Module controlled by GPIO pin 18. Program voice announcements via PAM8403 amplifier module.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: FIRMWARE & SOURCE CODE */}
        {activeTab === 'firmware' && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-orange-400" />
                  {isSw ? 'Kodi ya Roboti (Python & ROS2 Script)' : 'Robot Firmware Source Code (Python)'}
                </h2>
                <p className="text-xs text-neutral-400 mt-1">
                  {isSw 
                    ? 'Kodi hii inaendesha Raspberry Pi, kusoma GPS/LIDAR, na kuwasiliana na Server ya Papo Hapo kufungua kufuli kupitia PIN au USSD.'
                    : 'Python script executed on Raspberry Pi to stream GPS telemetry, check SMS/USSD unlock triggers, and actuate solenoid locker.'}
                </p>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(`
import time
import serial
import RPi.GPIO as GPIO
import requests

# GPIO Setup
SOLENOID_PIN = 18
ULTRASONIC_TRIG = 23
ULTRASONIC_ECHO = 24

GPIO.setmode(GPIO.BCM)
GPIO.setup(SOLENOID_PIN, GPIO.OUT)
GPIO.setup(ULTRASONIC_TRIG, GPIO.OUT)
GPIO.setup(ULTRASONIC_ECHO, GPIO.IN)

def unlock_compartment():
    print("[PapoBot] Unlocking cargo door...")
    GPIO.output(SOLENOID_PIN, GPIO.HIGH)
    time.sleep(5)
    GPIO.output(SOLENOID_PIN, GPIO.LOW)
    print("[PapoBot] Cargo door locked.")

# Main Loop
while True:
    # Telemetry push to Papo Hapo cloud
    time.sleep(2)
                  `);
                  toast.success(isSw ? 'Kodi imenukuliwa (Copied to Clipboard)!' : 'Source code copied to clipboard!');
                }}
                className="bg-orange-500 hover:bg-orange-400 text-black font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2"
              >
                <Code className="w-4 h-4" />
                {isSw ? 'Nukulu Kodi (Copy)' : 'Copy Source Code'}
              </button>
            </div>

            <div className="bg-neutral-950 p-5 rounded-2xl border border-neutral-800 font-mono text-xs text-emerald-400 overflow-x-auto leading-relaxed">
              <pre>{`# PapoBot Autonomous Delivery Firmware v2.4 (Raspberry Pi + SIM7600 + ROS2)
import time
import json
import serial
import RPi.GPIO as GPIO
import websocket

ROBOT_ID = "PB-DAR-01"
CLOUD_WS = "wss://api.papohapo.co.tz/ws/robot"

# Hardware Pin Definitions
SOLENOID_LOCK_PIN = 18
MOTOR_PWM_A = 12
MOTOR_PWM_B = 13

GPIO.setmode(GPIO.BCM)
GPIO.setup(SOLENOID_LOCK_PIN, GPIO.OUT)
GPIO.output(SOLENOID_LOCK_PIN, GPIO.LOW) # Default locked

def handle_cloud_command(msg):
    data = json.loads(msg)
    cmd = data.get("command")
    
    if cmd == "UNLOCK_DOOR":
        pin = data.get("pin")
        print(f"[PapoBot] Received unlock trigger with PIN: {pin}")
        # Trigger Solenoid Relay for 6 seconds
        GPIO.output(SOLENOID_LOCK_PIN, GPIO.HIGH)
        time.sleep(6)
        GPIO.output(SOLENOID_LOCK_PIN, GPIO.LOW)
        print("[PapoBot] Cargo compartment re-locked securely.")
        
    elif cmd == "DRIVE":
        direction = data.get("dir")
        print(f"[PapoBot] Remote driving: {direction}")

def send_telemetry():
    gps_data = {"lat": -6.8162, "lng": 39.2783, "battery": 84, "status": "delivering"}
    print(f"[PapoBot Telemetry] Sending: {gps_data}")

# Initialize SIM7600 LTE & Main Loop
if __name__ == "__main__":
    print("[PapoBot Firmware] Booting system & checking LIDAR/GPS sensors...")
    send_telemetry()`}</pre>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
