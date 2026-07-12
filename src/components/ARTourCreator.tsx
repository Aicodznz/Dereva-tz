import React, { useState, useEffect, useRef } from 'react';
import { 
  Compass, MapPin, Plus, Trash2, QrCode, ShoppingBag, 
  Sparkles, Award, Gift, Search, Info, Check, Printer, Tag, 
  Layers, Map as MapIcon, ArrowRight, Star, AlertCircle, ShoppingCart, 
  Coins, Navigation, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface ARNode {
  id: string;
  name: string; // e.g., "Rafu ya Mikate 🍞"
  sectionCode: string; // e.g., "SEC-01", "RAFU-3"
  category: string; // e.g., "bakery", "beverages", etc.
  emoji: string;
  directionsHint: string; // Camera overlay directions: e.g. "Tembea mbele hatua 10, angalia upande wa kushoto"
  rewardCoins: number; // Coins earned for finding this spot
  discountPercentage: number; // Discount percentage unlocked
  discountTarget: 'specific' | 'all'; // Specific item or storewide
  targetProductName?: string; // Product name if specific
  floorIndex: number; // 1st floor, 2nd floor, Ground floor, etc.
  posX: number; // X coordinate on the store layout (0-100%)
  posY: number; // Y coordinate on the store layout (0-100%)
}

const PRESET_CATEGORIES = [
  { id: 'bakery', name: 'Mikate & Keki 🍞', emoji: '🍞', desc: 'Mikate, keki, biskuti na bidhaa za kuoka' },
  { id: 'beverages', name: 'Vinywaji & Soda 🥤', emoji: '🥤', desc: 'Soda, maji baridi, juisi na vinywaji vya nishati' },
  { id: 'grocery', name: 'Matunda & Mboga 🍎', emoji: '🍎', desc: 'Matunda fresh, mboga za majani na viungo' },
  { id: 'snacks', name: 'Snacks & Biskuti 🍿', emoji: '🍿', desc: 'Popcorn, biskuti, crisps na karanga' },
  { id: 'hygiene', name: 'Sabuni & Vipodozi 🧼', emoji: '🧼', desc: 'Sabuni za kuogea, dawa ya meno na vipodozi' },
  { id: 'cereals', name: 'Nafaka & Sukari 🌾', emoji: '🌾', desc: 'Mchele, unga, maharage, sukari na chumvi' }
];

interface ARTourCreatorProps {
  vendorProfile?: any;
}

export default function ARTourCreator({ vendorProfile }: ARTourCreatorProps) {
  const [nodes, setNodes] = useState<ARNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<ARNode | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [printNode, setPrintNode] = useState<ARNode | null>(null);
  const [activeFloor, setActiveFloor] = useState<number>(1);

  // Form states for creating a new AR Navigation Node
  const [name, setName] = useState('');
  const [sectionCode, setSectionCode] = useState('');
  const [category, setCategory] = useState('bakery');
  const [directionsHint, setDirectionsHint] = useState('');
  const [rewardCoins, setRewardCoins] = useState(50);
  const [discountPercentage, setDiscountPercentage] = useState(10);
  const [discountTarget, setDiscountTarget] = useState<'specific' | 'all'>('specific');
  const [targetProductName, setTargetProductName] = useState('');
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(50);

  // Simulation states (AR Shopper Experience)
  const [simNode, setSimNode] = useState<ARNode | null>(null);
  const [simStep, setSimStep] = useState<'scan' | 'guidance' | 'reached'>('scan');
  const [simCoins, setSimCoins] = useState(0);
  const [simCameraActive, setSimCameraActive] = useState(false);
  const [unlockedDiscounts, setUnlockedDiscounts] = useState<string[]>([]);
  const [simDirectionsIndex, setSimDirectionsIndex] = useState(0);

  // Load saved nodes from local storage or initialize with realistic defaults
  useEffect(() => {
    const key = `ar_indoor_nodes_${vendorProfile?.id || 'default'}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      setNodes(JSON.parse(saved));
    } else {
      const defaultNodes: ARNode[] = [
        {
          id: 'node-1',
          name: 'Eneo la Mikate na Keki',
          sectionCode: 'RAFU-1',
          category: 'bakery',
          emoji: '🍞',
          directionsHint: 'Kutoka mlangoni, nenda moja kwa moja hatua 8, geuka kulia kwenye rafu ya kwanza ya mbao.',
          rewardCoins: 50,
          discountPercentage: 15,
          discountTarget: 'specific',
          targetProductName: 'Mkate mtamu wa Ngano',
          floorIndex: 1,
          posX: 35,
          posY: 40
        },
        {
          id: 'node-2',
          name: 'Soda na Vinywaji Baridi',
          sectionCode: 'FRIJI-3',
          category: 'beverages',
          emoji: '🥤',
          directionsHint: 'Fuata njia ya katikati kuelekea mwisho kabisa wa duka, friji za kioo zipo upande wako wa kushoto.',
          rewardCoins: 75,
          discountPercentage: 10,
          discountTarget: 'all',
          floorIndex: 1,
          posX: 75,
          posY: 80
        },
        {
          id: 'node-3',
          name: 'Nafaka na Unga wa Sembe',
          sectionCode: 'ROW-4',
          category: 'cereals',
          emoji: '🌾',
          directionsHint: 'Ingia korido ya nne upande wa kulia, pita katikati ya rafu kupata mchele na unga.',
          rewardCoins: 100,
          discountPercentage: 5,
          discountTarget: 'specific',
          targetProductName: 'Unga wa Sembe chapa Kwanza',
          floorIndex: 1,
          posX: 20,
          posY: 70
        }
      ];
      setNodes(defaultNodes);
      localStorage.setItem(key, JSON.stringify(defaultNodes));
    }
  }, [vendorProfile]);

  const saveToStorage = (updatedList: ARNode[]) => {
    setNodes(updatedList);
    localStorage.setItem(`ar_indoor_nodes_${vendorProfile?.id || 'default'}`, JSON.stringify(updatedList));
  };

  const handleAddNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !sectionCode) {
      toast.error('Tafadhali jaza Jina na Namba ya Sehemu!');
      return;
    }

    const categoryObj = PRESET_CATEGORIES.find(c => c.id === category);

    const newNode: ARNode = {
      id: `node-${Date.now()}`,
      name,
      sectionCode: sectionCode.toUpperCase(),
      category,
      emoji: categoryObj?.emoji || '📍',
      directionsHint: directionsHint || 'Fuata mshale wa AR kuelekea eneo la alama hii.',
      rewardCoins: Number(rewardCoins) || 0,
      discountPercentage: Number(discountPercentage) || 0,
      discountTarget,
      targetProductName: discountTarget === 'specific' ? targetProductName : '',
      floorIndex: activeFloor,
      posX,
      posY
    };

    const updated = [...nodes, newNode];
    saveToStorage(updated);
    toast.success('Eneo jipya la AR limefanikiwa kuhifadhiwa!');

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
    saveToStorage(updated);
    toast.info('Eneo limefutwa kwenye mfumo.');
    if (selectedNode?.id === id) setSelectedNode(null);
  };

  const handleStoreMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setPosX(x);
    setPosY(y);
    toast.info(`Nafasi ya AR imewekwa: X: ${x}%, Y: ${y}%`);
  };

  const triggerSimulation = (node: ARNode) => {
    setSimNode(node);
    setSimStep('scan');
    setSimCameraActive(false);
    setSimDirectionsIndex(0);
  };

  return (
    <div className="bg-neutral-50 dark:bg-[#0b0b0f] rounded-3xl p-6 border border-neutral-200/60 dark:border-[#1e1e2d] text-left font-sans shadow-sm">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-black tracking-widest px-2.5 py-1 rounded-full uppercase">
            AR Indoor Wayfinding & Rewards
          </span>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight mt-2 text-neutral-900 dark:text-white flex items-center gap-2">
            AR Indoor Navigation Creator <Compass className="w-6 h-6 text-purple-500 animate-spin-slow" />
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-3xl">
            Sasa unaweza kuelekeza wateja wanapoingia dukani au sokoni kwako kupata bidhaa husika (kama Mkate 🍞, Soda 🥤, Row 1, Row 2). Pia, unaweza kutoa zawadi ya Coin na Punguzo la Bei (Discount) pindi wakiscan na kufika eneo husika!
          </p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-xs px-4 py-3 rounded-xl shadow-lg transition-all cursor-pointer active:scale-95"
        >
          {isAdding ? 'Funga Fomu' : 'Unda Eneo / Bidhaa ya AR'}
          <Plus className={`w-4 h-4 transition-transform ${isAdding ? 'rotate-45' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Setup List & Mapping */}
        <div className="lg:col-span-8 space-y-6">
          
          <AnimatePresence mode="wait">
            {isAdding && (
              <motion.form
                initial={{ opacity: 0, y: -15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                onSubmit={handleAddNode}
                className="bg-white dark:bg-[#111118]/80 border border-neutral-200/70 dark:border-[#1e1e2e] p-6 rounded-2xl shadow-md space-y-5"
              >
                <div className="flex justify-between items-center pb-2 border-b border-neutral-100 dark:border-neutral-800">
                  <h3 className="text-sm font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-purple-500" />
                    Unda Kigingi Kipya cha AR (Indoor Node)
                  </h3>
                  <span className="text-xs font-bold text-neutral-400">Sakafu ya {activeFloor}</span>
                </div>

                {/* 2D Interactive Floor Layout Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">
                    Bofya Kwenye Ramani ya Duka kuweka Eneo hili:
                  </label>
                  <div 
                    onClick={handleStoreMapClick}
                    className="relative h-48 bg-neutral-100 dark:bg-neutral-900 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden cursor-crosshair flex flex-col items-center justify-center text-center p-4 transition-all hover:bg-neutral-200/30"
                  >
                    {/* Simulated Floor layout blueprint lines */}
                    <div className="absolute inset-4 border border-neutral-300/20 dark:border-neutral-700/20 pointer-events-none grid grid-cols-4 grid-rows-4">
                      {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} className="border border-neutral-300/10 dark:border-neutral-700/10" />
                      ))}
                    </div>

                    <p className="text-[10px] font-bold text-neutral-400 uppercase pointer-events-none z-10 flex items-center gap-1.5">
                      <ShoppingCart className="w-3.5 h-3.5" /> LANGILIA MLANGONI / ENTRY GATE
                    </p>
                    
                    {/* Floating virtual target marker */}
                    <div 
                      className="absolute w-8 h-8 bg-purple-600 border-2 border-white rounded-full flex items-center justify-center text-white shadow-lg shadow-purple-500/50 z-20 transition-all pointer-events-none"
                      style={{ left: `${posX}%`, top: `${posY}%`, transform: 'translate(-50%, -50%)' }}
                    >
                      <Compass className="w-4 h-4 animate-spin-slow" />
                    </div>

                    <span className="absolute bottom-2 right-3 text-[9px] font-mono text-neutral-400 pointer-events-none">
                      Imewekwa: X: {posX}%, Y: {posY}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-1">
                      Jina la Bidhaa au Sehemu *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Mfan: Rafu ya Mikate & Keki 🍞"
                      className="w-full h-11 px-3.5 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-purple-500 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-1">
                      Namba ya Sehemu / Section ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={sectionCode}
                      onChange={(e) => setSectionCode(e.target.value)}
                      placeholder="Mfan: SEC-1, RAFU-A, n.k."
                      className="w-full h-11 px-3.5 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-purple-500 dark:text-white uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-1">
                      Kundi la Bidhaa / Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full h-11 px-3.5 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-purple-500 dark:text-white cursor-pointer"
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
                      Sarafu za Zawadi (Reward Coins)
                    </label>
                    <input
                      type="number"
                      value={rewardCoins}
                      onChange={(e) => setRewardCoins(Number(e.target.value))}
                      placeholder="Mfan: 50"
                      className="w-full h-11 px-3.5 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-purple-500 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-1">
                    Maelekezo ya AR (Maelezo ya kufika kwa kutumia kamera)
                  </label>
                  <textarea
                    value={directionsHint}
                    onChange={(e) => setDirectionsHint(e.target.value)}
                    placeholder="Mfan: Tembea hatua 10 mbele, geuka kulia kwenye rafu ya katikati kupata bidhaa yako..."
                    rows={2}
                    className="w-full p-3.5 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-purple-500 dark:text-white"
                  />
                </div>

                {/* Gamification Settings */}
                <div className="bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl space-y-4">
                  <div className="flex items-center gap-2">
                    <Gift className="w-4.5 h-4.5 text-purple-500 animate-bounce" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">
                      Gamified Rewards: Punguzo la Bei la Kuscan AR
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-1">
                        Asilimia ya Punguzo (%)
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
                        Punguzo Linahusu nini?
                      </label>
                      <select
                        value={discountTarget}
                        onChange={(e) => setDiscountTarget(e.target.value as any)}
                        className="w-full h-10 px-3 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-purple-500 dark:text-white cursor-pointer"
                      >
                        <option value="specific">Bidhaa Husika Pekee</option>
                        <option value="all">Kila kitu dukani</option>
                      </select>
                    </div>

                    {discountTarget === 'specific' && (
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-1">
                          Jina la Bidhaa Linalolengwa
                        </label>
                        <input
                          type="text"
                          required
                          value={targetProductName}
                          onChange={(e) => setTargetProductName(e.target.value)}
                          placeholder="Mfan: Mkate, Keki ya Azam, n.k."
                          className="w-full h-10 px-3 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-purple-500 dark:text-white"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
                  >
                    Futa Fomu
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-xs rounded-xl shadow-md cursor-pointer active:scale-95 transition-all"
                  >
                    Hifadhi Eneo Jipya la AR
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* List of Registered AR Nodes */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400">
                Orodha ya Maeneo Yaliyounganishwa ({nodes.length})
              </h3>

              {/* Floor Switcher */}
              <div className="flex bg-neutral-200/50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-0.5">
                {[1, 2, 3].map(fl => (
                  <button
                    key={fl}
                    onClick={() => setActiveFloor(fl)}
                    className={`px-3 py-1 text-[10px] font-black rounded-md transition-all cursor-pointer ${
                      activeFloor === fl
                        ? 'bg-purple-600 text-white'
                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
                    }`}
                  >
                    GURUDUMU {fl}
                  </button>
                ))}
              </div>
            </div>

            {nodes.length === 0 ? (
              <div className="bg-white dark:bg-[#111118]/80 border border-neutral-200/50 dark:border-[#1e1e2e] p-10 rounded-2xl text-center space-y-4">
                <Compass className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto animate-pulse" />
                <div>
                  <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                    Hujatengeneza Njia yoyote ya AR kwa ajili ya duka lako bado.
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Anza kwa kubonyeza kitufe cha "Unda Eneo / Bidhaa ya AR" juu ili kuongeza bidhaa kama Mkate au Soda.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {nodes.map(node => (
                  <motion.div
                    key={node.id}
                    layoutId={node.id}
                    className="bg-white dark:bg-[#111118]/80 border border-neutral-200/60 dark:border-[#1e1e2e] p-5 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-3xl p-2 bg-neutral-100 dark:bg-neutral-900 rounded-xl">
                            {node.emoji}
                          </span>
                          <div>
                            <span className="bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 text-[8px] font-black tracking-widest px-2 py-0.5 rounded uppercase">
                              {node.sectionCode}
                            </span>
                            <h4 className="font-extrabold text-neutral-800 dark:text-neutral-100 text-sm mt-1 leading-tight">
                              {node.name}
                            </h4>
                          </div>
                        </div>

                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setPrintNode(node)}
                            className="w-8 h-8 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-purple-500 dark:hover:text-purple-400 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                            title="Print QR Standee"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteNode(node.id)}
                            className="w-8 h-8 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                            title="Futa Kigingi hiki"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-900/60 p-3 rounded-xl border border-neutral-200/50 dark:border-neutral-800/80 leading-relaxed font-medium">
                        <span className="font-bold text-neutral-400 uppercase text-[9px] block mb-0.5">MAALUMU YA AR CAMERA:</span>
                        {node.directionsHint}
                      </p>

                      <div className="mt-3.5 flex flex-wrap gap-2">
                        <span className="bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-600 dark:text-[#FFD700] text-[9px] font-black px-2 py-1 rounded-lg flex items-center gap-1">
                          <Coins className="w-3 h-3" /> +{node.rewardCoins} COINS
                        </span>
                        <span className="bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-[#00FF88] text-[9px] font-black px-2 py-1 rounded-lg flex items-center gap-1">
                          <Tag className="w-3 h-3" /> {node.discountPercentage}% OFF {node.discountTarget === 'specific' ? `(${node.targetProductName})` : 'KILA KITU'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between">
                      <span className="text-[9px] font-mono text-neutral-400">
                        Sakafu {node.floorIndex} | Eneo X:{node.posX}% Y:{node.posY}%
                      </span>
                      <button
                        onClick={() => triggerSimulation(node)}
                        className="bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-[9px] tracking-wider px-3.5 py-1.5 rounded-xl cursor-pointer active:scale-95 transition-all"
                      >
                        Jaribu AR Guide
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Printable Poster & Custom Live Simulated AR Viewer */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Printable Standee card */}
          <div className="bg-white dark:bg-[#111118]/80 border border-neutral-200/70 dark:border-[#1e1e2e] p-5 rounded-2xl shadow-sm text-center">
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-4">
              Printable Stand Card / Sticker
            </h3>

            {printNode ? (
              <div className="space-y-4">
                <div id="ar-print-card" className="border-4 border-dashed border-purple-500/40 p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 relative text-center">
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase shadow">
                    SEHEMU YA {printNode.sectionCode}
                  </span>

                  <div className="w-40 h-40 mx-auto bg-white p-3.5 rounded-2xl shadow-md flex flex-col items-center justify-center border border-neutral-200 mt-2">
                    {/* High fidelity simulation QR */}
                    <div className="grid grid-cols-5 gap-1.5 w-full h-full relative">
                      <div className="border-[4px] border-neutral-900 w-7 h-7 rounded" />
                      <div className="col-span-3" />
                      <div className="border-[4px] border-neutral-900 w-7 h-7 rounded absolute top-0 right-0" />
                      
                      <div className="col-span-5 flex items-center justify-center">
                        <span className="text-4xl animate-bounce">{printNode.emoji}</span>
                      </div>
                      
                      <div className="border-[4px] border-neutral-900 w-7 h-7 rounded absolute bottom-0 left-0" />
                      <div className="col-span-4" />
                    </div>
                  </div>

                  <h4 className="text-sm font-black text-neutral-800 dark:text-neutral-100 mt-4 uppercase tracking-tight leading-none">
                    Skani Kupata Njia ya AR!
                  </h4>
                  <p className="text-[10px] text-neutral-500 mt-1 max-w-[220px] mx-auto">
                    Kuelekea: <strong className="text-neutral-700 dark:text-neutral-200">{printNode.name}</strong>
                  </p>

                  <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800/80 flex justify-center gap-4 text-xs font-black">
                    <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-0.5">
                      🪙 {printNode.rewardCoins} Coins
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                      🏷️ {printNode.discountPercentage}% OFF
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const printContent = document.getElementById('ar-print-card')?.innerHTML;
                      const originalContent = document.body.innerHTML;
                      if (printContent) {
                        document.body.innerHTML = `
                          <div style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif;">
                            <div style="width:350px; border:2px solid #ccc; padding:20px; border-radius:15px; text-align:center;">
                              ${printContent}
                            </div>
                          </div>
                        `;
                        window.print();
                        document.body.innerHTML = originalContent;
                        window.location.reload();
                      }
                    }}
                    className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    Print Sticker
                  </button>
                  <button
                    onClick={() => setPrintNode(null)}
                    className="py-2.5 px-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 text-[10px] font-bold rounded-xl cursor-pointer"
                  >
                    Funga
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 space-y-2.5">
                <QrCode className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto" />
                <p className="text-[11px] font-bold text-neutral-500 max-w-[220px] mx-auto leading-relaxed">
                  Bofya icon ya QR kwenye eneo lolote la orodha ya AR ili kutoa Sticker yenye QR tayari kubandikwa!
                </p>
              </div>
            )}
          </div>

          {/* Interactive AR Shopper Simulator */}
          <div className="bg-[#111118] text-white rounded-3xl p-5 relative overflow-hidden h-[410px] shadow-lg border border-[#1e1e2d] flex flex-col justify-between">
            
            {/* Simulation Header */}
            <div className="flex justify-between items-center z-10">
              <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-md border border-neutral-800">
                <Sparkles className="w-3 h-3 text-yellow-400 animate-pulse" />
                <span className="text-[8px] font-black tracking-widest uppercase">AR SHOPPER CAMERA</span>
              </div>

              <div className="bg-yellow-500/20 text-[#FFD700] border border-yellow-500/30 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1 backdrop-blur-md">
                🪙 {simCoins} Coins
              </div>
            </div>

            {simNode ? (
              <div className="absolute inset-0 z-0 flex flex-col justify-between p-5 pt-16 pb-4">
                {/* Visual simulator backdrop */}
                <div className="absolute inset-0 bg-neutral-900 opacity-60 z-[-1]" />
                
                {simStep === 'scan' && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-24 h-24 border-2 border-purple-500/80 rounded-2xl relative animate-pulse flex items-center justify-center bg-purple-500/10 shadow-lg shadow-purple-500/20">
                      <QrCode className="w-12 h-12 text-purple-400" />
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-purple-400 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-purple-400 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-purple-400 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-purple-400 rounded-br-lg" />
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-purple-400">
                        Scan AR Indoor Tag
                      </p>
                      <p className="text-[10px] text-neutral-300 mt-1 max-w-[240px] mx-auto leading-relaxed">
                        Mteja anavyofika kwenye duka lako au eneo la scan, anascan QR ya stika ya <strong>{simNode.sectionCode}</strong> ili kuanza.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setSimStep('guidance');
                        setSimCameraActive(true);
                      }}
                      className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-wider px-5 py-2.5 rounded-xl active:scale-95 transition-all cursor-pointer shadow-md shadow-purple-600/30"
                    >
                      Scan QR (Simulate)
                    </button>
                  </div>
                )}

                {simStep === 'guidance' && (
                  <div className="flex-1 flex flex-col justify-between py-2">
                    <div className="flex-1 flex flex-col items-center justify-center relative">
                      
                      {/* Floating overlay 3D visual card */}
                      <div className="text-center space-y-1.5 bg-black/75 p-3.5 rounded-2xl border border-purple-500/30 backdrop-blur-md max-w-[230px] shadow-2xl">
                        <Navigation className="w-5 h-5 text-purple-400 mx-auto animate-bounce" />
                        <p className="text-[10px] font-extrabold uppercase text-purple-400">Hatua za AR Wayfinding</p>
                        <p className="text-[9.5px] text-neutral-200 leading-snug">
                          {simNode.directionsHint}
                        </p>
                      </div>

                      {/* Direction Pointer Animation */}
                      <motion.div
                        animate={{ y: [0, -12, 0], scale: [1, 1.05, 1] }}
                        transition={{ repeat: Infinity, duration: 1.8 }}
                        className="mt-6 flex flex-col items-center"
                      >
                        <div className="w-14 h-14 bg-gradient-to-tr from-purple-600 to-indigo-600 border-2 border-purple-300 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50">
                          <Compass className="w-7 h-7 text-white animate-pulse" />
                        </div>
                        <span className="text-[9px] font-black tracking-widest text-purple-300 mt-2 uppercase bg-black/60 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                          Mita 3 Zilizobaki
                        </span>
                      </motion.div>
                    </div>

                    <button
                      onClick={() => {
                        setSimStep('reached');
                        setSimCoins(prev => prev + simNode.rewardCoins);
                        setUnlockedDiscounts(prev => [...prev, simNode.id]);
                        toast.success(`Umefanikiwa kufika! Coins +${simNode.rewardCoins} zimeongezwa!`);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider py-2.5 rounded-xl text-center active:scale-95 transition-all cursor-pointer shadow-md shadow-emerald-600/30"
                    >
                      Nimefika Eneo (Arrive)
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
                        Hongera! Umefika {simNode.emoji}
                      </h4>
                      <p className="text-[10px] text-neutral-300 mt-1 max-w-[240px] leading-relaxed">
                        Kamera ya AR imekupitisha barabara! Umeshinda <strong>+{simNode.rewardCoins} Coins</strong> na Punguzo hili!
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl w-full text-left">
                      <p className="text-[9px] font-bold text-neutral-400 uppercase">Kuponi Yako ya Punguzo:</p>
                      <p className="text-xs font-black text-yellow-400 mt-1 flex items-center gap-1.5 uppercase">
                        <Tag className="w-4 h-4 text-emerald-400" />
                        {simNode.discountPercentage}% OFF ON {simNode.discountTarget === 'specific' ? simNode.targetProductName : 'STOREWIDE!'}
                      </p>
                      <div className="mt-2 bg-purple-500/10 border border-purple-500/20 py-1 px-2.5 rounded text-[10px] font-mono text-center font-bold tracking-widest text-purple-300 uppercase">
                        DISCOUNT{simNode.discountPercentage}
                      </div>
                    </div>

                    <button
                      onClick={() => setSimNode(null)}
                      className="bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-bold py-2 px-5 rounded-xl cursor-pointer active:scale-95 transition-all"
                    >
                      Tafuta Eneo Lingine
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <Compass className="w-14 h-14 text-neutral-700 mb-3 animate-spin-slow" />
                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-500">
                  Hakuna Demo iliyochaguliwa
                </h4>
                <p className="text-[10.5px] text-neutral-500 mt-1.5 max-w-[210px] mx-auto leading-relaxed">
                  Bofya kitufe cha <strong>"Jaribu AR Guide"</strong> kwenye sehemu ya orodha kushoto ili kuona jinsi mteja wako atakavyotumia kamera kufika kwenye bidhaa!
                </p>
              </div>
            )}

            {/* Bottom Bar Indicator */}
            <div className="h-1 bg-neutral-800 w-1/3 mx-auto rounded-full mt-2" />
          </div>

        </div>

      </div>

    </div>
  );
}
