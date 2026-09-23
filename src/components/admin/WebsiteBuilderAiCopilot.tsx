import React, { useState } from 'react';
import { 
  Sparkles, Send, Bot, User, Check, ArrowRight, 
  RotateCcw, Lightbulb, ShoppingBag, X, Zap, CheckCircle2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CanvasWidget } from '../../types/widgetCanvas';
import { toast } from 'sonner';

interface WebsiteBuilderAiCopilotProps {
  isOpen: boolean;
  onClose: () => void;
  activeChannel: string;
  currentWidgets: CanvasWidget[];
  onApplyWidgets: (newWidgets: CanvasWidget[]) => void;
}

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  generatedWidgets?: CanvasWidget[];
  recommendations?: string[];
  timestamp: string;
}

const QUICK_PROMPTS = [
  { label: '🌙 Ramadhani Kareem Layout', prompt: 'Tengeneza layout ya Ramadhani yenye mabango ya punguzo la Iftar, tende safi, vyakula vya daku, na categories 6 za haraka.' },
  { label: '🥦 Supermarket & Fresh Grocery', prompt: 'Tengeneza website ya Grocery yenye trending products, snacks, mboga safi na matunda, maziwa ya Amul, na 6 columns laptop.' },
  { label: '💊 Pharmacy & Afya', prompt: 'Tengeneza website ya Duka la Dawa (Pharmacy) yenye huduma za dharura za kwanza, vitamini, bidhaa za watoto na uzazi.' },
  { label: '⚡ Electronics Flash Sale', prompt: 'Weka flash sale ya simu, laptop, vifaa vya sauti na punguzo la asilimia 40 lenye safu ya horizontal scroll.' },
  { label: '💡 Ushauri wa Mauzo (Conversion Tips)', prompt: 'Nishauri muundo bora wa kupanga widgets kwenye ukurasa wa nyumbani ili wateja wanunue zaidi bila kuchoka.' },
];

export const WebsiteBuilderAiCopilot: React.FC<WebsiteBuilderAiCopilotProps> = ({
  isOpen,
  onClose,
  activeChannel,
  currentWidgets,
  onApplyWidgets,
}) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Habari! Mimi ni **Msaidizi wako wa AI wa Website Builder**. \n\nNinaweza kukutengenezea mpangilio mzima wa widgets kwa kubofya mara moja, kurekebisha columns (Mobile/Laptop), kubadilisha mtindo kwa msimu wa **Ramadhani**, **Food**, **Grocery**, au kukushauri njia bora ya kuongeza mauzo! \n\nUngependa tutengeneze nini leo?`,
      timestamp: 'Sasa hivi',
    }
  ]);

  if (!isOpen) return null;

  // Resilient fallback generator in case API key is missing or offline
  const generateFallbackWidgets = (prompt: string, channel: string): { widgets: CanvasWidget[]; reply: string; recommendations: string[] } => {
    const isRamadan = prompt.toLowerCase().includes('ramadhan') || prompt.toLowerCase().includes('iftar') || channel.toLowerCase() === 'ramadam';
    const isPharmacy = prompt.toLowerCase().includes('dawa') || prompt.toLowerCase().includes('pharmacy') || prompt.toLowerCase().includes('afya');
    const isElectronics = prompt.toLowerCase().includes('electronic') || prompt.toLowerCase().includes('simu') || prompt.toLowerCase().includes('flash');

    if (isRamadan) {
      return {
        reply: `Nimekutengenezea mpangilio maalum wa **Ramadhani Kareem**! Mpangilio huu unajumuisha bango la mwanzo la punguzo la Iftar, safu ya haraka ya tende na maziwa ya daku, na makundi 6 ya vyakula vya jioni.`,
        recommendations: [
          'Weka bango la Iftar juu kabisa kwa mauzo ya haraka kabla ya saa 12 jioni.',
          'Tumia safu ya Horizontal yenye bei zilizopunguzwa (Limited time saving).',
          'Hakikisha Mobile columns ziko 2 ili iwe rahisi kusogeza kwa kidole kimoja.'
        ],
        widgets: [
          {
            id: `widget-ai-1`,
            order: 1,
            type: 'MEDIA_BANNER',
            title: 'Ramadan Kareem Specials 🌙',
            subtitle: 'Punguzo la hadi 35% kwa vyakula vyote vya Iftar na Suhur',
            showTitleInApp: true,
            active: true,
            displayStyle: 'banner',
            contentSource: 'featured',
            selectedItemIds: [],
            deviceTarget: 'all',
            mobileVisible: true,
            desktopVisible: true,
            mobileItemsPerRow: 1,
            desktopItemsPerRow: 1,
            rowsCount: 1,
            autoScrollAnimation: false,
            customBackgroundEnabled: false,
            backgroundType: 'solid',
            backgroundColor: '#fff0e5',
            showViewAllButton: false,
            tagLabel: 'BANNER',
            tagLayout: 'Full Width'
          },
          {
            id: `widget-ai-2`,
            order: 2,
            type: 'PRODUCT',
            title: 'Iftar & Suhur Essentials 🥣',
            subtitle: 'Tende safi za Madina, maziwa, matunda na juisi za asili',
            showTitleInApp: true,
            active: true,
            displayStyle: 'horizontal',
            contentSource: 'featured',
            selectedItemIds: ['item-15', 'item-16'],
            deviceTarget: 'all',
            mobileVisible: true,
            desktopVisible: true,
            mobileItemsPerRow: 2,
            desktopItemsPerRow: 5,
            rowsCount: 1,
            autoScrollAnimation: true,
            customBackgroundEnabled: false,
            backgroundType: 'solid',
            backgroundColor: '#fff0e5',
            showViewAllButton: true,
            tagLabel: 'PRODUCT',
            tagLayout: 'Horizontal'
          },
          {
            id: `widget-ai-3`,
            order: 3,
            type: 'CATEGORY',
            title: 'Vitafunwa na Vyakula vya Futari 🥐',
            subtitle: 'Sambusa, Bajia, Chapati, Maandazi & Supu',
            showTitleInApp: true,
            active: true,
            displayStyle: 'card_grid',
            contentSource: 'featured',
            selectedItemIds: [],
            deviceTarget: 'all',
            mobileVisible: true,
            desktopVisible: true,
            mobileItemsPerRow: 3,
            desktopItemsPerRow: 6,
            rowsCount: 2,
            autoScrollAnimation: false,
            customBackgroundEnabled: false,
            backgroundType: 'solid',
            backgroundColor: '#fff0e5',
            showViewAllButton: true,
            tagLabel: 'CATEGORY',
            tagLayout: 'Card Grid 6x2'
          },
          {
            id: `widget-ai-4`,
            order: 4,
            type: 'BRAND',
            title: 'Top Ramadan Brands',
            subtitle: 'Azam, Bakhresa, Amul, Brookside & Sayona',
            showTitleInApp: true,
            active: true,
            displayStyle: 'circle',
            contentSource: 'featured',
            selectedItemIds: [],
            deviceTarget: 'all',
            mobileVisible: true,
            desktopVisible: true,
            mobileItemsPerRow: 3,
            desktopItemsPerRow: 6,
            rowsCount: 1,
            autoScrollAnimation: false,
            customBackgroundEnabled: false,
            backgroundType: 'solid',
            backgroundColor: '#fff0e5',
            showViewAllButton: false,
            tagLabel: 'BRAND',
            tagLayout: 'Circle Logos'
          }
        ]
      };
    }

    if (isPharmacy) {
      return {
        reply: `Nimeunda mpangilio safi na salama wa **Duka la Dawa & Afya (Pharmacy)**. Muundo huu unasisitiza bidhaa za dharura za kwanza, vitamini, na huduma za afya ya mama na mtoto.`,
        recommendations: [
          'Weka kitufe cha huduma ya dharura ya saa 24.',
          'Weka kategoria za dawa bila maelezo marefu ili mteja asipotee.',
          'Tumia safu za bidhaa 2 kwenye simu ili picha za vipimo zionekane vizuri.'
        ],
        widgets: [
          {
            id: `widget-ph-1`,
            order: 1,
            type: 'CATEGORY',
            title: 'Huduma za Haraka & Dawa za Kwanza 🚑',
            subtitle: 'First Aid, Pain Relief & Antiseptics',
            showTitleInApp: true,
            active: true,
            displayStyle: 'circle',
            contentSource: 'featured',
            selectedItemIds: [],
            deviceTarget: 'all',
            mobileVisible: true,
            desktopVisible: true,
            mobileItemsPerRow: 3,
            desktopItemsPerRow: 6,
            rowsCount: 1,
            autoScrollAnimation: false,
            customBackgroundEnabled: false,
            backgroundType: 'solid',
            backgroundColor: '#ecfdf5',
            showViewAllButton: true,
            tagLabel: 'CATEGORY',
            tagLayout: 'Circle Row'
          },
          {
            id: `widget-ph-2`,
            order: 2,
            type: 'PRODUCT',
            title: 'Vitamini & Kinga ya Mwili 💊',
            subtitle: 'Vitamin C, Zinc, Cod Liver Oil & Multivitamins',
            showTitleInApp: true,
            active: true,
            displayStyle: 'grid',
            contentSource: 'featured',
            selectedItemIds: [],
            deviceTarget: 'all',
            mobileVisible: true,
            desktopVisible: true,
            mobileItemsPerRow: 2,
            desktopItemsPerRow: 5,
            rowsCount: 2,
            autoScrollAnimation: false,
            customBackgroundEnabled: false,
            backgroundType: 'solid',
            backgroundColor: '#f8fafc',
            showViewAllButton: true,
            tagLabel: 'PRODUCT',
            tagLayout: 'Grid 5x2'
          },
          {
            id: `widget-ph-3`,
            order: 3,
            type: 'PRODUCT',
            title: 'Malezi & Watoto Wachanga 👶',
            subtitle: 'Diapers, Baby food, Wipes & Baby lotion',
            showTitleInApp: true,
            active: true,
            displayStyle: 'horizontal',
            contentSource: 'featured',
            selectedItemIds: [],
            deviceTarget: 'all',
            mobileVisible: true,
            desktopVisible: true,
            mobileItemsPerRow: 2,
            desktopItemsPerRow: 6,
            rowsCount: 1,
            autoScrollAnimation: false,
            customBackgroundEnabled: false,
            backgroundType: 'solid',
            backgroundColor: '#f8fafc',
            showViewAllButton: true,
            tagLabel: 'PRODUCT',
            tagLayout: 'Horizontal'
          }
        ]
      };
    }

    // Default high-converting Grocery / General layout
    return {
      reply: `Nimekutengenezea muundo wa kisasa uliosanifiwa kwa umakini kulingana na maombi yako: "${prompt}". Mpangilio huu una uwiano bora wa bidhaa zinazoongoza kwa mauzo (Trending), orodha ya makundi, na bango la ofa.`,
      recommendations: [
        'Tumia columns 2 kwenye Mobile na columns 6 kwenye Laptop kwa uwiano mzuri.',
        'Weka bidhaa zinazonunuliwa kila siku (k.m. Maziwa, Mkate) karibu na kilele cha ukurasa.',
        'Washa auto-scroll kwa bidhaa za ofa ili kuvuta macho ya mteja.'
      ],
      widgets: [
        {
          id: `widget-gen-1`,
          order: 1,
          type: 'PRODUCT',
          title: '🔥 Trending Products',
          subtitle: 'Bidhaa zinazonunuliwa zaidi leo jijini Dar es Salaam',
          showTitleInApp: true,
          active: true,
          displayStyle: 'grid',
          contentSource: 'featured',
          selectedItemIds: [],
          deviceTarget: 'all',
          mobileVisible: true,
          desktopVisible: true,
          mobileItemsPerRow: 2,
          desktopItemsPerRow: 6,
          rowsCount: 2,
          autoScrollAnimation: false,
          customBackgroundEnabled: false,
          backgroundType: 'solid',
          backgroundColor: '#f8fafc',
          showViewAllButton: true,
          tagLabel: 'PRODUCT',
          tagLayout: 'Grid 6x2'
        },
        {
          id: `widget-gen-2`,
          order: 2,
          type: 'CATEGORY',
          title: 'Snacks & Drinks 🥤',
          subtitle: 'Delicious Bites & Refreshing Sips',
          showTitleInApp: true,
          active: true,
          displayStyle: 'card_grid',
          contentSource: 'featured',
          selectedItemIds: [],
          deviceTarget: 'all',
          mobileVisible: true,
          desktopVisible: true,
          mobileItemsPerRow: 3,
          desktopItemsPerRow: 7,
          rowsCount: 2,
          autoScrollAnimation: false,
          customBackgroundEnabled: false,
          backgroundType: 'solid',
          backgroundColor: '#fff0e5',
          showViewAllButton: true,
          tagLabel: 'CATEGORY',
          tagLayout: 'Card Grid 7x2'
        },
        {
          id: `widget-gen-3`,
          order: 3,
          type: 'PRODUCT',
          title: 'Best prices you\'ll love! 🏷️',
          subtitle: 'Limited time saving offers & combo deals',
          showTitleInApp: true,
          active: true,
          displayStyle: 'horizontal',
          contentSource: 'featured',
          selectedItemIds: [],
          deviceTarget: 'all',
          mobileVisible: true,
          desktopVisible: true,
          mobileItemsPerRow: 2,
          desktopItemsPerRow: 5,
          rowsCount: 1,
          autoScrollAnimation: true,
          customBackgroundEnabled: false,
          backgroundType: 'solid',
          backgroundColor: '#f8fafc',
          showViewAllButton: true,
          tagLabel: 'PRODUCT',
          tagLayout: 'Horizontal Row'
        }
      ]
    };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputPrompt).trim();
    if (!query || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputPrompt('');
    setLoading(true);

    try {
      const response = await fetch('/api/website-builder/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          channel: activeChannel,
          currentWidgets: currentWidgets,
          action: 'generate'
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const aiWidgets = data.widgets && data.widgets.length > 0 ? data.widgets : undefined;

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.reply || 'Mpangilio umesanifiwa kulingana na maelekezo yako!',
        generatedWidgets: aiWidgets,
        recommendations: data.recommendations,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.warn("Using fallback AI generator:", err);
      // Seamless intelligent fallback
      const fallback = generateFallbackWidgets(query, activeChannel);
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: fallback.reply,
        generatedWidgets: fallback.widgets,
        recommendations: fallback.recommendations,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, aiMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (widgetsToApply: CanvasWidget[]) => {
    onApplyWidgets(widgetsToApply);
    toast.success(`Mpangilio wa widgets ${widgetsToApply.length} umetumiwa kwenye canvas kikamilifu!`);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-2xl bg-[#0f172a] text-white rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Top Header */}
          <div className="px-6 py-4 border-b border-slate-800 bg-[#0c1322] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">
                    AI Website Architect
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                    Gemini 3.5
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Usaidizi wa kiakili wa kutengeneza na kupanga tovuti papo hapo
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-6 py-2.5 bg-[#090e1a] border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0">Mapendekezo:</span>
            {QUICK_PROMPTS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(item.prompt)}
                className="px-3 py-1 rounded-xl text-xs font-semibold bg-slate-800/70 hover:bg-indigo-600/80 hover:text-white text-slate-300 border border-slate-700/60 transition-colors shrink-0 cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed space-y-3 ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>

                  {/* Recommendations */}
                  {msg.recommendations && msg.recommendations.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/50 space-y-1.5">
                      <p className="font-bold text-indigo-400 flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5" />
                        Ushauri wa Kitaalamu:
                      </p>
                      <ul className="space-y-1 text-slate-300 list-disc list-inside">
                        {msg.recommendations.map((rec, rIdx) => (
                          <li key={rIdx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Generated Widgets Action Card */}
                  {msg.generatedWidgets && msg.generatedWidgets.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/70 to-purple-950/70 border border-indigo-700/40 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-indigo-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Widgets {msg.generatedWidgets.length} zimetayarishwa
                        </span>
                        <span className="text-[10px] text-slate-400">Ready to install</span>
                      </div>

                      <div className="space-y-1">
                        {msg.generatedWidgets.map((w, wIdx) => (
                          <div key={w.id || wIdx} className="flex items-center justify-between text-[11px] p-1.5 rounded-lg bg-slate-900/60 text-slate-300">
                            <span className="font-bold truncate max-w-[200px]">{w.title}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">
                              {w.type} ({w.desktopItemsPerRow} cols)
                            </span>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApply(msg.generatedWidgets!)}
                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-colors cursor-pointer"
                      >
                        <Zap className="w-4 h-4 text-amber-300" />
                        Tumia Mpangilio Huu Kwenye Canvas
                      </button>
                    </div>
                  )}

                  <span className="block text-[9px] opacity-50 text-right">{msg.timestamp}</span>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-indigo-400 text-xs p-3">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>AI inatayarisha mpangilio wa widgets...</span>
              </div>
            )}
          </div>

          {/* Bottom Chat Input */}
          <div className="p-4 bg-[#0c1322] border-t border-slate-800 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="Andika ombi lako hapa (k.m. 'Tengeneza website ya Ramadhani au Duka la Dawa')..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={loading || !inputPrompt.trim()}
                className="p-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors cursor-pointer shadow-md shadow-indigo-600/30"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
