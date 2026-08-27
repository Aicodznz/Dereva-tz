import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Copy, Check, X, Play, RefreshCw, Layers } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { toast } from 'sonner';

export interface TextAnimationItem {
  id: string;
  name: string;
  className: string;
  duration: string;
  timing: string;
  category: 'playful' | 'entrance' | 'glow-reveal' | 'pulse-attention';
  cssCode: string;
  recommendedUse: string;
}

export const ALL_TEXT_ANIMATIONS: TextAnimationItem[] = [
  // Playful & Physics
  {
    id: 'swing',
    name: 'Swing',
    className: 'animate-swing',
    duration: '1.6s',
    timing: 'infinite ease-in-out',
    category: 'playful',
    cssCode: `.text {\n  animation: swing 1.6s infinite;\n}`,
    recommendedUse: 'Mabango ya ofa, kengele za tahadhari, na kadi za punguzo',
  },
  {
    id: 'jello',
    name: 'Jello',
    className: 'animate-jello',
    duration: '1.6s',
    timing: 'infinite both',
    category: 'playful',
    cssCode: `.text {\n  animation: jello 1.6s infinite;\n}`,
    recommendedUse: 'Vitufe vya kuthibitisha malipo na ofa za papo hapo',
  },
  {
    id: 'wobble',
    name: 'Wobble',
    className: 'animate-wobble',
    duration: '1.6s',
    timing: 'infinite ease-in-out',
    category: 'playful',
    cssCode: `.text {\n  animation: wobble 1.6s infinite;\n}`,
    recommendedUse: 'Taarifa za dharura na arifa zinazohitaji umakini',
  },
  {
    id: 'rubberBand',
    name: 'RubberBand',
    className: 'animate-rubberBand',
    duration: '1.6s',
    timing: 'infinite',
    category: 'playful',
    cssCode: `.text {\n  animation: rubberBand 1.6s infinite;\n}`,
    recommendedUse: 'Kodi za vocha (PATA-TZ1000) na beji za Zawadi 🎁',
  },
  {
    id: 'shakeX',
    name: 'ShakeX',
    className: 'animate-shakeX',
    duration: '1.6s',
    timing: 'infinite',
    category: 'playful',
    cssCode: `.text {\n  animation: shakeX 1.6s infinite;\n}`,
    recommendedUse: 'Meseji za makosa ya mtandao na viashiria vya kuchelewa',
  },
  {
    id: 'flash',
    name: 'Flash',
    className: 'animate-flash',
    duration: '1.6s',
    timing: 'infinite',
    category: 'playful',
    cssCode: `.text {\n  animation: flash 1.6s infinite;\n}`,
    recommendedUse: 'Status ya dereva anapokaribia kufika eneo lako',
  },

  // Entrance & Transitions
  {
    id: 'lightSpeedInLeft',
    name: 'LightSpeedInLeft',
    className: 'animate-lightSpeedInLeft',
    duration: '1.8s',
    timing: 'infinite ease-out',
    category: 'entrance',
    cssCode: `.text {\n  animation: lightSpeedInLeft 1.8s infinite;\n}`,
    recommendedUse: 'Magari na pikipiki zinazowasili haraka',
  },
  {
    id: 'rotateIn',
    name: 'RotateIn',
    className: 'animate-rotateIn',
    duration: '1.8s',
    timing: 'infinite',
    category: 'entrance',
    cssCode: `.text {\n  animation: rotateIn 1.8s infinite;\n}`,
    recommendedUse: 'Alama za upakiaji wa ramani na mwelekeo wa dira',
  },
  {
    id: 'rollIn',
    name: 'RollIn',
    className: 'animate-rollIn',
    duration: '1.8s',
    timing: 'infinite',
    category: 'entrance',
    cssCode: `.text {\n  animation: rollIn 1.8s infinite;\n}`,
    recommendedUse: 'Beji za madereva wapya na takwimu za safari',
  },
  {
    id: 'jackInTheBox',
    name: 'JackInTheBox',
    className: 'animate-jackInTheBox',
    duration: '1.8s',
    timing: 'infinite',
    category: 'entrance',
    cssCode: `.text {\n  animation: jackInTheBox 1.8s infinite;\n}`,
    recommendedUse: 'Ujumbe wa ushindi wa pointi za uaminifu (Loyalty Rewards)',
  },
  {
    id: 'bounceIn',
    name: 'BounceIn',
    className: 'animate-bounceIn',
    duration: '1.8s',
    timing: 'infinite',
    category: 'entrance',
    cssCode: `.text {\n  animation: bounceIn 1.8s infinite;\n}`,
    recommendedUse: 'Kadi ya mwaliko wa Share Pata na ofa za vocha',
  },
  {
    id: 'slideInUp',
    name: 'SlideInUp',
    className: 'animate-slideInUp',
    duration: '1.8s',
    timing: 'infinite ease-out',
    category: 'entrance',
    cssCode: `.text {\n  animation: slideInUp 1.8s infinite;\n}`,
    recommendedUse: 'Orodha ya mapendekezo ya maeneo na njia mbadala',
  },

  // Glow, Typing & Reveal
  {
    id: 'fadeUp',
    name: 'FadeUp',
    className: 'animate-fadeUp',
    duration: '3.0s',
    timing: 'infinite ease-in-out',
    category: 'glow-reveal',
    cssCode: `.fade {\n  animation: fadeUp 3s infinite;\n}`,
    recommendedUse: 'Maneno ya kutafuta dereva: "Inatafuta dereva..."',
  },
  {
    id: 'typing',
    name: 'Typing & Blink',
    className: 'animate-typing',
    duration: '4.0s',
    timing: 'steps(20) infinite',
    category: 'glow-reveal',
    cssCode: `.type {\n  animation: typing 4s steps(20) infinite,\n  blink .6s infinite;\n}`,
    recommendedUse: 'Ujumbe wa msaidizi wa AI na maelekezo ya dereva',
  },
  {
    id: 'gradientFlow',
    name: 'GradientFlow',
    className: 'animate-gradientFlow',
    duration: '6.0s',
    timing: 'linear infinite',
    category: 'glow-reveal',
    cssCode: `.gradient {\n  animation: gradientFlow 6s linear infinite;\n}`,
    recommendedUse: 'Vichwa vya habari vya kisasa: "UNAKWENDA WAPI?" na "Earn TZS 1,000"',
  },
  {
    id: 'slideReveal',
    name: 'SlideReveal',
    className: 'animate-slideReveal',
    duration: '3.0s',
    timing: 'infinite ease-in-out',
    category: 'glow-reveal',
    cssCode: `.reveal span {\n  animation: slideReveal 3s infinite;\n}`,
    recommendedUse: 'Majina ya maeneo ya dharura na vivutio vya mji',
  },
  {
    id: 'neonPulse',
    name: 'NeonPulse',
    className: 'animate-neonPulse',
    duration: '2.0s',
    timing: 'infinite alternate',
    category: 'glow-reveal',
    cssCode: `.neon {\n  animation: neonPulse 2s infinite alternate;\n}`,
    recommendedUse: 'Mwonekano wa giza (Dark mode) wa beji za VIP na GPS Live Tracking',
  },
  {
    id: 'wave',
    name: 'Wave',
    className: 'animate-wave',
    duration: '1.2s',
    timing: 'infinite ease-in-out',
    category: 'glow-reveal',
    cssCode: `.wave span {\n  animation: wave 1.2s infinite;\n}`,
    recommendedUse: 'Vichwa vya habari vya salamu na vitufe vya mwaliko wa marafiki',
  },

  // Pulse & Attention
  {
    id: 'flip',
    name: 'Flip',
    className: 'animate-flip',
    duration: '1.8s',
    timing: 'infinite',
    category: 'pulse-attention',
    cssCode: `.text {\n  animation: flip 1.8s infinite;\n}`,
    recommendedUse: 'Badiliko la bei ya safari (Nauli ya PapoShare)',
  },
  {
    id: 'tada',
    name: 'Tada',
    className: 'animate-tada',
    duration: '1.6s',
    timing: 'infinite',
    category: 'pulse-attention',
    cssCode: `.text {\n  animation: tada 1.6s infinite;\n}`,
    recommendedUse: 'Beji ya 36% OFF na vocha zilizokombolewa',
  },
  {
    id: 'bounce',
    name: 'Bounce',
    className: 'animate-bounce-text',
    duration: '1.7s',
    timing: 'infinite',
    category: 'pulse-attention',
    cssCode: `.text {\n  animation: bounce 1.7s infinite;\n}`,
    recommendedUse: 'Viashiria vya GPS Pin na vitufe vya haraka vya kupigia dereva simu',
  },
  {
    id: 'headShake',
    name: 'HeadShake',
    className: 'animate-headShake',
    duration: '1.4s',
    timing: 'infinite ease-in-out',
    category: 'pulse-attention',
    cssCode: `.text {\n  animation: headShake 1.4s infinite;\n}`,
    recommendedUse: 'Vikumbusho vya kuvaa kofia ngumu (Helmeti) na mikanda',
  },
  {
    id: 'zoomIn',
    name: 'ZoomIn',
    className: 'animate-zoomIn',
    duration: '1.5s',
    timing: 'infinite ease-out',
    category: 'pulse-attention',
    cssCode: `.text {\n  animation: zoomIn 1.5s infinite;\n}`,
    recommendedUse: 'Alama ya kufika salama (Arrived at Destination)',
  },
  {
    id: 'heartBeat',
    name: 'HeartBeat',
    className: 'animate-heartBeat',
    duration: '1.3s',
    timing: 'infinite ease-in-out',
    category: 'pulse-attention',
    cssCode: `.text {\n  animation: heartBeat 1.3s infinite;\n}`,
    recommendedUse: 'Beji ya Zawadi 🎁, PataSOS ya dharura, na dereva anapofika',
  },
  {
    id: 'fadeIn',
    name: 'FadeIn',
    className: 'animate-fadeIn-text',
    duration: '1.4s',
    timing: 'infinite alternate ease-in',
    category: 'pulse-attention',
    cssCode: `.text {\n  animation: fadeIn 1.4s infinite;\n}`,
    recommendedUse: 'Maandishi ya msaada wa chini na nambari za huduma kwa wateja',
  },
];

interface TextAnimationShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TextAnimationShowcaseModal: React.FC<TextAnimationShowcaseModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customText, setCustomText] = useState<string>('Pata Usafiri Haraka');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredAnimations = ALL_TEXT_ANIMATIONS.filter((item) =>
    selectedCategory === 'all' ? true : item.category === selectedCategory
  );

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedId(id);
    toast.success(`CSS Code ya ${id} imenakiliwa! 📋`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`w-full max-w-4xl max-h-[90dvh] flex flex-col rounded-[28px] border shadow-2xl overflow-hidden ${
          theme === 'dark' ? 'bg-[#12121a] border-neutral-800 text-white' : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        {/* Top Header */}
        <div className="p-4 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  CSS Animated Text Suite (25 Animations)
                </h2>
                <span className="text-[10px] bg-emerald-500 text-white font-black px-2 py-0.5 rounded-full uppercase">
                  Live Preview
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium mt-0.5">
                Kila animation ya maandishi ikiwa na CSS code na maeneo yanayofaa kutumika
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-500 transition-all active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls & Live Text Input */}
        <div className="p-4 sm:px-6 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row gap-3 items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/30">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'Zote (25)' },
              { id: 'playful', label: 'Playful & Physics' },
              { id: 'entrance', label: 'Entrance' },
              { id: 'glow-reveal', label: 'Glow & Typing' },
              { id: 'pulse-attention', label: 'Pulse & Attention' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-72 flex items-center gap-2">
            <span className="text-[11px] font-bold text-neutral-400 shrink-0">Jaribu Neno:</span>
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Andika neno..."
              className={`w-full px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                theme === 'dark' ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'
              }`}
            />
          </div>
        </div>

        {/* Animated Cards Grid */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAnimations.map((anim) => (
            <div
              key={anim.id}
              className={`p-4 rounded-2xl border flex flex-col justify-between transition-all duration-300 hover:shadow-xl group relative overflow-hidden ${
                theme === 'dark' ? 'bg-[#171724] border-neutral-800 hover:border-indigo-500/50' : 'bg-neutral-50/80 border-neutral-200 hover:border-indigo-400'
              }`}
            >
              {/* Preview Stage Box */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <span className="text-xs font-black tracking-tight">{anim.name}</span>
                  </div>
                  <span className="text-[9.5px] font-mono font-bold bg-neutral-200/80 dark:bg-neutral-800 px-2 py-0.5 rounded-md text-neutral-500">
                    {anim.duration}
                  </span>
                </div>

                {/* Animated Text Box */}
                <div
                  className={`h-24 rounded-xl flex items-center justify-center p-3 text-center border shadow-inner ${
                    theme === 'dark' ? 'bg-neutral-900/90 border-neutral-800/80' : 'bg-white border-neutral-200/70'
                  }`}
                >
                  <span
                    className={`text-base sm:text-lg font-black tracking-wide ${anim.className} ${
                      anim.id === 'gradientFlow' ? '' : theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
                    }`}
                  >
                    {customText || anim.name}
                  </span>
                </div>

                {/* Recommended Use */}
                <div className="text-[10.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                  <strong className="text-neutral-700 dark:text-neutral-300 font-bold block mb-0.5">
                    Mahali Panapofaa:
                  </strong>
                  {anim.recommendedUse}
                </div>
              </div>

              {/* CSS Code Snippet & Copy Action */}
              <div className="mt-3 pt-3 border-t border-neutral-200/70 dark:border-neutral-800 flex items-center justify-between">
                <code className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 truncate max-w-[170px]">
                  .{anim.className}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopyCode(anim.id, anim.cssCode)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 text-neutral-700 dark:text-neutral-300"
                >
                  {copiedId === anim.id ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-500 font-bold">Imenakiliwa</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>CSS Code</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
