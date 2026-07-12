import React, { useState, useEffect } from 'react';
import { 
  Compass, MapPin, Plus, Trash2, QrCode, ShoppingBag, 
  Sparkles, Award, Gift, Search, Info, Check, Printer, Tag 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NavigationNode {
  id: string;
  name: string;
  sectionCode: string; // e.g. "SEC-01", "SEHEMU-2"
  itemCategory: string; // e.g. "Bakery", "Beverages"
  emoji: string;
  directionsHint: string; // Camera directions: e.g. "Hatua 5 mbele, geuka kushoto"
  rewardCoins: number; // Coins earned for finding this spot
  discountPercentage: number; // Discount unlocked
  discountTarget: 'specific' | 'all'; // Specific item or storewide
  targetProductName?: string; // Product name if specific
}

const PRESET_CATEGORIES = [
  { id: 'bakery', name: 'Mikate & Keki 🍞', emoji: '🍞', defaultItems: 'Mkate, Keki, Buns' },
  { id: 'beverages', name: 'Vinywaji & Soda 🥤', emoji: '🥤', defaultItems: 'Soda, Maji, Juisi' },
  { id: 'grocery', name: 'Matunda & Mboga 🍎', emoji: '🍎', defaultItems: 'Matunda, Mboga za Majani' },
  { id: 'snacks', name: 'Snacks & Biskuti 🍿', emoji: '🍿', defaultItems: 'Biskuti, Chips, Karanga' },
  { id: 'hygiene', name: 'Sabuni & Vipodozi 🧼', emoji: '🧼', defaultItems: 'Sabuni, Shampoo, Dawa ya meno' },
  { id: 'cereals', name: 'Nafaka & Mchele 🌾', emoji: '🌾', defaultItems: 'Mchele, Unga wa Sembe, Sukari' }
];

interface ARIndoorNavigationCreatorProps {
  vendorProfile?: any;
}

export default function ARIndoorNavigationCreator({ vendorProfile }: ARIndoorNavigationCreatorProps) {
  const [nodes, setNodes] = useState<NavigationNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<NavigationNode | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [printNode, setPrintNode] = useState<NavigationNode | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [sectionCode, setSectionCode] = useState('');
  const [itemCategory, setItemCategory] = useState('bakery');
  const [directionsHint, setDirectionsHint] = useState('');
  const [rewardCoins, setRewardCoins] = useState(50);
  const [discountPercentage, setDiscountPercentage] = useState(10);
  const [discountTarget, setDiscountTarget] = useState<'specific' | 'all'>('specific');
  const [targetProductName, setTargetProductName] = useState('');

  // Simulation state for Shopper View
  const [activeSimNode, setActiveSimNode] = useState<NavigationNode | null>(null);
  const [simStep, setSimStep] = useState<'scan' | 'guidance' | 'reached'>('scan');
  const [cameraStreamActive, setCameraStreamActive] = useState(false);
  const [simCoins, setSimCoins] = useState(0);
  const [unlockedDiscounts, setUnlockedDiscounts] = useState<string[]>([]);

  // Load initial demo nodes for interactive richness
  useEffect(() => {
    const saved = localStorage.getItem(`ar_indoor_nodes_${vendorProfile?.id || 'demo'}`);
    if (saved) {
      setNodes(JSON.parse(saved));
    } else {
      const demoNodes: NavigationNode[] = [
        {
          id: 'node-1',
          name: 'Eneo la Mikate na Keki',
          sectionCode: 'M-1',
          itemCategory: 'bakery',
          emoji: '🍞',
          directionsHint: 'Tembea mbele hatua 10 kutoka mlangoni, kisha angalia upande wa kulia kwenye rafu ya juu.',
          rewardCoins: 50,
          discountPercentage: 10,
          discountTarget: 'specific',
          targetProductName: 'Mkate wa Ngano (Chapa Bora)'
        },
        {
          id: 'node-2',
          name: 'Eneo la Soda na Baridi',
          sectionCode: 'S-2',
          itemCategory: 'beverages',
          emoji: '🥤',
          directionsHint: 'Fuata mstari wa kijani uliopo sakafuni kuelekea nyuma kabisa ya duka, friji lipo upande wa kushoto.',
          rewardCoins: 60,
          discountPercentage: 15,
          discountTarget: 'specific',
          targetProductName: 'Soda Baridi ya Kopo'
        },
        {
          id: 'node-3',
          name: 'Nafaka na Bidhaa za Kupikia',
          sectionCode: 'N-3',
          itemCategory: 'cereals',
          emoji: '🌾',
          directionsHint: 'Kutoka mlangoni ingia korido ya tatu (Row 3), nenda katikati ya korido hiyo.',
          rewardCoins: 100,
          discountPercentage: 5,
          discountTarget: 'all',
          targetProductName: ''
        }
      ];
      setNodes(demoNodes);
      localStorage.setItem(`ar_indoor_nodes_${vendorProfile?.id || 'demo'}`, JSON.stringify(demoNodes));
    }
  }, [vendorProfile]);

  const saveNodes = (updated: NavigationNode[]) => {
    setNodes(updated);
    localStorage.setItem(`ar_indoor_nodes_${vendorProfile?.id || 'demo'}`, JSON.stringify(updated));
  };

  const handleAddNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !sectionCode) return;

    const categoryObj = PRESET_CATEGORIES.find(c => c.id === itemCategory);

    const newNode: NavigationNode = {
      id: `node-${Date.now()}`,
      name,
      sectionCode,
      itemCategory,
      emoji: categoryObj?.emoji || '📍',
      directionsHint: directionsHint || 'Fuata mshale wa AR kwenye skrini.',
      rewardCoins: Number(rewardCoins) || 0,
      discountPercentage: Number(discountPercentage) || 0,
      discountTarget,
      targetProductName: discountTarget === 'specific' ? targetProductName : ''
    };

    const updated = [...nodes, newNode];
    saveNodes(updated);
    
    // Reset Form
    setName('');
    setSectionCode('');
    setDirectionsHint('');
    setRewardCoins(50);
    setDiscountPercentage(10);
    setDiscountTarget('specific');
    setTargetProductName('');
    setIsAdding(false);
  };

  const handleDeleteNode = (id: string) => {
    const updated = nodes.filter(n => n.id !== id);
    saveNodes(updated);
    if (selectedNode?.id === id) setSelectedNode(null);
  };

  const startSimulation = (node: NavigationNode) => {
    setActiveSimNode(node);
    setSimStep('scan');
    setCameraStreamActive(false);
  };

  return (
    <div className="bg-neutral-50 dark:bg-neutral-900/40 rounded-3xl p-6 border border-neutral-200/60 dark:border-neutral-800 text-left font-sans shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-black tracking-widest px-2.5 py-1 rounded-full uppercase">
            AR Indoor Wayfinding & Rewards
          </span>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight mt-1 text-neutral-900 dark:text-white">
            AR Indoor Navigation Creator 🧭
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Unda maeneo ya duka lako (Section 1, 2, n.k.) ili kumwelekeza mteja kupata bidhaa (Mkate, Soda, n.k.). Wateja watapata sarafu (Coins) na Punguzo la bei wakifika eneo husika!
          </p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-xs px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
        >
          {isAdding ? 'Funga Fomu' : 'Unda Eneo Jipya la AR'}
          <Plus className={`w-4 h-4 transition-transform ${isAdding ? 'rotate-45' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT / CENTER: Creator list or form */}
        <div className="lg:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            {isAdding && (
              <motion.form
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleAddNode}
                className="bg-white dark:bg-[#111118]/80 border border-neutral-200/70 dark:border-[#1e1e2e] p-6 rounded-2xl shadow-md space-y-4"
              >
                <h3 className="text-sm font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Sanidi Eneo la Maelekezo (AR Navigation Node)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-1">
                      Jina la Eneo / Rafu *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Mfan: Eneo la Mikate ya Ngano 🍞"
                      className="w-full h-10 px-3 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-purple-500 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-1">
                      Namba ya Sehemu / Section Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={sectionCode}
                      onChange={(e) => setSectionCode(e.target.value)}
                      placeholder="Mfan: SEHEMU-1 au R-1"
                      className="w-full h-10 px-3 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-purple-500 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-1">
                      Kundi la Bidhaa / Category
                    </label>
                    <select
                      value={itemCategory}
                      onChange={(e) => setItemCategory(e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-purple-500 dark:text-white cursor-pointer"
                    >
                      {PRESET_CATEGORIES.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-1">
                      Pesa za Zawadi (Coins) wakifika hapa
                    </label>
                    <input
                      type="number"
                      value={rewardCoins}
                      onChange={(e) => setRewardCoins(Number(e.target.value))}
                      placeholder="Mfan: 50"
                      className="w-full h-10 px-3 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-purple-500 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-1">
                    Maelekezo ya Kamera / AR Directions (Hatua, zamu n.k.)
                  </label>
                  <textarea
                    value={directionsHint}
                    onChange={(e) => setDirectionsHint(e.target.value)}
                    placeholder="Mfan: Tembea mbele hatua 5 kisha angalia upande wa kushoto kwenye rafu ya katikati..."
                    rows={2}
                    className="w-full p-3 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-purple-500 dark:text-white"
                  />
                </div>

                <div className="bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-purple-500" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">
                      Gamification: Tuzo ya Punguzo la Bei (Discount Reward)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-1">
                        Punguzo la Bei (%)
                      </label>
                      <input
                        type="number"
                        value={discountPercentage}
                        onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                        className="w-full h-10 px-3 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-purple-500 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-1">
                        Linalolengwa (Scope)
                      </label>
                      <select
                        value={discountTarget}
                        onChange={(e) => setDiscountTarget(e.target.value as any)}
                        className="w-full h-10 px-3 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-purple-500 dark:text-white cursor-pointer"
                      >
                        <option value="specific">Bidhaa Maalum Pekee</option>
                        <option value="all">Bidhaa Zote Dukani</option>
                      </select>
                    </div>

                    {discountTarget === 'specific' && (
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-1">
                          Jina la Bidhaa Maalum *
                        </label>
                        <input
                          type="text"
                          required
                          value={targetProductName}
                          onChange={(e) => setTargetProductName(e.target.value)}
                          placeholder="Mfan: Mkate chapa Azam"
                          className="w-full h-10 px-3 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-purple-500 dark:text-white"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  >
                    Ghairi
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-xs rounded-xl shadow-md cursor-pointer"
                  >
                    Hifadhi Eneo Jipya
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* List of current nodes */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400">
              Maeneo ya AR yaliyopo sasa ({nodes.length})
            </h3>

            {nodes.length === 0 ? (
              <div className="bg-white dark:bg-[#111118]/80 border border-neutral-200/50 dark:border-[#1e1e2e] p-8 rounded-2xl text-center space-y-3">
                <Compass className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto animate-spin-slow" />
                <p className="text-sm font-bold text-neutral-600 dark:text-neutral-400">
                  Hujatengeneza eneo lolote la maelekezo ya ndani ya duka bado.
                </p>
                <p className="text-xs text-neutral-400">
                  Bofya "Unda Eneo Jipya la AR" hapo juu kuunda bidhaa za kwanza kama Mkate au Soda.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {nodes.map((node) => (
                  <motion.div
                    key={node.id}
                    layoutId={node.id}
                    className="bg-white dark:bg-[#111118]/80 border border-neutral-200/60 dark:border-[#1e1e2e] p-5 rounded-2xl hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{node.emoji}</span>
                          <div>
                            <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded uppercase">
                              {node.sectionCode}
                            </span>
                            <h4 className="font-extrabold text-neutral-800 dark:text-neutral-100 text-sm mt-0.5 leading-tight">
                              {node.name}
                            </h4>
                          </div>
                        </div>

                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setPrintNode(node)}
                            className="w-7 h-7 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-purple-500 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                            title="Print QR Code / Standee"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteNode(node.id)}
                            className="w-7 h-7 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                            title="Futa Eneo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 bg-neutral-50 dark:bg-neutral-900/50 p-2.5 rounded-xl text-xs text-neutral-600 dark:text-neutral-300">
                        <p className="font-semibold leading-relaxed">
                          <strong>Mwelekeo wa Kamera:</strong> {node.directionsHint}
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-600 dark:text-[#FFD700] text-[9px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1">
                          🪙 +{node.rewardCoins} Coins
                        </span>
                        <span className="bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-[#00FF88] text-[9px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1">
                          🏷️ {node.discountPercentage}% Punguzo {node.discountTarget === 'specific' ? `(${node.targetProductName})` : '(Duka zima!)'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex justify-between items-center">
                      <span className="text-[10px] text-neutral-400">
                        Sanidi na ubandike duka hapa
                      </span>
                      <button
                        onClick={() => startSimulation(node)}
                        className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg cursor-pointer"
                      >
                        Jaribu AR Guide (Simulate)
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Demo / Stand Print Out */}
        <div className="lg:col-span-4 space-y-6">
          {/* Printable QR Code Card */}
          <div className="bg-white dark:bg-[#111118]/80 border border-neutral-200/70 dark:border-[#1e1e2e] p-6 rounded-2xl shadow-sm text-center">
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-4">
              Kadi ya Stand ya AR (Print out)
            </h3>

            {printNode ? (
              <div className="space-y-4">
                <div className="border-4 border-dashed border-purple-500/30 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/40 relative">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase">
                    SEHEMU YA {printNode.sectionCode}
                  </span>

                  <div className="w-36 h-36 mx-auto bg-white p-3 rounded-xl shadow-inner flex flex-col items-center justify-center border border-neutral-100">
                    {/* Simulated elegant vector-based QR Code */}
                    <div className="grid grid-cols-5 gap-1.5 w-full h-full relative p-1">
                      <div className="border-[3px] border-neutral-900 w-6 h-6 rounded" />
                      <div className="col-span-3" />
                      <div className="border-[3px] border-neutral-900 w-6 h-6 rounded absolute top-1 right-1" />
                      
                      <div className="col-span-5 flex items-center justify-center">
                        <span className="text-2xl animate-bounce">{printNode.emoji}</span>
                      </div>
                      
                      <div className="border-[3px] border-neutral-900 w-6 h-6 rounded absolute bottom-1 left-1" />
                      <div className="col-span-4" />
                    </div>
                  </div>

                  <p className="text-xs font-black text-neutral-800 dark:text-neutral-200 mt-3 leading-tight uppercase">
                    SCAN ILI UKAELEKEZWA MAHALI {printNode.emoji}
                  </p>
                  <p className="text-[10px] text-neutral-500 mt-1">
                    {printNode.name}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-neutral-200 dark:border-neutral-800 flex justify-center gap-3 text-[10px] font-extrabold text-neutral-700 dark:text-neutral-300">
                    <span className="flex items-center gap-0.5 text-yellow-600">🪙 {printNode.rewardCoins}</span>
                    <span className="flex items-center gap-0.5 text-emerald-600">🏷️ -{printNode.discountPercentage}%</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-white font-extrabold uppercase text-[10px] rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print / Pakua
                  </button>
                  <button
                    onClick={() => setPrintNode(null)}
                    className="py-2 px-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 text-[10px] font-bold rounded-lg cursor-pointer"
                  >
                    Funga
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 space-y-2">
                <QrCode className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto" />
                <p className="text-xs font-bold text-neutral-500">
                  Bonyeza icon ya QR kwenye eneo lolote kushoto ili kuzalisha Standee na QR ya kubandika ukutani/rafuni.
                </p>
              </div>
            )}
          </div>

          {/* Simulated Shopper Scan AR View */}
          <div className="bg-[#111118] text-white p-5 rounded-3xl relative overflow-hidden h-96 shadow-lg border border-[#1e1e2e] flex flex-col justify-between">
            {/* Header HUD */}
            <div className="flex justify-between items-center z-10">
              <div className="flex items-center gap-1 bg-black/60 px-2 py-1 rounded-full backdrop-blur-md">
                <Sparkles className="w-3 h-3 text-yellow-400 animate-pulse" />
                <span className="text-[8px] font-black tracking-wider uppercase">AR Shopper View</span>
              </div>

              <div className="bg-yellow-500/20 text-[#FFD700] px-2 py-1 rounded-full text-[9px] font-black flex items-center gap-1 backdrop-blur-md">
                🪙 {simCoins} Coins
              </div>
            </div>

            {activeSimNode ? (
              <div className="absolute inset-0 z-0 flex flex-col justify-between p-5 pt-14">
                {/* Background Simulation Camera stream representation */}
                <div className="absolute inset-0 bg-neutral-900 opacity-60 z-[-1]" />
                
                {simStep === 'scan' && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-24 h-24 border-2 border-purple-500/80 rounded-2xl relative animate-pulse flex items-center justify-center bg-purple-500/10">
                      <QrCode className="w-12 h-12 text-purple-400" />
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-purple-400 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-purple-400 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-purple-400 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-purple-400 rounded-br-lg" />
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-purple-400">
                        Scan QR Code ya AR
                      </p>
                      <p className="text-[10px] text-neutral-300 mt-1 max-w-xs">
                        Shopper akifika dukani anascan stika ya <strong>{activeSimNode.sectionCode}</strong> ili kamera ianze kumuelekeza.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setSimStep('guidance');
                        setCameraStreamActive(true);
                      }}
                      className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl active:scale-95 transition-all cursor-pointer"
                    >
                      Scan Sasa (Simulate Scan)
                    </button>
                  </div>
                )}

                {simStep === 'guidance' && (
                  <div className="flex-1 flex flex-col justify-between py-2">
                    {/* Simulated Camera Feed containing arrows */}
                    <div className="flex-1 flex flex-col items-center justify-center relative">
                      {/* Virtual Camera visual aids */}
                      <div className="text-center space-y-1 bg-black/60 p-3 rounded-2xl border border-neutral-800/80 backdrop-blur-sm max-w-[200px]">
                        <Compass className="w-6 h-6 text-purple-500 mx-auto animate-spin-slow" />
                        <p className="text-[10px] font-extrabold uppercase text-purple-400">Mshale wa AR</p>
                        <p className="text-[9px] text-neutral-300 leading-snug">
                          {activeSimNode.directionsHint}
                        </p>
                      </div>

                      {/* Giant AR overlay arrow */}
                      <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="mt-6 flex flex-col items-center"
                      >
                        <div className="w-12 h-12 bg-purple-500 border-2 border-purple-400 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50">
                          <Compass className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-[9px] font-black tracking-widest text-purple-400 mt-1 uppercase">
                          Mita 4 zilizobaki
                        </span>
                      </motion.div>
                    </div>

                    <button
                      onClick={() => {
                        setSimStep('reached');
                        setSimCoins(prev => prev + activeSimNode.rewardCoins);
                        setUnlockedDiscounts(prev => [...prev, activeSimNode.id]);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider py-2 rounded-xl text-center active:scale-95 transition-all cursor-pointer"
                    >
                      Nimefika Eneo (Arrive!)
                    </button>
                  </div>
                )}

                {simStep === 'reached' && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-500/20 border-2 border-emerald-500 rounded-full flex items-center justify-center animate-bounce">
                      <Award className="w-8 h-8 text-emerald-400" />
                    </div>

                    <div>
                      <h4 className="text-sm font-black text-emerald-400 uppercase tracking-tight">
                        Hongera! Umefika {activeSimNode.emoji}
                      </h4>
                      <p className="text-[10px] text-neutral-300 mt-1 max-w-xs leading-relaxed">
                        Umeshinda <strong>+{activeSimNode.rewardCoins} Coins</strong> na ufunguo wa punguzo la bei!
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 p-3 rounded-xl w-full text-left">
                      <p className="text-[9px] font-bold text-neutral-400 uppercase">Punguzo Lililofunguliwa:</p>
                      <p className="text-xs font-black text-yellow-400 mt-1 flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5" />
                        {activeSimNode.discountPercentage}% Punguzo kwenye {activeSimNode.discountTarget === 'specific' ? activeSimNode.targetProductName : 'kila bidhaa!'}
                      </p>
                    </div>

                    <button
                      onClick={() => setActiveSimNode(null)}
                      className="bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-bold py-2 px-4 rounded-xl cursor-pointer"
                    >
                      Tafuta Eneo Lingine
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <Compass className="w-12 h-12 text-neutral-600 mb-3 animate-pulse" />
                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400">
                  Hakuna Eneo la Demo Lililochaguliwa
                </h4>
                <p className="text-[10px] text-neutral-500 mt-1 max-w-[200px]">
                  Bofya kitufe cha <strong>"Jaribu AR Guide"</strong> kwenye eneo lolote kushoto ili kujaribu uzoefu wa mteja katika duka lako!
                </p>
              </div>
            )}

            {/* Bottom Screen Bar */}
            <div className="h-0.5 bg-neutral-800 w-1/3 mx-auto rounded-full mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
}
