import React, { useState, useMemo } from 'react';
import { 
  Sparkles, Copy, Check, Play, Pause, RefreshCw, Sliders, 
  Code2, Eye, ShieldAlert, Zap, Layout, Monitor, Flame,
  Compass, Award, Rocket, Moon, Sun, Search, Filter,
  Share2, ArrowUpRight, Palette, Layers, Terminal, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export interface TextAnimationItem {
  id: string;
  name: string;
  swahiliName: string;
  category: 'promo' | 'hero' | 'neon' | 'cyber' | 'dynamic' | 'elegant';
  description: string;
  cssClassName: string;
  cssKeyframes: string;
  tailwindExample: string;
  recommendedPlaces: {
    title: string;
    description: string;
    icon: string;
  }[];
  bestFor: string;
  performance: string;
  defaultText: string;
}

export const TEXT_ANIMATIONS_DATA: TextAnimationItem[] = [
  {
    id: 'shimmer-gold',
    name: 'Shimmer Gold Wave',
    swahiliName: "Mg'ao wa Dhahabu Unaotiririka",
    category: 'promo',
    description: 'Mwanga wa kifahari unaopita juu ya herufi za dhahabu na kutoa hisia ya ubora wa juu na punguzo la kipekee.',
    cssClassName: 'anim-shimmer-gold',
    cssKeyframes: `@keyframes shimmerGold {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}

.anim-shimmer-gold {
  background: linear-gradient(
    90deg, 
    #b45309 0%, 
    #f59e0b 25%, 
    #fef08a 50%, 
    #f59e0b 75%, 
    #b45309 100%
  );
  background-size: 200% auto;
  color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
  display: inline-block;
  font-weight: 800;
  animation: shimmerGold 3s linear infinite;
}`,
    tailwindExample: `<span className="bg-gradient-to-r from-amber-700 via-amber-200 to-amber-700 bg-[length:200%_auto] bg-clip-text text-transparent font-extrabold animate-shimmer">
  OFFA YA DHAHABU
</span>`,
    recommendedPlaces: [
      { title: 'Bango Kuu la Punguzo (Promo Hero)', description: 'Kuvuta hisia za wateja kwenye ofa za kipekee au flash sales.', icon: '🏷️' },
      { title: 'Beji ya Dereva VIP / Top Rated', description: 'Kutofautisha madereva wenye nyota 5 na hadhi ya juu.', icon: '⭐' },
      { title: 'Zawadi & Coupon (Earn TZS 1,000)', description: 'Kuonyesha kiasi cha zawadi au vocha za bonasi.', icon: '🎁' }
    ],
    bestFor: 'Ofa za Kifahari, Zawadi, na Beji za VIP',
    performance: 'GPU Accelerated (100% CSS)',
    defaultText: 'OFFA MAALUM: PUNGUZO LA 50% LEO'
  },
  {
    id: 'cyberpunk-glitch',
    name: 'Cyberpunk Glitch & RGB Split',
    swahiliName: 'Mtindo wa Glitch & Mgawanyo wa Rangi RGB',
    category: 'cyber',
    description: 'Athari ya kiteknolojia ya kisasa yenye chromatic aberration (Cyan & Magenta) inayofaa mandhari ya kidijitali.',
    cssClassName: 'anim-cyberpunk-glitch',
    cssKeyframes: `@keyframes glitchSkew {
  0% { transform: skew(0deg); }
  20% { transform: skew(-3deg); }
  40% { transform: skew(2deg); }
  60% { transform: skew(-1deg); }
  80% { transform: skew(3deg); }
  100% { transform: skew(0deg); }
}

@keyframes glitchTop {
  0%, 100% { clip-path: inset(0 0 100% 0); transform: translate(0); }
  20% { clip-path: inset(20% 0 50% 0); transform: translate(-3px, -1px); }
  40% { clip-path: inset(60% 0 10% 0); transform: translate(3px, 1px); }
  60% { clip-path: inset(10% 0 70% 0); transform: translate(-2px, 2px); }
  80% { clip-path: inset(40% 0 30% 0); transform: translate(2px, -2px); }
}

.anim-cyberpunk-glitch {
  position: relative;
  display: inline-block;
  font-weight: 900;
  letter-spacing: 0.05em;
  color: #00f2fe;
  text-shadow: 2px 2px 0px #ff0055, -2px -2px 0px #00f2fe;
  animation: glitchSkew 2.5s infinite ease-in-out alternate;
}`,
    tailwindExample: `<div className="relative inline-block font-black text-cyan-400 tracking-wider [text-shadow:2px_2px_0_#f43f5e,-2px_-2px_0_#06b6d4]">
  PAPO HAPO TECH
</div>`,
    recommendedPlaces: [
      { title: 'Meta MCP Hub / Bot Studio', description: 'Vichwa vya habari vya API, AI bots, na webhooks za kisasa.', icon: '🤖' },
      { title: 'Kichwa cha Live Map / Radar', description: 'Kuweka hisia ya ramani ya kisasa ya satellite na satcom.', icon: '🛰️' },
      { title: 'Tangazo la Toleo Jipya (App Update)', description: 'Kutangaza huduma mpya za kiteknolojia.', icon: '⚡' }
    ],
    bestFor: 'UI za Kisasa, AI Panels & Radar Features',
    performance: 'High-Impact CSS (Transforms Only)',
    defaultText: 'PAPO HAPO SPEED ENGINE v2.5'
  },
  {
    id: 'neon-glow-pulse',
    name: 'Neon Glow Pulse',
    swahiliName: 'Taa za Neon Zinazomulika Usiku',
    category: 'neon',
    description: 'Mwanga wa taa za neon zenye tabaka nyingi za mng’ao unaomulika na kupumua kwa ustadi mkubwa.',
    cssClassName: 'anim-neon-pulse',
    cssKeyframes: `@keyframes neonPulse {
  0%, 100% {
    text-shadow: 
      0 0 5px #ff5500,
      0 0 10px #ff5500,
      0 0 20px #ff5500,
      0 0 40px #ea580c,
      0 0 60px #ea580c;
    color: #fff7ed;
  }
  50% {
    text-shadow: 
      0 0 2px #ff5500,
      0 0 5px #ff5500,
      0 0 10px #ea580c,
      0 0 20px #ea580c;
    color: #fed7aa;
  }
}

.anim-neon-pulse {
  font-weight: 800;
  animation: neonPulse 2s ease-in-out infinite;
  display: inline-block;
}`,
    tailwindExample: `<span className="font-extrabold text-orange-50 animate-pulse drop-shadow-[0_0_15px_rgba(234,88,12,0.8)]">
  HUDUMA YA USIKU 24/7
</span>`,
    recommendedPlaces: [
      { title: 'Huduma za Usiku (Night Deliveries 24/7)', description: 'Kwenye maduka au madereva wanaofanya kazi usiku kucha.', icon: '🌙' },
      { title: 'Bango la Restaurant & Club/Lounge', description: 'Kuongeza hisia ya maeneo ya starehe na vyakula vya usiku.', icon: '🍸' },
      { title: 'Vichwa vya Flash Midnight Deals', description: 'Kuvutia wanunuzi wanaonunua bidhaa wakati wa usiku.', icon: '🏮' }
    ],
    bestFor: 'Night Mode, 24/7 Services & Dark Headers',
    performance: 'Smooth 60 FPS CSS Render',
    defaultText: 'PAPO HAPO USIKU 24/7 DELIVERY'
  },
  {
    id: 'typewriter-caret',
    name: 'Typewriter with Blinking Caret',
    swahiliName: 'Mashine ya Chapa yenye Kielekezi Kinachomulika',
    category: 'dynamic',
    description: 'Uandishi wa herufi moja baada ya nyingine kama mashine ya kisasa ya uchapaji ikiwa na kielekezi (cursor) cha kuvutia.',
    cssClassName: 'anim-typewriter',
    cssKeyframes: `@keyframes typing {
  from { width: 0; }
  to { width: 100%; }
}

@keyframes blinkCaret {
  50% { border-color: transparent; }
}

.anim-typewriter-wrapper {
  display: inline-block;
}

.anim-typewriter {
  display: inline-block;
  overflow: hidden;
  white-space: nowrap;
  border-right: 3px solid #ea580c;
  width: 100%;
  animation: 
    typing 3.5s steps(30, end) infinite alternate,
    blinkCaret 0.75s step-end infinite;
  font-family: 'Space Grotesk', monospace;
  font-weight: 700;
}`,
    tailwindExample: `<div className="overflow-hidden whitespace-nowrap border-r-2 border-orange-500 font-mono font-bold animate-typewriter">
  Dereva yuko njiani kukufuata...
</div>`,
    recommendedPlaces: [
      { title: 'Ujumbe wa Hali ya Safari (Live Driver Status)', description: 'Mfano: "Dereva wako amefika", "Inatafuta bodaboda ya karibu..."', icon: '🛵' },
      { title: 'Miongozo ya AI & Search Placeholder', description: 'Maneno yanayobadilika kwenye sanduku la kutafuta bidhaa.', icon: '🔍' },
      { title: 'Notification Alerts za Papo Hapo', description: 'Kutoa ujumbe mfupi unaojichapa kwa hisia ya uhalisia.', icon: '💬' }
    ],
    bestFor: 'Status Badges, Search Inputs & Live Alerts',
    performance: 'Ultra Lightweight (CSS Steps)',
    defaultText: 'Dereva wako Hamisi yuko njiani kufika...'
  },
  {
    id: 'flame-fire-flare',
    name: 'Flame & Fire Flare',
    swahiliName: 'Mwali wa Moto Unaowaka',
    category: 'promo',
    description: 'Athari ya miali ya moto yenye rangi nyekundu, chungwa, na manjano inayotoa dokezo la ofa moto moto zisizopaswa kukoswa.',
    cssClassName: 'anim-flame-fire',
    cssKeyframes: `@keyframes fireFlicker {
  0%, 100% {
    text-shadow: 
      0 -2px 4px #ffedd5,
      0 -4px 8px #f97316,
      0 -8px 16px #ea580c,
      0 -14px 24px #dc2626;
    transform: scaleY(1);
  }
  50% {
    text-shadow: 
      0 -3px 6px #ffedd5,
      0 -6px 12px #fb923c,
      0 -10px 20px #ea580c,
      0 -18px 30px #b91c1c;
    transform: scaleY(1.04);
  }
}

.anim-flame-fire {
  color: #fff7ed;
  font-weight: 900;
  display: inline-block;
  animation: fireFlicker 1.4s ease-in-out infinite alternate;
  letter-spacing: 0.04em;
}`,
    tailwindExample: `<span className="font-black text-amber-100 drop-shadow-[0_-8px_16px_rgba(234,88,12,0.9)] animate-bounce">
  🔥 OFFA MOTO MOTO LEO!
</span>`,
    recommendedPlaces: [
      { title: 'Ofa Moto Moto (Hot Deals / Flash Sales)', description: 'Bidhaa zilizopunguzwa bei kwa muda mfupi sana.', icon: '🔥' },
      { title: 'Vyakula vya BBQ, Grill & Fast Food', description: 'Vichwa vya orodha ya vyakula vya jikoni na nyama choma.', icon: '🍖' },
      { title: 'Kaunta ya Muda (Countdown Timers)', description: 'Kuweka hisia ya haraka (urgency) kwa wanunuzi.', icon: '⏳' }
    ],
    bestFor: 'Flash Deals, Hot Selling Items & BBQ Foods',
    performance: 'Smooth Transform + Shadow Blur',
    defaultText: '🔥 HOT DEALS: OFFA ZINAISHA NDANI YA DAKIKA 30'
  },
  {
    id: 'isometric-3d-flip',
    name: '3D Flip & Depth Pop',
    swahiliName: '3D Pop na Mgeuko wa Pembe',
    category: 'dynamic',
    description: 'Muundo wa pande tatu (3D isometric perspective) unaozunguka na kutoa kivuli kirefu cha kisasa.',
    cssClassName: 'anim-3d-flip',
    cssKeyframes: `@keyframes flip3d {
  0% { transform: perspective(600px) rotateX(0deg) rotateY(0deg); }
  50% { transform: perspective(600px) rotateX(15deg) rotateY(-15deg) translateZ(10px); }
  100% { transform: perspective(600px) rotateX(0deg) rotateY(0deg); }
}

.anim-3d-flip {
  display: inline-block;
  font-weight: 900;
  color: #3b82f6;
  text-shadow: 
    1px 1px 0 #1d4ed8,
    2px 2px 0 #1e40af,
    3px 3px 0 #1e3a8a,
    4px 6px 12px rgba(0,0,0,0.35);
  animation: flip3d 3.5s ease-in-out infinite;
}`,
    tailwindExample: `<span className="inline-block font-black text-blue-500 [text-shadow:1px_1px_0_#1e40af,2px_2px_0_#1e3a8a,3px_5px_8px_rgba(0,0,0,0.4)]">
  PAPORIDE 3D
</span>`,
    recommendedPlaces: [
      { title: 'Nembo za Huduma (PapoRide, PapoSend, PapoFood)', description: 'Kutofautisha huduma kuu za app kwenye landing page.', icon: '🚗' },
      { title: 'Kadi za Matangazo ya Huduma Mpya', description: 'Vichwa vinavyovutia macho haraka.', icon: '✨' },
      { title: 'Vichwa vya Dashibodi za Biashara', description: 'Kwenye ripoti za mauzo na viwango vya ukuaji.', icon: '📊' }
    ],
    bestFor: 'Service Brands, App Features & Hero Headers',
    performance: 'GPU 3D Transform Accelerated',
    defaultText: 'PAPO RIDE: USAFIRI WA UHAKIKA DAR'
  },
  {
    id: 'wave-text-cascade',
    name: 'Wave Text Cascade',
    swahiliName: 'Wimbi la Maandishi Yanayocheza',
    category: 'dynamic',
    description: 'Herufi zinazoinuka na kushuka kama wimbi la maji lenye midundo ya usawa na utulivu.',
    cssClassName: 'anim-wave-text',
    cssKeyframes: `@keyframes waveBob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.anim-wave-text span {
  display: inline-block;
  animation: waveBob 1.6s ease-in-out infinite;
  font-weight: 800;
}
.anim-wave-text span:nth-child(1) { animation-delay: 0.0s; }
.anim-wave-text span:nth-child(2) { animation-delay: 0.1s; }
.anim-wave-text span:nth-child(3) { animation-delay: 0.2s; }
.anim-wave-text span:nth-child(4) { animation-delay: 0.3s; }
.anim-wave-text span:nth-child(5) { animation-delay: 0.4s; }
.anim-wave-text span:nth-child(6) { animation-delay: 0.5s; }
.anim-wave-text span:nth-child(7) { animation-delay: 0.6s; }
.anim-wave-text span:nth-child(8) { animation-delay: 0.7s; }`,
    tailwindExample: `<div className="flex gap-0.5 font-extrabold text-emerald-500">
  <span className="animate-bounce [animation-delay:0.1s]">P</span>
  <span className="animate-bounce [animation-delay:0.2s]">A</span>
  <span className="animate-bounce [animation-delay:0.3s]">P</span>
  <span className="animate-bounce [animation-delay:0.4s]">O</span>
</div>`,
    recommendedPlaces: [
      { title: 'Ukurasa wa Kupakia (Loading Screens)', description: 'Wakati mfumo unatafuta dereva au unathibitisha malipo.', icon: '⏳' },
      { title: 'Karibu kwenye App (Welcome Onboarding)', description: 'Salamu za ukaribisho kwa mtumiaji anapofungua app.', icon: '👋' },
      { title: 'Vichwa vya Michezo & Bonasi', description: 'Kuonyesha shauku ya ushindi na zawadi.', icon: '🎉' }
    ],
    bestFor: 'Loading Indicators, Greetings & Playful Badges',
    performance: 'GPU Keyframe Delays (Zero Lag)',
    defaultText: 'KARIBU SANA PAPO HAPO!'
  },
  {
    id: 'matrix-digital-rain',
    name: 'Matrix Digital Rain Text',
    swahiliName: 'Mvua ya Dijitali ya Matrix',
    category: 'cyber',
    description: 'Mtindo wa herufi za kijani za cyberpunk zinazomulika kama kanuni za kompyuta za Matrix.',
    cssClassName: 'anim-matrix-text',
    cssKeyframes: `@keyframes matrixGlow {
  0%, 100% {
    color: #22c55e;
    text-shadow: 0 0 8px #15803d, 0 0 16px #16a34a;
  }
  30% {
    color: #86efac;
    text-shadow: 0 0 12px #22c55e, 0 0 24px #4ade80;
  }
  70% {
    color: #14532d;
    text-shadow: 0 0 4px #166534;
  }
}

.anim-matrix-text {
  font-family: 'Space Grotesk', monospace;
  font-weight: 800;
  letter-spacing: 0.12em;
  animation: matrixGlow 2s infinite ease-in-out;
  display: inline-block;
}`,
    tailwindExample: `<span className="font-mono font-extrabold text-green-400 tracking-widest drop-shadow-[0_0_10px_rgba(34,197,94,0.8)]">
  SECURE SYSTEM ENCRYPTED
</span>`,
    recommendedPlaces: [
      { title: 'Uthibitisho wa Usalama (End-to-End Encrypted)', description: 'Kwenye pochi (Wallet), malipo ya M-Pesa, na nenosiri.', icon: '🔒' },
      { title: 'Jopo la Takwimu za Mfumo (System Logs / Admin)', description: 'Kuonyesha hali ya server, uptime, na API latency.', icon: '📈' },
      { title: 'Meta MCP API Hub & Webhooks', description: 'Kuthibitisha uunganishaji wa data za nje.', icon: '💻' }
    ],
    bestFor: 'Security Badges, Admin Tech Hub & Wallet Shields',
    performance: 'Pure CSS Color Shift (60 FPS)',
    defaultText: 'MALIPO YAMELINDWA KWA USALAMA 100%'
  },
  {
    id: 'rainbow-aurora-glow',
    name: 'Rainbow Aurora Glow',
    swahiliName: 'Mwangaza wa Upinde wa Mvua (Aurora)',
    category: 'neon',
    description: 'Mchanganyiko wa rangi zote za upinde wa mvua unaotembea kwa mfululizo laini na wa kisasa.',
    cssClassName: 'anim-rainbow-aurora',
    cssKeyframes: `@keyframes rainbowMove {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.anim-rainbow-aurora {
  background: linear-gradient(
    270deg,
    #ff007f,
    #7928ca,
    #0070f3,
    #00dfd8,
    #7928ca,
    #ff007f
  );
  background-size: 400% 400%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-weight: 900;
  display: inline-block;
  animation: rainbowMove 4s ease infinite;
}`,
    tailwindExample: `<span className="bg-gradient-to-r from-pink-500 via-purple-500 via-cyan-400 to-pink-500 bg-[length:300%_auto] bg-clip-text text-transparent font-black animate-gradient">
  SPECIAL PROMO
</span>`,
    recommendedPlaces: [
      { title: 'Vichwa vya Matukio Maalum (Festival & Holidays)', description: 'Mwaka Mpya, Sikukuu za Kitaifa, au Maadhimisho.', icon: '🎊' },
      { title: 'Beji za Watumiaji Wapya (New User Bonus)', description: 'Kuvutia wanachama wanaojiunga kwa mara ya kwanza.', icon: '🌟' },
      { title: 'Kadi za Ofa za Vyombo vya Usafiri & Vyakula', description: 'Kutengeneza mwonekano wa kuvutia usiochosha.', icon: '🎨' }
    ],
    bestFor: 'Festive Banners, New User Promos & VIP Cards',
    performance: 'Seamless Background Position Shift',
    defaultText: 'BONASI YA KUJIUNGA: TZS 10,000 BURE'
  },
  {
    id: 'liquid-fill-rise',
    name: 'Liquid Fill Rise',
    swahiliName: 'Kujaza Maji/Kioevu Ndani ya Herufi',
    category: 'dynamic',
    description: 'Muonekano wa wimbi la kioevu linalojaa taratibu ndani ya herufi kutoka chini kuelekea juu.',
    cssClassName: 'anim-liquid-fill',
    cssKeyframes: `@keyframes waveFill {
  0% { transform: translateY(100%); }
  50% { transform: translateY(20%); }
  100% { transform: translateY(0%); }
}

.anim-liquid-fill-container {
  position: relative;
  display: inline-block;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.15);
  overflow: hidden;
}

.anim-liquid-fill-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  color: #06b6d4;
  overflow: hidden;
  animation: waveFill 4s ease-in-out infinite alternate;
}`,
    tailwindExample: `<div className="relative font-black text-white/20">
  <span>PAPOSEND</span>
  <span className="absolute inset-0 text-cyan-400 overflow-hidden animate-pulse">PAPOSEND</span>
</div>`,
    recommendedPlaces: [
      { title: 'Upakuaji wa Faili & Stakabadhi (Receipt Download)', description: 'Kuonyesha asilimia ya kupakua risiti au hati.', icon: '🧾' },
      { title: 'Ujazo wa Lengo la Pointi (Loyalty Points Progress)', description: 'Kuonyesha mteja amefikisha asilimia ngapi ya zawadi.', icon: '🎯' },
      { title: 'PapoPrint: Hali ya Uchapaji (Printing Progress)', description: 'Kuonyesha karatasi zinavyochapwa.', icon: '🖨️' }
    ],
    bestFor: 'Progress Bars, Milestone Badges & Print Status',
    performance: 'Smooth Clip & Overflow Masking',
    defaultText: 'PAPO PRINT: INACHAPA KAZI YAKO...'
  },
  {
    id: 'smoke-vapor-dissolve',
    name: 'Smoke & Vapor Dissolve',
    swahiliName: 'Moshi na Mvuke Unaoyeyuka',
    category: 'elegant',
    description: 'Maandishi yanayoonekana kama moshi mzito unaoyeyuka na kurudi kwa hisia ya siri na utulivu.',
    cssClassName: 'anim-smoke-vapor',
    cssKeyframes: `@keyframes smokeDrift {
  0% { filter: blur(0px); opacity: 1; transform: scale(1); }
  50% { filter: blur(6px); opacity: 0.4; transform: scale(1.05) translateY(-3px); }
  100% { filter: blur(0px); opacity: 1; transform: scale(1); }
}

.anim-smoke-vapor {
  display: inline-block;
  font-weight: 700;
  color: #e2e8f0;
  animation: smokeDrift 4s ease-in-out infinite;
  letter-spacing: 0.08em;
}`,
    tailwindExample: `<span className="font-bold text-slate-200 tracking-widest animate-pulse blur-[0.5px]">
  UTULIVU NA KASI
</span>`,
    recommendedPlaces: [
      { title: 'Sehemu za Kahawa, Chai & Shisha/Lounge', description: 'Vichwa vya menyu za vinywaji vya moto na lounges.', icon: '☕' },
      { title: 'Mawaidha & Dondoo za Usiku', description: 'Ujumbe wenye utulivu kwa wateja wakati wa usiku.', icon: '🌌' },
      { title: 'Huduma za Usafi & Spa (Cleaning / Wellness)', description: 'Kutoa hisia ya usafi, mvuke, na kupumzika.', icon: '🌿' }
    ],
    bestFor: 'Cafes, Hot Beverages, Spas & Night Promos',
    performance: 'Filter Blur Animation',
    defaultText: 'KAHWA FRESH & AROMA SPECIAL'
  },
  {
    id: 'letter-spacing-expand',
    name: 'Letter Spacing Kinetic Expansion',
    swahiliName: 'Kupanuka na Kujibana kwa Herufi (Kinetic)',
    category: 'elegant',
    description: 'Nafasi kati ya herufi inapanuka na kujibana kwa mtindo wa sinema (Cinematic Trailer Feel).',
    cssClassName: 'anim-spacing-expand',
    cssKeyframes: `@keyframes expandSpacing {
  0%, 100% { letter-spacing: 0.05em; transform: scale(1); }
  50% { letter-spacing: 0.28em; transform: scale(1.02); }
}

.anim-spacing-expand {
  display: inline-block;
  font-weight: 800;
  text-transform: uppercase;
  color: #f8fafc;
  animation: expandSpacing 3.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}`,
    tailwindExample: `<span className="font-extrabold uppercase tracking-widest text-white transition-all duration-700 hover:tracking-[0.3em]">
  PREMIUM COMFORT
</span>`,
    recommendedPlaces: [
      { title: 'Gari za Kifahari (Papo Comfort / Executive Taxi)', description: 'Kutangaza safari za heshima za wafanyabiashara na VIP.', icon: '🚘' },
      { title: 'Hoteli & Nyumba za Wageni (Papo Stay)', description: 'Kichwa cha vyumba vya kifahari na hoteli.', icon: '🏨' },
      { title: 'Ukurasa wa Utangulizi (Splash Screen Title)', description: 'Jina la app wakati inafunguka.', icon: '🎬' }
    ],
    bestFor: 'VIP Rides, Hotels, Luxury Cars & Splash Screen',
    performance: 'Hardware CSS Letter Spacing',
    defaultText: 'EXECUTIVE VIP SAFARI DAR'
  },
  {
    id: 'hologram-flicker',
    name: 'Holographic Scanline Flicker',
    swahiliName: 'Picha ya Hologramu ya Kisayansi',
    category: 'cyber',
    description: 'Mwangaza wa hologramu yenye mistari ya skrini (scanlines) inayomulika kama satelaiti za angani.',
    cssClassName: 'anim-hologram-flicker',
    cssKeyframes: `@keyframes scanlineFlicker {
  0%, 100% { opacity: 0.95; text-shadow: 0 0 10px #06b6d4, 0 0 20px #0891b2; }
  15% { opacity: 0.6; text-shadow: 0 0 4px #06b6d4; }
  35% { opacity: 1; text-shadow: 0 0 14px #22d3ee, 0 0 28px #06b6d4; }
  75% { opacity: 0.8; text-shadow: 0 0 6px #06b6d4; }
}

.anim-hologram-flicker {
  font-family: 'Space Grotesk', sans-serif;
  color: #a5f3fc;
  font-weight: 800;
  display: inline-block;
  animation: scanlineFlicker 2.8s infinite;
  letter-spacing: 0.08em;
}`,
    tailwindExample: `<span className="font-extrabold text-cyan-200 tracking-wider drop-shadow-[0_0_12px_rgba(6,182,212,0.9)] animate-pulse">
  LIVE GPS SATELLITE
</span>`,
    recommendedPlaces: [
      { title: 'Kifaa cha GPS cha Dereva (Live Tracking HUD)', description: 'Kwenye ramani kuonyesha mawimbi ya satelaiti yako imara.', icon: '🛰️' },
      { title: 'Uhesabuji wa Nauli ya Papo Hapo (Dynamic Meter)', description: 'Kuonyesha usahihi wa hesabu ya kilomita.', icon: '⏱️' },
      { title: 'Dira na Mwelekeo wa Gari (Heading Sensor)', description: 'Kwenye taarifa za kugeuka kushoto/kulia.', icon: '🧭' }
    ],
    bestFor: 'Driver HUD, Live GPS Tracker & Metrix Meter',
    performance: 'Zero Layout Shift Opacity Flicker',
    defaultText: 'GPS SATELLITE SYNC: 100% ACCURACY'
  },
  {
    id: 'bounce-elastic-drop',
    name: 'Bounce & Elastic Drop',
    swahiliName: 'Kudunda kwa Mpira wa Elastiki',
    category: 'dynamic',
    description: 'Herufi zinazodunda kwa bashasha na kuvuta hisia za furaha na shughuli za haraka.',
    cssClassName: 'anim-elastic-bounce',
    cssKeyframes: `@keyframes elasticBounce {
  0%, 100% { transform: translateY(0); }
  25% { transform: translateY(-12px) scaleY(1.08); }
  50% { transform: translateY(0) scaleY(0.92); }
  75% { transform: translateY(-5px); }
}

.anim-elastic-bounce {
  display: inline-block;
  font-weight: 900;
  color: #10b981;
  animation: elasticBounce 2s ease-in-out infinite;
}`,
    tailwindExample: `<span className="inline-block font-black text-emerald-500 animate-bounce">
  AGIZA SASA UPATE ZAWADI!
</span>`,
    recommendedPlaces: [
      { title: 'Vitufe vya "Agiza Sasa" (Order Now CTA)', description: 'Kushawishi mteja kubonyeza kitufe cha agizo.', icon: '🛒' },
      { title: 'Matangazo ya Vocha na Kuponi', description: 'Kuonyesha kuna zawadi inamsubiri mteja.', icon: '🎟️' },
      { title: 'Ujumbe wa Mwisho wa Safari (Trip Completed)', description: 'Kusherehekea safari kufanikiwa salama.', icon: '🏁' }
    ],
    bestFor: 'CTA Buttons, Completed Trip Badges & Gift Alerts',
    performance: 'GPU Keyframe Scale & Translate',
    defaultText: 'AGIZA SASA UOKOE TZS 3,000!'
  },
  {
    id: 'metallic-chrome-reflex',
    name: 'Metallic Chrome Reflex',
    swahiliName: 'Kioo cha Chuma Kilichong’aa (Chrome)',
    category: 'elegant',
    description: 'Muundo wa madini ya fedha na chuma kilichosafishwa yenye mistari ya mwanga inayopita katikati.',
    cssClassName: 'anim-metallic-chrome',
    cssKeyframes: `@keyframes chromeReflect {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.anim-metallic-chrome {
  background: linear-gradient(
    135deg, 
    #94a3b8 0%, 
    #f8fafc 25%, 
    #64748b 50%, 
    #ffffff 75%, 
    #475569 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-weight: 900;
  display: inline-block;
  animation: chromeReflect 4s linear infinite;
}`,
    tailwindExample: `<span className="bg-gradient-to-r from-slate-400 via-white to-slate-500 bg-[length:200%_auto] bg-clip-text text-transparent font-black">
  TITANIUM MEMBERSHIP
</span>`,
    recommendedPlaces: [
      { title: 'Hadhi ya Uanachama (Titanium / Platinum User)', description: 'Kutambua wateja wanaotumia app mara kwa mara.', icon: '🛡️' },
      { title: 'Kadi za Malipo ya Kielektroniki (Papo Card)', description: 'Vichwa vya kadi za kidijitali za malipo.', icon: '💳' },
      { title: 'Maduka ya Vifaa vya Simu na Kompyuta', description: 'Kategoria ya vifaa vya kielektroniki.', icon: '💻' }
    ],
    bestFor: 'Platinum Badges, Electronics & Membership Cards',
    performance: 'GPU Gradient Clip Position',
    defaultText: 'PAPO HAPO PLATINUM CLUB'
  },
  {
    id: 'curtain-reveal-sweep',
    name: 'Curtain Reveal Sweep',
    swahiliName: 'Kufungua Pazia la Maandishi',
    category: 'promo',
    description: 'Pazia linalofunguka kutoka kushoto kwenda kulia na kufichua maandishi kwa mvuto mkubwa.',
    cssClassName: 'anim-curtain-reveal',
    cssKeyframes: `@keyframes curtainSweep {
  0% { clip-path: inset(0 100% 0 0); }
  50% { clip-path: inset(0 0% 0 0); }
  100% { clip-path: inset(0 0% 0 0); }
}

.anim-curtain-reveal {
  display: inline-block;
  font-weight: 800;
  color: #ea580c;
  animation: curtainSweep 3s cubic-bezier(0.77, 0, 0.175, 1) infinite alternate;
}`,
    tailwindExample: `<span className="font-extrabold text-orange-600 transition-all duration-1000">
  IMEFUNGULIWA RASMI!
</span>`,
    recommendedPlaces: [
      { title: 'Ufunguzi wa Duka Jipya (Grand Opening)', description: 'Kutangaza mgahawa au duka jipya lililojiunga na app.', icon: '🏪' },
      { title: 'Uzinduzi wa Huduma Mpya (New Feature Launch)', description: 'Kutambulisha huduma mpya ya usafiri au uwasilishaji.', icon: '🚀' },
      { title: 'Matangazo Maalum ya Msimu', description: 'Kuonyesha ofa mpya iliyoanza leo.', icon: '📣' }
    ],
    bestFor: 'New Store Openings, Feature Launches & Major News',
    performance: 'Clean CSS Clip-Path Animation',
    defaultText: 'DUKA JIPYA LIMEJIUNGA: PIZZA HUT MIKOCHENI'
  },
  {
    id: 'disco-strobe-beat',
    name: 'Disco Strobe & Beat Flash',
    swahiliName: 'Mwanga wa Disco na Midundo ya Rangi',
    category: 'promo',
    description: 'Rangi zinazobadilika kwa mdundo wa muziki na kuongeza nguvu ya tamasha au ofa za wikiendi.',
    cssClassName: 'anim-disco-strobe',
    cssKeyframes: `@keyframes discoStrobe {
  0% { color: #f43f5e; text-shadow: 0 0 10px #e11d48; }
  25% { color: #a855f7; text-shadow: 0 0 10px #9333ea; }
  50% { color: #3b82f6; text-shadow: 0 0 10px #2563eb; }
  75% { color: #10b981; text-shadow: 0 0 10px #059669; }
  100% { color: #f59e0b; text-shadow: 0 0 10px #d97706; }
}

.anim-disco-strobe {
  font-weight: 900;
  display: inline-block;
  animation: discoStrobe 1.8s steps(5, end) infinite;
}`,
    tailwindExample: `<span className="font-black text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]">
  WIKIENDI PARTY DEALS!
</span>`,
    recommendedPlaces: [
      { title: 'Ofa za Mwisho wa Wiki (Weekend Flash Deals)', description: 'Vichwa vya matangazo ya Ijumaa hadi Jumapili.', icon: '🎉' },
      { title: 'Tiketi za Matamasha (Papo Ticket Events)', description: 'Kutangaza matamasha ya muziki na burudani.', icon: '🎟️' },
      { title: 'Happy Hour ya Vyakula na Vinywaji', description: 'Punguzo la bei za vyakula vya jioni.', icon: '🍹' }
    ],
    bestFor: 'Weekend Specials, Concert Tickets & Happy Hours',
    performance: 'Steps() CSS Color Palette Switch',
    defaultText: 'PARTY WIKIENDI: TIKETI ZA SHOW ZIPO TAYARI'
  },
  {
    id: 'paper-cut-3d',
    name: 'Paper Cut Multi-layer 3D',
    swahiliName: 'Karatasi ya Tabaka za 3D',
    category: 'elegant',
    description: 'Muonekano wa tabaka za karatasi zilizokatwa kwa umakini zikitoa vivuli halisi vyenye kina.',
    cssClassName: 'anim-paper-cut',
    cssKeyframes: `@keyframes paperShadowFloat {
  0%, 100% {
    text-shadow: 
      0 1px 0 #cbd5e1,
      0 2px 0 #94a3b8,
      0 3px 0 #64748b,
      0 6px 12px rgba(0, 0, 0, 0.25);
    transform: translateY(0);
  }
  50% {
    text-shadow: 
      0 2px 0 #cbd5e1,
      0 4px 0 #94a3b8,
      0 6px 0 #64748b,
      0 12px 24px rgba(0, 0, 0, 0.35);
    transform: translateY(-4px);
  }
}

.anim-paper-cut {
  color: #ffffff;
  font-weight: 900;
  display: inline-block;
  animation: paperShadowFloat 3s ease-in-out infinite;
}`,
    tailwindExample: `<span className="font-black text-white [text-shadow:0_2px_0_#94a3b8,0_4px_0_#64748b,0_8px_16px_rgba(0,0,0,0.3)]">
  PAPO HAPO APP
</span>`,
    recommendedPlaces: [
      { title: 'Vichwa vya Sehemu ya Elimu & Msaada (FAQ / Help)', description: 'Kufanya mwonekano wa vitabu na maelezo kuwa safi.', icon: '📚' },
      { title: 'Kadi za Risiti na Ankara (Invoices)', description: 'Kutoa hisia ya stakabadhi halisi ya karatasi.', icon: '📄' },
      { title: 'Vichwa vya Wasifu wa Dereva na Mteja', description: 'Kuweka hisia ya hadhi na usafi wa muundo.', icon: '👤' }
    ],
    bestFor: 'Help Guides, Receipts & Profile Cards',
    performance: 'Layered Offset Shadows',
    defaultText: 'HUDUMA BORA NA YA UHAKIKA TANZANIA'
  },
  {
    id: 'blur-focus-reveal',
    name: 'Blur Focus to Crisp In',
    swahiliName: 'Kurekebisha Lenzi kutoka Ukungu hadi Safi',
    category: 'dynamic',
    description: 'Maandishi yanayotoka kwenye ukungu mzito na kuwa safi kabisa kama lenzi ya kamera ya kitaalamu.',
    cssClassName: 'anim-blur-focus',
    cssKeyframes: `@keyframes blurToFocus {
  0% { filter: blur(12px); opacity: 0.2; transform: scale(1.15); }
  50% { filter: blur(0px); opacity: 1; transform: scale(1); }
  85% { filter: blur(0px); opacity: 1; transform: scale(1); }
  100% { filter: blur(12px); opacity: 0.2; transform: scale(1.15); }
}

.anim-blur-focus {
  display: inline-block;
  font-weight: 800;
  color: #38bdf8;
  animation: blurToFocus 3.5s ease-in-out infinite;
}`,
    tailwindExample: `<span className="font-extrabold text-sky-400 transition-all duration-700 hover:blur-0">
  TAZAMA OFFA HAPA
</span>`,
    recommendedPlaces: [
      { title: 'Kufichua Nambari ya Siri (OTP / Secret Promo Code)', description: 'Wakati kodi ya punguzo inapoonekana kwa mara ya kwanza.', icon: '🔢' },
      { title: 'Matangazo ya Siri (Secret Deals)', description: 'Kuvutia mteja kubonyeza ili kuona ofa iliyojificha.', icon: '🎁' },
      { title: 'Kuthibitisha Dereva Aliyekubali Safari', description: 'Kuonyesha maelezo ya dereva yanapojitokeza.', icon: '🪪' }
    ],
    bestFor: 'Promo Code Reveals, Secret Deals & Driver Verification',
    performance: 'Hardware Blur Interpolation',
    defaultText: 'KODI YA OFFA: PAPO50 (PUNGUZO 50%)'
  },
  {
    id: 'floating-magnet',
    name: 'Floating Magnet Levitation',
    swahiliName: 'Kuelea Hewani kama Sumaku',
    category: 'elegant',
    description: 'Maandishi yanayoelea taratibu bila kugusa ardhi kama nguvu ya sumaku inayovuta hewani.',
    cssClassName: 'anim-floating-magnet',
    cssKeyframes: `@keyframes floatMagnet {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  25% { transform: translateY(-6px) rotate(0.5deg); }
  75% { transform: translateY(4px) rotate(-0.5deg); }
}

.anim-floating-magnet {
  display: inline-block;
  font-weight: 800;
  color: #f43f5e;
  animation: floatMagnet 4s ease-in-out infinite;
}`,
    tailwindExample: `<span className="inline-block font-extrabold text-rose-500 animate-pulse">
  BEI NAFUU KULIKO WOTE
</span>`,
    recommendedPlaces: [
      { title: 'Beji ya Bei Nafuu (Best Price Guarantee)', description: 'Kuthibitisha bei zetu ni nafuu zaidi sokoni.', icon: '💰' },
      { title: 'Alama ya Bure (Free Delivery Badge)', description: 'Kuonyesha usafirishaji wa bure bila malipo ya ziada.', icon: '🚚' },
      { title: 'Kadi za Ofa za PapoSend', description: 'Kutangaza vifurushi vinavyosafirishwa kwa bei poa.', icon: '📦' }
    ],
    bestFor: 'Free Delivery Badges, Lowest Price Icons & Send Hub',
    performance: 'Zero Reflow GPU Translate',
    defaultText: 'USAFIRISHAJI BURE: AGIZA SASA'
  },
  {
    id: 'electric-arc-sparks',
    name: 'Electric Arc Sparks',
    swahiliName: 'Mlipuko wa Cheche za Umeme',
    category: 'cyber',
    description: 'Cheche za umeme zenye nguvu ya juu zinazopita juu ya herufi zikionyesha kasi ya ajabu ya huduma.',
    cssClassName: 'anim-electric-sparks',
    cssKeyframes: `@keyframes electricZap {
  0%, 100% {
    text-shadow: 
      0 0 4px #e0f2fe,
      0 0 10px #38bdf8,
      0 0 20px #0284c7;
    color: #f0f9ff;
  }
  20% {
    text-shadow: 
      0 0 2px #fff,
      0 0 6px #7dd3fc,
      0 0 12px #0369a1;
  }
  40% {
    text-shadow: 
      0 0 8px #fff,
      0 0 18px #38bdf8,
      0 0 35px #0284c7,
      0 0 50px #0369a1;
    color: #ffffff;
  }
  70% {
    text-shadow: 
      0 0 3px #e0f2fe,
      0 0 8px #38bdf8;
  }
}

.anim-electric-sparks {
  font-weight: 900;
  display: inline-block;
  animation: electricZap 1.5s infinite ease-in-out;
  letter-spacing: 0.05em;
}`,
    tailwindExample: `<span className="font-black text-sky-100 drop-shadow-[0_0_15px_rgba(56,189,248,0.9)]">
  ⚡ KASI YA UMEME DAKIKA 5
</span>`,
    recommendedPlaces: [
      { title: 'Uwasilishaji wa Kasi ya Dakika 15 (Superfast Delivery)', description: 'Kuonyesha bidhaa zinaletwa kwa kasi kubwa.', icon: '⚡' },
      { title: 'Usafiri wa Bodaboda ya Papo Express', description: 'Kutofautisha huduma za haraka za pikipiki mjini.', icon: '🏍️' },
      { title: 'Madawa ya Dharura (Emergency Pharmacy Delivery)', description: 'Kuonyesha huduma ya dharura inafika mara moja.', icon: '💊' }
    ],
    bestFor: 'Express Deliveries, Bodaboda Speed & Emergency Pharmacy',
    performance: 'Rapid Text-Shadow Glow',
    defaultText: '⚡ PAPO EXPRESS: INAFIKA NDANI YA DAKIKA 15'
  },
  {
    id: 'comic-boom-pop',
    name: 'Comic Boom Pop-Art',
    swahiliName: 'Katuni ya Pop-Art ya Vibonzo',
    category: 'promo',
    description: 'Mtindo wa katuni zenye mipaka mikubwa meusi na rangi ya njano inayong’aa kama magazeti ya vibonzo vya Marvel.',
    cssClassName: 'anim-comic-boom',
    cssKeyframes: `@keyframes comicThump {
  0%, 100% { transform: scale(1) rotate(-1deg); }
  50% { transform: scale(1.08) rotate(1deg); }
}

.anim-comic-boom {
  display: inline-block;
  font-weight: 900;
  color: #facc15;
  -webkit-text-stroke: 1.5px #000000;
  text-shadow: 
    3px 3px 0 #000000,
    5px 5px 0 #ea580c;
  animation: comicThump 1.8s ease-in-out infinite;
  letter-spacing: 0.04em;
}`,
    tailwindExample: `<span className="font-black text-yellow-400 [text-shadow:3px_3px_0_#000,5px_5px_0_#ea580c]">
  BOOM! OFFA KABAMBE
</span>`,
    recommendedPlaces: [
      { title: 'Ofa za Watoto & Vinyago (Toys & Kids Section)', description: 'Kwenye kategoria ya watoto, chips, na peremende.', icon: '🧸' },
      { title: 'Matangazo ya "BOOM! PUNGUZO LA BEI"', description: 'Mabango yanayotakiwa kuvutia jicho kwa sekunde moja.', icon: '💥' },
      { title: 'Sherehe za Birthday & Zawadi', description: 'Kuongeza bashasha ya siku za kuzaliwa.', icon: '🎂' }
    ],
    bestFor: 'Kids Corner, Pop Sales & Super Discount Alerts',
    performance: 'Text Stroke + Offset Shadow',
    defaultText: 'BOOM! AGIZA BURGER PATA SODA BURE'
  },
  {
    id: 'gradient-flow-stream',
    name: 'Gradient Flow Stream',
    swahiliName: 'Mtiririko wa Rangi 4 Bila Mwisho',
    category: 'elegant',
    description: 'Mtiririko laini na usio na kikomo wa mchanganyiko wa rangi nne za kisasa zinazoboresha mwonekano wa UI nzima.',
    cssClassName: 'anim-gradient-flow',
    cssKeyframes: `@keyframes gradientFlow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.anim-gradient-flow {
  background: linear-gradient(
    90deg, 
    #ea580c, 
    #ec4899, 
    #8b5cf6, 
    #06b6d4, 
    #ea580c
  );
  background-size: 300% 300%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-weight: 800;
  display: inline-block;
  animation: gradientFlow 5s ease infinite;
}`,
    tailwindExample: `<span className="bg-gradient-to-r from-orange-500 via-pink-500 via-purple-500 to-cyan-500 bg-[length:200%_auto] bg-clip-text text-transparent font-extrabold animate-gradient">
  PAPO HAPO MULTI-SERVICE
</span>`,
    recommendedPlaces: [
      { title: 'Jina Kuu la App (Header Brand Title)', description: 'Kwenye nembo ya juu ya ukurasa wa nyumbani.', icon: '👑' },
      { title: 'Kadi Kuu ya Huduma Zote (All-in-One Super App)', description: 'Kutangaza mchanganyiko wa vyakula, usafiri na vifurushi.', icon: '🌐' },
      { title: 'Footer & About Page Branding', description: 'Kuonyesha ubunifu na usasa wa chapa ya Papo Hapo.', icon: '💎' }
    ],
    bestFor: 'Main Logo, Super App Banners & App Headers',
    performance: 'Seamless GPU Background Gradient',
    defaultText: 'PAPO HAPO: APP YA HUDUMA ZOTE TANZANIA'
  },
  {
    id: 'neon-border-stroke',
    name: 'Neon Border Stroke Draw',
    swahiliName: 'Mchoro wa Mpaka wa Neon (Outline Stroke)',
    category: 'neon',
    description: 'Herufi zinazoonekana kama waya za neon zenye mistari ya nje inayowaka na kupumua.',
    cssClassName: 'anim-neon-stroke',
    cssKeyframes: `@keyframes neonStrokePulse {
  0%, 100% {
    -webkit-text-stroke: 1.5px #10b981;
    color: transparent;
    filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.6));
  }
  50% {
    -webkit-text-stroke: 1.5px #34d399;
    color: rgba(16, 185, 129, 0.15);
    filter: drop-shadow(0 0 14px rgba(52, 211, 153, 0.9));
  }
}

.anim-neon-stroke {
  font-weight: 900;
  display: inline-block;
  animation: neonStrokePulse 2.5s ease-in-out infinite;
  letter-spacing: 0.06em;
}`,
    tailwindExample: `<span className="font-black text-transparent [-webkit-text-stroke:1.5px_#10b981] drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]">
  HALISI NA SALAMA
</span>`,
    recommendedPlaces: [
      { title: 'Vyakula Halisi vya Asili & Fresh Farm', description: 'Kwenye mboga, matunda na vyakula asilia vya shambani.', icon: '🥬' },
      { title: 'Vyeti na Ithibati za Madereva (Verified Drivers)', description: 'Kuonyesha dereva amethibitishwa na kukaguliwa.', icon: '🛡️' },
      { title: 'Huduma za Dawa za Asili na Afya', description: 'Kategoria ya dawa na afya ya jamii.', icon: '🌿' }
    ],
    bestFor: 'Verified Badges, Fresh Farm Groceries & Natural Health',
    performance: 'Hardware Stroke & Drop-Shadow',
    defaultText: 'DEREVA AMETHIBITISHWA: LESENI NA BIMA TAYARI'
  },
  {
    id: 'sunset-mirage-ripple',
    name: 'Sunset Mirage Ripple',
    swahiliName: 'Mawimbi ya Joto la Machweo ya Jua',
    category: 'promo',
    description: 'Mawimbi ya joto ya rangi ya machweo (sunset orange & violet) yanayotembea kwa mdundo wa utulivu wa jioni.',
    cssClassName: 'anim-sunset-mirage',
    cssKeyframes: `@keyframes sunsetRipple {
  0%, 100% {
    background-position: 0% 50%;
    transform: skewX(0deg);
  }
  50% {
    background-position: 100% 50%;
    transform: skewX(-2deg);
  }
}

.anim-sunset-mirage {
  background: linear-gradient(
    45deg, 
    #ea580c, 
    #db2777, 
    #7c3aed, 
    #ea580c
  );
  background-size: 250% 250%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-weight: 800;
  display: inline-block;
  animation: sunsetRipple 4.5s ease-in-out infinite;
}`,
    tailwindExample: `<span className="bg-gradient-to-r from-orange-500 via-pink-600 to-purple-600 bg-[length:200%_auto] bg-clip-text text-transparent font-extrabold">
  OFFA ZA JIONI
</span>`,
    recommendedPlaces: [
      { title: 'Ofa za Jioni (Sunset & Dinner Specials)', description: 'Vyakula vya jioni na oda za chakula cha usiku nyumbani.', icon: '🌅' },
      { title: 'Safari za Kurudi Nyumbani (Evening Rush Hour Ride)', description: 'Kutangaza punguzo la usafiri wa jioni baada ya kazi.', icon: '🌇' },
      { title: 'Ofa za Ramadan / Iftar Specials', description: 'Vyakula na mikate maalum ya kufuturu jioni.', icon: '🌙' }
    ],
    bestFor: 'Evening Commute, Dinner Promos & Ramadan Iftar',
    performance: 'Subtle Skew + Smooth Gradient',
    defaultText: 'IFTAR SPECIAL: FUTARI FRESH INAFIKA NYUMBANI'
  }
];

export function CssAnimatedTextStudio() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customTestText, setCustomTestText] = useState<string>('');
  const [bgMode, setBgMode] = useState<'dark' | 'black' | 'light' | 'gradient' | 'grid'>('dark');
  const [fontSize, setFontSize] = useState<number>(22);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedHtmlId, setCopiedHtmlId] = useState<string | null>(null);
  const [selectedAnimationForModal, setSelectedAnimationForModal] = useState<TextAnimationItem | null>(null);
  const [activeTabCode, setActiveTabCode] = useState<'css' | 'tailwind' | 'usage'>('css');

  const filteredAnimations = useMemo(() => {
    return TEXT_ANIMATIONS_DATA.filter((item) => {
      const matchCat = activeCategory === 'all' || item.category === activeCategory;
      const matchSearch = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.swahiliName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.bestFor.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  const handleCopyCss = (item: TextAnimationItem) => {
    navigator.clipboard.writeText(item.cssKeyframes);
    setCopiedId(item.id);
    toast.success(`CSS Code ya "${item.name}" imenakiliwa kwenye clipboard!`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopyTailwind = (item: TextAnimationItem) => {
    navigator.clipboard.writeText(item.tailwindExample);
    setCopiedHtmlId(item.id);
    toast.success(`HTML/Tailwind Code ya "${item.name}" imenakiliwa!`);
    setTimeout(() => setCopiedHtmlId(null), 2500);
  };

  const getCardBgClass = () => {
    switch (bgMode) {
      case 'black':
        return 'bg-[#050508] border-neutral-800 text-white';
      case 'light':
        return 'bg-neutral-100 border-neutral-300 text-neutral-900';
      case 'gradient':
        return 'bg-gradient-to-br from-[#0c0f1d] via-[#161224] to-[#1a0e1c] border-purple-900/40 text-white';
      case 'grid':
        return 'bg-[#0a0a10] bg-[radial-gradient(#27273a_1px,transparent_1px)] [background-size:16px_16px] border-neutral-800 text-white';
      case 'dark':
      default:
        return 'bg-[#11111a] border-neutral-800 text-white';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Dynamic Embedded CSS Stylesheet for all 25 Animations */}
      <style dangerouslySetInnerHTML={{
        __html: TEXT_ANIMATIONS_DATA.map(a => a.cssKeyframes).join('\n\n')
      }} />

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900 via-[#181226] to-[#251020] border border-purple-500/20 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-orange-500/15 via-purple-500/15 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5" />
              Admin Exclusive Studio • 25 Animations
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-orange-500 shrink-0 animate-pulse" />
              CSS Animated Text Suite
            </h1>
            <p className="text-sm sm:text-base text-neutral-300 font-medium leading-relaxed">
              Mkusanyiko kamili wa michoro 25 ya maandishi (Hardware-Accelerated CSS Text Animations) yenye miongozo ya maeneo sahihi ya kutumia kwenye app, kanuni kamili za CSS, na kioo cha majaribio ya papo hapo (*Live Preview*).
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex flex-wrap items-center gap-3 bg-neutral-900/90 border border-neutral-800 p-3 rounded-2xl backdrop-blur-md">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 font-black text-sm">
              <Zap className="w-4 h-4" />
              <span>25 Animations</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs">
              <Award className="w-4 h-4" />
              <span>60 FPS GPU Ready</span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Interactive Controls Bar */}
      <div className="bg-[#12121c] border border-neutral-800/80 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Custom Text Live Tester Input */}
          <div className="flex-1 relative">
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
              Jaribu Maandishi Yako (Live Global Text Tester)
            </label>
            <div className="relative">
              <input
                type="text"
                value={customTestText}
                onChange={(e) => setCustomTestText(e.target.value)}
                placeholder="Andika hapa kujaribu (mfano: OFFA KABAMBE YA 50% LEO!)..."
                className="w-full bg-[#1a1a28] border border-neutral-700 text-white placeholder-neutral-500 px-4 py-2.5 rounded-xl text-sm font-semibold focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
              {customTestText && (
                <button
                  onClick={() => setCustomTestText('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-white bg-neutral-800 px-2 py-0.5 rounded-md"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-5">
            <span className="text-xs text-neutral-400 font-medium hidden lg:inline">Sampuli:</span>
            {[
              'OFFA YA 50% 🔥',
              'PAPO HAPO VIP 👑',
              'RAMADAN KAREEM 🌙',
              'DEREVA AMEFIKA 🛵',
              'SAVE TZS 5,000 🎁'
            ].map((preset) => (
              <button
                key={preset}
                onClick={() => setCustomTestText(preset)}
                className="px-2.5 py-1.5 bg-[#1e1e2f] hover:bg-orange-500/20 hover:border-orange-500/50 border border-neutral-700 text-xs font-bold text-neutral-300 hover:text-orange-400 rounded-lg transition-all"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders and Visual Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-neutral-800/80">
          
          {/* Font Size Adjuster */}
          <div>
            <div className="flex justify-between text-xs font-bold text-neutral-400 mb-1">
              <span>Ukubwa wa Fonti:</span>
              <span className="text-orange-400">{fontSize}px</span>
            </div>
            <input
              type="range"
              min="14"
              max="38"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-1.5 bg-neutral-700 rounded-lg"
            />
          </div>

          {/* Background Canvas Mode Selector */}
          <div>
            <span className="block text-xs font-bold text-neutral-400 mb-1.5">Mandhari ya Kioo (Background):</span>
            <div className="flex items-center gap-1.5">
              {[
                { id: 'dark', label: 'Dark', icon: Moon },
                { id: 'black', label: 'Black', icon: Terminal },
                { id: 'light', label: 'Light', icon: Sun },
                { id: 'gradient', label: 'Mesh', icon: Palette },
                { id: 'grid', label: 'Grid', icon: Layout }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setBgMode(m.id as any)}
                  className={`flex-1 py-1 px-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                    bgMode === m.id
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'bg-[#1e1e2e] text-neutral-400 hover:text-white border border-neutral-700'
                  }`}
                >
                  <m.icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search Filter */}
          <div className="sm:col-span-2">
            <span className="block text-xs font-bold text-neutral-400 mb-1.5">Tafuta Animation au Sehemu:</span>
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tafuta kwa jina (mfano: Neon, Gold, Glitch, Driver, Flash Sale)..."
                className="w-full bg-[#1a1a28] border border-neutral-700 text-white placeholder-neutral-500 pl-9 pr-4 py-1.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'all', label: 'Animations Zote (25)', icon: Zap },
          { id: 'promo', label: 'Mabango & Ofa (Promo & Deals)', icon: Flame },
          { id: 'neon', label: 'Neon & Usiku (Night Mode)', icon: Sparkles },
          { id: 'cyber', label: 'Tech & GPS (Cyber/Matrix)', icon: Terminal },
          { id: 'dynamic', label: 'Mwendo & Miondoko (Kinetic)', icon: Rocket },
          { id: 'elegant', label: 'Kifahari & VIP (Luxury)', icon: Award },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                : 'bg-[#141420] text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <cat.icon className="w-3.5 h-3.5" />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid of 25 Animated Text Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredAnimations.map((anim, index) => {
          const displayText = customTestText.trim() || anim.defaultText;
          return (
            <div
              key={anim.id}
              className="bg-[#12121d] border border-neutral-800/90 hover:border-neutral-700 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between transition-all duration-300 group"
            >
              {/* Card Header Bar */}
              <div className="p-4 border-b border-neutral-800/80 bg-[#161624] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 font-black text-xs flex items-center justify-center">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-bold text-white text-sm group-hover:text-orange-400 transition-colors">
                      {anim.name}
                    </h3>
                    <p className="text-[11px] text-neutral-400 font-medium">
                      {anim.swahiliName}
                    </p>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-[10px] font-bold text-neutral-300 uppercase">
                  {anim.category}
                </span>
              </div>

              {/* Live Preview Display Box */}
              <div 
                className={`p-6 sm:p-8 min-h-[150px] flex items-center justify-center text-center transition-all duration-300 relative overflow-hidden ${getCardBgClass()}`}
              >
                {/* Special rendering for Wave text requiring span wrappers */}
                {anim.id === 'wave-text-cascade' ? (
                  <div className="anim-wave-text" style={{ fontSize: `${fontSize}px` }}>
                    {displayText.split('').map((char, i) => (
                      <span key={i}>{char === ' ' ? '\u00A0' : char}</span>
                    ))}
                  </div>
                ) : (
                  <div 
                    className={anim.cssClassName}
                    style={{ fontSize: `${fontSize}px`, lineHeight: 1.3 }}
                  >
                    {displayText}
                  </div>
                )}
              </div>

              {/* Best UI Locations & Usage Guide */}
              <div className="p-4 bg-[#141422] border-t border-neutral-800/70 space-y-3">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5" />
                    Maeneo Yanayofaa Kutumika (Best Places):
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {anim.recommendedPlaces.map((place, pIdx) => (
                      <div key={pIdx} className="flex items-start gap-2 bg-[#1b1b2c] p-2 rounded-xl border border-neutral-800/70 text-xs">
                        <span className="text-sm shrink-0">{place.icon}</span>
                        <div>
                          <strong className="text-neutral-200 font-semibold block">{place.title}</strong>
                          <span className="text-[11px] text-neutral-400 leading-tight">{place.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Performance & Best For Tag */}
                <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1 border-t border-neutral-800/60">
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <Zap className="w-3 h-3" /> {anim.performance}
                  </span>
                  <span className="text-neutral-400 font-medium">
                    {anim.bestFor}
                  </span>
                </div>

                {/* Action Buttons: Copy CSS, Copy HTML, Inspect Modal */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => handleCopyCss(anim)}
                    className="py-2 px-2.5 rounded-xl bg-orange-500/10 hover:bg-orange-500 text-orange-400 hover:text-white border border-orange-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    {copiedId === anim.id ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === anim.id ? 'Imenakiliwa' : 'Copy CSS'}</span>
                  </button>

                  <button
                    onClick={() => handleCopyTailwind(anim)}
                    className="py-2 px-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    {copiedHtmlId === anim.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code2 className="w-3.5 h-3.5" />}
                    <span>React/HTML</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedAnimationForModal(anim);
                      setActiveTabCode('css');
                    }}
                    className="py-2 px-2.5 rounded-xl bg-[#1e1e30] hover:bg-neutral-700 text-neutral-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Tazama Code</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Code Inspection & Integration Modal */}
      <AnimatePresence>
        {selectedAnimationForModal && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#11111a] border border-neutral-700 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-5 bg-[#171726] border-b border-neutral-800 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-orange-500" />
                    {selectedAnimationForModal.name}
                  </h3>
                  <p className="text-xs text-neutral-400 font-medium">
                    {selectedAnimationForModal.swahiliName} • {selectedAnimationForModal.category.toUpperCase()}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedAnimationForModal(null)}
                  className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              {/* Modal Live Interactive Banner */}
              <div className="p-6 bg-[#09090f] border-b border-neutral-800 flex items-center justify-center text-center">
                <div 
                  className={selectedAnimationForModal.cssClassName}
                  style={{ fontSize: '28px' }}
                >
                  {customTestText.trim() || selectedAnimationForModal.defaultText}
                </div>
              </div>

              {/* Code Tab Switcher */}
              <div className="flex border-b border-neutral-800 bg-[#141420] px-5 gap-4">
                <button
                  onClick={() => setActiveTabCode('css')}
                  className={`py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
                    activeTabCode === 'css'
                      ? 'border-orange-500 text-orange-400'
                      : 'border-transparent text-neutral-400 hover:text-white'
                  }`}
                >
                  <Code2 className="w-4 h-4" />
                  CSS Code & Keyframes
                </button>
                <button
                  onClick={() => setActiveTabCode('tailwind')}
                  className={`py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
                    activeTabCode === 'tailwind'
                      ? 'border-orange-500 text-orange-400'
                      : 'border-transparent text-neutral-400 hover:text-white'
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  Tailwind / JSX Snippet
                </button>
                <button
                  onClick={() => setActiveTabCode('usage')}
                  className={`py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
                    activeTabCode === 'usage'
                      ? 'border-orange-500 text-orange-400'
                      : 'border-transparent text-neutral-400 hover:text-white'
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  Miongozo ya Matumizi
                </button>
              </div>

              {/* Modal Code Body */}
              <div className="p-5 overflow-y-auto flex-1 space-y-4 font-mono text-xs text-neutral-300">
                {activeTabCode === 'css' && (
                  <div className="relative">
                    <button
                      onClick={() => handleCopyCss(selectedAnimationForModal)}
                      className="absolute right-3 top-3 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Nakili CSS
                    </button>
                    <pre className="bg-[#0b0b12] p-4 rounded-2xl border border-neutral-800 overflow-x-auto text-emerald-400 leading-relaxed">
                      {selectedAnimationForModal.cssKeyframes}
                    </pre>
                  </div>
                )}

                {activeTabCode === 'tailwind' && (
                  <div className="relative">
                    <button
                      onClick={() => handleCopyTailwind(selectedAnimationForModal)}
                      className="absolute right-3 top-3 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Nakili JSX
                    </button>
                    <pre className="bg-[#0b0b12] p-4 rounded-2xl border border-neutral-800 overflow-x-auto text-cyan-400 leading-relaxed">
                      {selectedAnimationForModal.tailwindExample}
                    </pre>
                  </div>
                )}

                {activeTabCode === 'usage' && (
                  <div className="font-sans space-y-3 text-neutral-200">
                    <p className="text-sm font-medium leading-relaxed text-neutral-300">
                      {selectedAnimationForModal.description}
                    </p>
                    <div className="space-y-2 pt-2">
                      <h4 className="font-bold text-orange-400 text-xs uppercase tracking-wider">
                        Maeneo Yanayopendekezwa (Recommended UI Placements):
                      </h4>
                      {selectedAnimationForModal.recommendedPlaces.map((pl, idx) => (
                        <div key={idx} className="bg-[#161626] p-3 rounded-xl border border-neutral-800 flex items-start gap-3">
                          <span className="text-xl">{pl.icon}</span>
                          <div>
                            <strong className="text-white text-sm block">{pl.title}</strong>
                            <p className="text-xs text-neutral-400">{pl.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-[#141420] border-t border-neutral-800 flex items-center justify-between">
                <span className="text-xs text-neutral-400 font-sans">
                  🔒 Imefungwa kwa ajili ya Admin Dashboard Pekee
                </span>
                <button
                  onClick={() => setSelectedAnimationForModal(null)}
                  className="px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs cursor-pointer font-sans"
                >
                  Funga
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
