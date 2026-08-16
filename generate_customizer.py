import re

with open('src/components/VendorDashboard.tsx', 'r') as f:
    content = f.read()

# Replacement for Controls for Gold Menu Showcase
new_controls_section = '''{/* Controls for Gold Menu Showcase */}
                      {standDisplayLayout === 'gold_menu_showcase' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          
                          {/* 1. COLOR THEME & PRESETS CUSTOMIZER */}
                          <div className="space-y-3.5 p-4 bg-gradient-to-br from-neutral-900/90 to-neutral-950 border border-amber-500/30 rounded-2xl shadow-md">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-amber-300 uppercase tracking-[0.18em] flex items-center gap-1.5">
                                <Palette className="w-3.5 h-3.5 text-amber-400" /> Rangi & Mandhari ya Bango (Color Theme)
                              </span>
                              <span className="text-[8px] font-mono text-amber-400/80 uppercase font-bold">
                                {goldThemePreset.toUpperCase()}
                              </span>
                            </div>

                            {/* Preset Themes Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[
                                { id: 'gold', name: 'Dhahabu Halisi', subtitle: 'Luxury Gold', primary: '#eab308', accent: '#f59e0b', bgStart: '#23170a', bgEnd: '#050302', cardBg: '#170e06', text: '#fef08a', swatch: 'from-amber-500 to-yellow-700' },
                                { id: 'emerald', name: 'Kijani cha Kifalme', subtitle: 'Emerald Green', primary: '#10b981', accent: '#34d399', bgStart: '#022c22', bgEnd: '#020f0d', cardBg: '#06251d', text: '#a7f3d0', swatch: 'from-emerald-500 to-teal-800' },
                                { id: 'ruby', name: 'Nyekundu ya Ruby', subtitle: 'Ruby Velvet', primary: '#ef4444', accent: '#f87171', bgStart: '#2a0808', bgEnd: '#090202', cardBg: '#1c0707', text: '#fecaca', swatch: 'from-red-500 to-rose-900' },
                                { id: 'sapphire', name: 'Bluu ya Kifalme', subtitle: 'Sapphire Blue', primary: '#3b82f6', accent: '#60a5fa', bgStart: '#0b192c', bgEnd: '#02070f', cardBg: '#081426', text: '#bfdbfe', swatch: 'from-blue-500 to-indigo-900' },
                                { id: 'rosegold', name: 'Dhahabu ya Waridi', subtitle: 'Rose Gold', primary: '#f472b6', accent: '#fb7185', bgStart: '#280d19', bgEnd: '#080206', cardBg: '#1d0a13', text: '#fbcfe8', swatch: 'from-pink-400 to-rose-700' },
                                { id: 'obsidian', name: 'Nyeusi & Machweo', subtitle: 'Sunset Amber', primary: '#f97316', accent: '#fb923c', bgStart: '#18181b', bgEnd: '#000000', cardBg: '#121214', text: '#fed7aa', swatch: 'from-orange-500 to-neutral-900' },
                                { id: 'amethyst', name: 'Zambarau ya Kifalme', subtitle: 'Royal Purple', primary: '#a855f7', accent: '#c084fc', bgStart: '#1e0e2e', bgEnd: '#06020c', cardBg: '#150824', text: '#e9d5ff', swatch: 'from-purple-500 to-violet-900' },
                                { id: 'custom', name: 'Rangi Zako (Custom)', subtitle: 'Kibinafsi', primary: goldPrimaryColor, accent: goldAccentColor, bgStart: goldBgColorStart, bgEnd: goldBgColorEnd, cardBg: goldCardBgColor, text: goldTextColor, swatch: 'from-neutral-700 to-neutral-900' },
                              ].map(t => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => {
                                    setGoldThemePreset(t.id);
                                    if (t.id !== 'custom') {
                                      setGoldPrimaryColor(t.primary);
                                      setGoldAccentColor(t.accent);
                                      setGoldBgColorStart(t.bgStart);
                                      setGoldBgColorEnd(t.bgEnd);
                                      setGoldCardBgColor(t.cardBg);
                                      setGoldTextColor(t.text);
                                      toast.success(`Mandhari ya ${t.name} imewekwa!`);
                                    }
                                  }}
                                  className={`p-2 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
                                    goldThemePreset === t.id 
                                      ? 'border-white ring-2 ring-amber-400 shadow-lg scale-[1.02]' 
                                      : 'border-white/10 hover:border-white/30 bg-black/40'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${t.swatch} border border-white/40 shadow-xs shrink-0`}></div>
                                    {goldThemePreset === t.id && (
                                      <CheckCircle2 className="w-3 h-3 text-white" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-[9.5px] font-black text-white uppercase leading-tight truncate">{t.name}</p>
                                    <p className="text-[7.5px] text-neutral-400 truncate">{t.subtitle}</p>
                                  </div>
                                </button>
                              ))}
                            </div>

                            {/* Detailed Custom Color Pickers */}
                            <div className="pt-2 border-t border-white/5 space-y-2.5">
                              <span className="text-[8.5px] font-black text-neutral-400 uppercase tracking-wider block">
                                Rekebisha Rangi Moja kwa Moja (Detailed Color Pickers)
                              </span>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <span className="text-[7.5px] font-black text-neutral-400 uppercase tracking-tight block">Rangi Kuu / Border</span>
                                  <div className="flex items-center gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">
                                    <input 
                                      type="color" 
                                      value={goldPrimaryColor}
                                      onChange={(e) => {
                                        setGoldPrimaryColor(e.target.value);
                                        setGoldThemePreset('custom');
                                      }}
                                      className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
                                    />
                                    <span className="text-[9px] font-mono text-neutral-200 font-bold uppercase">{goldPrimaryColor}</span>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[7.5px] font-black text-neutral-400 uppercase tracking-tight block">Rangi ya Mwanga (Accent)</span>
                                  <div className="flex items-center gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">
                                    <input 
                                      type="color" 
                                      value={goldAccentColor}
                                      onChange={(e) => {
                                        setGoldAccentColor(e.target.value);
                                        setGoldThemePreset('custom');
                                      }}
                                      className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
                                    />
                                    <span className="text-[9px] font-mono text-neutral-200 font-bold uppercase">{goldAccentColor}</span>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[7.5px] font-black text-neutral-400 uppercase tracking-tight block">Rangi ya Maandishi</span>
                                  <div className="flex items-center gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">
                                    <input 
                                      type="color" 
                                      value={goldTextColor}
                                      onChange={(e) => {
                                        setGoldTextColor(e.target.value);
                                        setGoldThemePreset('custom');
                                      }}
                                      className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
                                    />
                                    <span className="text-[9px] font-mono text-neutral-200 font-bold uppercase">{goldTextColor}</span>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[7.5px] font-black text-neutral-400 uppercase tracking-tight block">Mandhari (Juu)</span>
                                  <div className="flex items-center gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">
                                    <input 
                                      type="color" 
                                      value={goldBgColorStart}
                                      onChange={(e) => {
                                        setGoldBgColorStart(e.target.value);
                                        setGoldThemePreset('custom');
                                      }}
                                      className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
                                    />
                                    <span className="text-[9px] font-mono text-neutral-200 font-bold uppercase">{goldBgColorStart}</span>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[7.5px] font-black text-neutral-400 uppercase tracking-tight block">Mandhari (Chini)</span>
                                  <div className="flex items-center gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">
                                    <input 
                                      type="color" 
                                      value={goldBgColorEnd}
                                      onChange={(e) => {
                                        setGoldBgColorEnd(e.target.value);
                                        setGoldThemePreset('custom');
                                      }}
                                      className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
                                    />
                                    <span className="text-[9px] font-mono text-neutral-200 font-bold uppercase">{goldBgColorEnd}</span>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[7.5px] font-black text-neutral-400 uppercase tracking-tight block">Vibao vya Kadi</span>
                                  <div className="flex items-center gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">
                                    <input 
                                      type="color" 
                                      value={goldCardBgColor}
                                      onChange={(e) => {
                                        setGoldCardBgColor(e.target.value);
                                        setGoldThemePreset('custom');
                                      }}
                                      className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
                                    />
                                    <span className="text-[9px] font-mono text-neutral-200 font-bold uppercase">{goldCardBgColor}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 2. DISHES / PRODUCTS MANAGEMENT SECTION (DYNAMIC: ONLY REAL PRODUCTS) */}
                          <div className="space-y-3.5 p-4 bg-neutral-900/60 border border-white/5 rounded-2xl">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <Utensils className="w-3.5 h-3.5 text-amber-400" />
                                <label className="text-[10px] font-black text-white uppercase tracking-[0.18em]">
                                  Bidhaa Maalumu kwenye Bango ({showcaseDishes.length})
                                </label>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!products || products.length === 0) {
                                      toast.error('Hakuna bidhaa kwenye orodha yako ya duka. Ongeza bidhaa kwanza au andika kwa mkono!');
                                      return;
                                    }
                                    // Load only real existing products, max 3
                                    const realProducts = products.slice(0, 3).map((p, idx) => ({
                                      id: `dish-prod-${p.id || idx}`,
                                      name: (p.name || 'BIDHAA').toUpperCase(),
                                      emoji: idx === 0 ? '🔥' : idx === 1 ? '🍲' : '🌿',
                                      price: Number(p.price || 0).toLocaleString(),
                                      badge: idx === 0 ? 'BEST SELLER' : idx === 1 ? "CHEF'S CHOICE" : 'FRESH & NATURAL',
                                      badgeColor: idx === 0 ? '#dc2626' : idx === 1 ? '#15803d' : '#1d4ed8',
                                      description: p.description || 'Chakula kizuri kilichoandaliwa kwa ubora na usafi wa hali ya juu.',
                                      imageUrl: p.imageUrl || 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80',
                                    }));
                                    setShowcaseDishes(realProducts);
                                    setActiveDishEditIndex(0);
                                    setShowGoldDishes(true);
                                    toast.success(`Bidhaa ${realProducts.length} kutoka menyu yako zimepakiwa!`);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 text-[8.5px] font-black uppercase tracking-wider border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <Package className="w-3 h-3" /> Pakia kutoka Menyu
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (showcaseDishes.length >= 4) {
                                      toast.info('Upeo ni sahani 4 kwa bango moja.');
                                      return;
                                    }
                                    const newDish = {
                                      id: `dish-${Date.now()}`,
                                      name: 'SAHANI MPYA',
                                      emoji: '✨',
                                      price: '10,000',
                                      badge: 'POPULAR',
                                      badgeColor: '#d97706',
                                      description: 'Ladha halisi ya chakula safi kilichoandaliwa kwa ubora.',
                                      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80',
                                    };
                                    setShowcaseDishes([...showcaseDishes, newDish]);
                                    setActiveDishEditIndex(showcaseDishes.length);
                                    setShowGoldDishes(true);
                                    toast.success('Sahani mpya imeongezwa!');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[8.5px] font-black uppercase tracking-wider border border-white/10 transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Ongeza
                                </button>

                                {showcaseDishes.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowcaseDishes([]);
                                      toast.success('Sahani zote zimeondolewa kwenye bango!');
                                    }}
                                    className="px-2 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 text-[8.5px] font-black uppercase tracking-wider border border-red-500/20 transition-all cursor-pointer"
                                  >
                                    Futa Zote
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Toggle Show/Hide Dishes */}
                            <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-xl border border-white/5">
                              <span className="text-[8.5px] text-neutral-300 font-bold uppercase">
                                Onyesha Sehemu ya Sahani Maalumu kwenye Bango
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowGoldDishes(!showGoldDishes)}
                                className={`w-10 h-5 rounded-full transition-all relative flex items-center px-0.5 cursor-pointer ${showGoldDishes ? 'bg-amber-600' : 'bg-neutral-800'}`}
                              >
                                <div className={`w-4 h-4 bg-white rounded-full transition-all shadow-xs ${showGoldDishes ? 'translate-x-5' : 'translate-x-0'}`}></div>
                              </button>
                            </div>

                            {/* If no dishes or toggled off */}
                            {(!showGoldDishes || showcaseDishes.length === 0) && (
                              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 text-center space-y-1">
                                <p className="text-[10px] font-black text-amber-300 uppercase">Hakuna Sahani Zilizowekwa</p>
                                <p className="text-[8.5px] text-neutral-400">
                                  Bango lako litaonekana safi likiwa na Nembo, Nambari ya Meza, QR Kuu ya Duka na WiFi bila sahani bandia.
                                </p>
                              </div>
                            )}

                            {/* Dish Select Tabs */}
                            {showGoldDishes && showcaseDishes.length > 0 && (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {showcaseDishes.map((dish, idx) => (
                                    <div
                                      key={`dish-tab-${dish.id}-${idx}`}
                                      className={`relative rounded-xl border transition-all flex items-center justify-between p-2 cursor-pointer ${
                                        activeDishEditIndex === idx 
                                          ? 'bg-amber-600/20 border-amber-500 text-amber-300 ring-1 ring-amber-500/40' 
                                          : 'bg-neutral-900/60 border-white/5 text-neutral-400 hover:border-white/20'
                                      }`}
                                      onClick={() => setActiveDishEditIndex(idx)}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        <span className="text-sm">{dish.emoji || '🍽️'}</span>
                                        <div className="truncate min-w-0">
                                          <p className="text-[9.5px] font-black uppercase text-white truncate">#{idx + 1} {dish.name || `Sahani ${idx + 1}`}</p>
                                          <p className="text-[8px] text-amber-400 font-mono font-bold truncate">TSH {dish.price}</p>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const filtered = showcaseDishes.filter((_, i) => i !== idx);
                                          setShowcaseDishes(filtered);
                                          if (activeDishEditIndex >= filtered.length) {
                                            setActiveDishEditIndex(Math.max(0, filtered.length - 1));
                                          }
                                          toast.success('Sahani imeondolewa!');
                                        }}
                                        className="text-neutral-500 hover:text-red-400 p-1 transition-all"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>

                                {/* Active Dish Editor Box */}
                                {showcaseDishes[activeDishEditIndex] && (
                                  <div className="bg-neutral-900/90 border border-white/10 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
                                    <div className="flex items-center justify-between pb-2 border-b border-white/5 flex-wrap gap-2">
                                      <span className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                                        <Utensils className="w-3.5 h-3.5 text-amber-400" />
                                        Sahani #{activeDishEditIndex + 1}: {showcaseDishes[activeDishEditIndex].name}
                                      </span>
                                      
                                      {/* Quick pick from vendor inventory */}
                                      {products && products.length > 0 && (
                                        <select
                                          onChange={(e) => {
                                            const prod = products.find(p => p.id === e.target.value);
                                            if (prod) {
                                              const updated = [...showcaseDishes];
                                              updated[activeDishEditIndex] = {
                                                ...updated[activeDishEditIndex],
                                                name: (prod.name || 'BIDHAA').toUpperCase(),
                                                price: Number(prod.price || 0).toLocaleString(),
                                                description: prod.description || 'Chakula kitamu na chenye ladha safi.',
                                                imageUrl: prod.imageUrl || updated[activeDishEditIndex].imageUrl,
                                              };
                                              setShowcaseDishes(updated);
                                              toast.success(`Taarifa za "${prod.name}" zimewekwa kwenye sahani #${activeDishEditIndex + 1}!`);
                                            }
                                          }}
                                          className="bg-neutral-950 border border-white/15 text-neutral-300 text-[9px] font-bold rounded-lg px-2 py-1 outline-none max-w-[170px] truncate"
                                          defaultValue=""
                                        >
                                          <option value="" disabled>Badilisha kutoka Menyu...</option>
                                          {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} (TSH {Number(p.price).toLocaleString()})</option>
                                          ))}
                                        </select>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Jina la Chakula / Bidhaa</span>
                                        <Input 
                                          value={showcaseDishes[activeDishEditIndex].name}
                                          onChange={(e) => {
                                            const updated = [...showcaseDishes];
                                            updated[activeDishEditIndex].name = e.target.value.toUpperCase();
                                            setShowcaseDishes(updated);
                                          }}
                                          placeholder="e.g. KUKU CHOMA"
                                          className="bg-neutral-950 border-white/10 h-10 rounded-xl text-white font-black text-xs uppercase"
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Bei (TSH)</span>
                                        <Input 
                                          value={showcaseDishes[activeDishEditIndex].price}
                                          onChange={(e) => {
                                            const updated = [...showcaseDishes];
                                            updated[activeDishEditIndex].price = e.target.value;
                                            setShowcaseDishes(updated);
                                          }}
                                          placeholder="15,000"
                                          className="bg-neutral-950 border-white/10 h-10 rounded-xl text-amber-300 font-mono font-black text-xs"
                                        />
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Emoji ya Chakula</span>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          {['🔥', '🍲', '🌿', '🥩', '🍗', '🐟', '🍕', '🍔', '🍹', '☕', '👟', '🛍️', '✨'].map(em => (
                                            <button
                                              key={em}
                                              type="button"
                                              onClick={() => {
                                                const updated = [...showcaseDishes];
                                                updated[activeDishEditIndex].emoji = em;
                                                setShowcaseDishes(updated);
                                              }}
                                              className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center transition-all ${
                                                showcaseDishes[activeDishEditIndex].emoji === em ? 'bg-amber-600 text-white scale-110' : 'bg-neutral-950 hover:bg-neutral-800'
                                              }`}
                                            >
                                              {em}
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Taji / Badge ya Sahani</span>
                                        <select
                                          value={showcaseDishes[activeDishEditIndex].badge}
                                          onChange={(e) => {
                                            const updated = [...showcaseDishes];
                                            updated[activeDishEditIndex].badge = e.target.value;
                                            if (e.target.value === 'BEST SELLER') updated[activeDishEditIndex].badgeColor = '#dc2626';
                                            if (e.target.value === "CHEF'S CHOICE") updated[activeDishEditIndex].badgeColor = '#15803d';
                                            if (e.target.value === 'FRESH & NATURAL') updated[activeDishEditIndex].badgeColor = '#1d4ed8';
                                            if (e.target.value === 'VIP SPECIAL') updated[activeDishEditIndex].badgeColor = '#b45309';
                                            if (e.target.value === 'HOT OFFER') updated[activeDishEditIndex].badgeColor = '#e11d48';
                                            setShowcaseDishes(updated);
                                          }}
                                          className="bg-neutral-950 border border-white/10 text-white text-[10px] font-bold rounded-xl h-10 px-2 w-full outline-none uppercase"
                                        >
                                          <option value="BEST SELLER">BEST SELLER ★★★</option>
                                          <option value="CHEF'S CHOICE">CHEF'S CHOICE ★★★</option>
                                          <option value="FRESH & NATURAL">FRESH & NATURAL ★★★</option>
                                          <option value="VIP SPECIAL">VIP SPECIAL 🔥</option>
                                          <option value="MOST POPULAR">MOST POPULAR ✨</option>
                                          <option value="HOT OFFER">HOT OFFER 💥</option>
                                        </select>
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Maelezo Mafupi ya Chakula (Description)</span>
                                      <Input 
                                        value={showcaseDishes[activeDishEditIndex].description}
                                        onChange={(e) => {
                                          const updated = [...showcaseDishes];
                                          updated[activeDishEditIndex].description = e.target.value;
                                          setShowcaseDishes(updated);
                                        }}
                                        placeholder="Kuku choma tamu na ladha ya kipekee, ikichezwa na viungo bora."
                                        className="bg-neutral-950 border-white/10 h-10 rounded-xl text-neutral-300 text-xs"
                                      />
                                    </div>

                                    <div className="space-y-1">
                                      <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Picha ya Sahani (Image URL)</span>
                                      <Input 
                                        value={showcaseDishes[activeDishEditIndex].imageUrl}
                                        onChange={(e) => {
                                          const updated = [...showcaseDishes];
                                          updated[activeDishEditIndex].imageUrl = e.target.value;
                                          setShowcaseDishes(updated);
                                        }}
                                        placeholder="https://images.unsplash.com/..."
                                        className="bg-neutral-950 border-white/10 h-10 rounded-xl text-neutral-400 text-[10px] font-mono"
                                      />
                                    </div>

                                    <div className="pt-1 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const filtered = showcaseDishes.filter((_, i) => i !== activeDishEditIndex);
                                          setShowcaseDishes(filtered);
                                          setActiveDishEditIndex(Math.max(0, filtered.length - 1));
                                          toast.success('Sahani imeondolewa!');
                                        }}
                                        className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/40 text-red-300 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" /> Futa Sahani Hii (#{activeDishEditIndex + 1})
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 3. Banner Header & Branding Settings */}
                          <div className="space-y-3 p-4 bg-neutral-900/60 border border-white/5 rounded-2xl">
                            <span className="text-[9px] font-black text-amber-300 uppercase tracking-widest flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3 text-amber-400" /> Kichwa cha Mgahawa & Mabango (Header & Signs)
                            </span>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Jina la Mgahawa (Header)</span>
                                <Input 
                                  value={printDetails.header || vendorProfile?.businessName || 'RESTAURANTKISINIA'}
                                  onChange={(e) => setPrintDetails({ ...printDetails, header: e.target.value.toUpperCase() })}
                                  placeholder="RESTAURANTKISINIA"
                                  className="bg-black/60 border-white/10 h-10 rounded-xl text-amber-300 font-black text-xs uppercase"
                                />
                              </div>
                              <div className="space-y-1">
                                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Mwaka wa Kuanzishwa (Since)</span>
                                <Input 
                                  value={goldMenuSince}
                                  onChange={(e) => setGoldMenuSince(e.target.value.toUpperCase())}
                                  placeholder="SINCE 2023"
                                  className="bg-black/60 border-white/10 h-10 rounded-xl text-amber-200 font-mono text-xs uppercase"
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Kichwa cha Ribbon / Slogan</span>
                              <Input 
                                value={goldMenuBanner}
                                onChange={(e) => setGoldMenuBanner(e.target.value.toUpperCase())}
                                placeholder="DELICIOUS FOOD • GREAT TASTE • HAPPY YOU"
                                className="bg-black/60 border-white/10 h-10 rounded-xl text-amber-200 font-black text-xs uppercase tracking-wider text-center"
                              />
                            </div>
                          </div>

                          {/* 4. Footer & Contacts Customizer */}
                          <div className="space-y-3 p-4 bg-neutral-900/60 border border-white/5 rounded-2xl">
                            <span className="text-[9px] font-black text-neutral-300 uppercase tracking-widest block">Taarifa za Mawasiliano & Tovuti (Footer Info)</span>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Tovuti / Portal</span>
                                <Input 
                                  value={goldWebsiteUrl}
                                  onChange={(e) => setGoldWebsiteUrl(e.target.value.toUpperCase())}
                                  placeholder="WWW.AGIZA.CO.TZ"
                                  className="bg-black/60 border-white/10 h-10 rounded-xl text-white text-xs font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Simu ya Huduma (Sales/Phone)</span>
                                <Input 
                                  value={goldSalesPhone}
                                  onChange={(e) => setGoldSalesPhone(e.target.value)}
                                  placeholder="+255 7XX XXX XXX"
                                  className="bg-black/60 border-white/10 h-10 rounded-xl text-white text-xs font-mono"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Barua Pepe ya Msaada (Support Email)</span>
                              <Input 
                                value={goldSupportEmail}
                                onChange={(e) => setGoldSupportEmail(e.target.value.toUpperCase())}
                                placeholder="SUPPORT@AGIZA.CO.TZ"
                                className="bg-black/60 border-white/10 h-10 rounded-xl text-white text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      )}'''

# Replacement for the live stand preview of Gold Menu Showcase
new_preview_section = '''{/* STAND YA MEZANI PREVIEW: LUXURY GOLD MENU SHOWCASE (MATCHING USER IMAGE 100%) */}
                  {qrBuilderMode === 'table_stand' && standDisplayLayout === 'gold_menu_showcase' && (
                    <div className="w-full flex flex-col items-center justify-center py-1">
                      <div 
                        id="printable-stand" 
                        className="w-full max-w-[420px] rounded-[2.5rem] overflow-hidden relative shadow-[0_30px_90px_rgba(0,0,0,0.95)] border-2 text-amber-100 p-4 sm:p-5"
                        style={{
                          background: `radial-gradient(ellipse at top, ${goldBgColorStart} 0%, ${goldCardBgColor} 45%, ${goldBgColorEnd} 100%)`,
                          borderColor: `${goldPrimaryColor}b3`,
                          boxShadow: `0 0 35px ${goldAccentColor}26`,
                        }}
                      >
                        {/* Background Ambiance Glow & Bokeh */}
                        <div 
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background: `radial-gradient(circle at 50% 0%, ${goldAccentColor}2e 0%, transparent 60%)`,
                          }}
                        ></div>
                        <div 
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background: `radial-gradient(circle at 10% 80%, ${goldPrimaryColor}1f 0%, transparent 40%)`,
                          }}
                        ></div>
                        <div 
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background: `radial-gradient(circle at 90% 80%, ${goldPrimaryColor}1f 0%, transparent 40%)`,
                          }}
                        ></div>

                        {/* Top Hanging Boards with Ropes */}
                        <div className="relative z-20 flex items-start justify-between mb-1 px-1">
                          {/* Left Hanging Sign: Fresh Tasty Healthy */}
                          <div className="flex flex-col items-center">
                            {/* Ropes */}
                            <div className="flex justify-between w-8 h-3 px-1">
                              <div className="w-0.5 h-full" style={{ background: `linear-gradient(to bottom, ${goldPrimaryColor}, #78350f)` }}></div>
                              <div className="w-0.5 h-full" style={{ background: `linear-gradient(to bottom, ${goldPrimaryColor}, #78350f)` }}></div>
                            </div>
                            {/* Wooden Plank */}
                            <div className="px-2.5 py-1 rounded-md bg-[#2b170c] border border-[#78350f] shadow-md text-center">
                              <p className="text-[7.5px] font-serif italic leading-tight" style={{ color: goldTextColor }}>Fresh</p>
                              <p className="text-[7.5px] font-bold text-amber-100 leading-tight">Tasty ♡</p>
                              <p className="text-[7px] leading-tight" style={{ color: goldPrimaryColor }}>Healthy</p>
                            </div>
                          </div>

                          {/* Center Crest: Circular Seal */}
                          <div className="flex flex-col items-center justify-center -mt-1">
                            <div 
                              className="w-13 h-13 sm:w-14 sm:h-14 rounded-full flex flex-col items-center justify-center relative p-1 border-2 shadow-lg"
                              style={{
                                background: `linear-gradient(to bottom, ${goldBgColorStart}, #0d0905, ${goldCardBgColor})`,
                                borderColor: goldPrimaryColor,
                                boxShadow: `0 0 16px ${goldAccentColor}66`,
                              }}
                            >
                              <div className="text-[5.5px] font-black uppercase tracking-widest text-center leading-none" style={{ color: goldTextColor }}>
                                RESTAURANT
                              </div>
                              <div className="text-[4.5px] font-mono tracking-tighter mb-0.5" style={{ color: `${goldTextColor}cc` }}>
                                {goldMenuSince || 'SINCE 2023'}
                              </div>
                              <div className="flex items-center justify-center gap-1 my-0.5">
                                <Utensils className="w-3.5 h-3.5" style={{ color: goldPrimaryColor }} />
                                <Flame className="w-3.5 h-3.5 text-red-500 fill-red-500 animate-pulse" />
                              </div>
                              <div className="text-[5.5px]" style={{ color: goldPrimaryColor }}>★ ⚜ ★</div>
                            </div>
                          </div>

                          {/* Right Hanging Sign: Karibu Sana */}
                          <div className="flex flex-col items-center">
                            {/* Ropes */}
                            <div className="flex justify-between w-8 h-3 px-1">
                              <div className="w-0.5 h-full" style={{ background: `linear-gradient(to bottom, ${goldPrimaryColor}, #78350f)` }}></div>
                              <div className="w-0.5 h-full" style={{ background: `linear-gradient(to bottom, ${goldPrimaryColor}, #78350f)` }}></div>
                            </div>
                            {/* Wooden Plank */}
                            <div className="px-2.5 py-1 rounded-md bg-[#2b170c] border border-[#78350f] shadow-md text-center">
                              <p className="text-[7.5px] font-black uppercase tracking-wider leading-tight" style={{ color: goldTextColor }}>KARIBU</p>
                              <p className="text-[7.5px] font-black uppercase tracking-wider text-amber-100 leading-tight">SANA!</p>
                              <p className="text-[8px] text-red-500 leading-tight">❤️</p>
                            </div>
                          </div>
                        </div>

                        {/* Giant 3D Gold Metallic Title */}
                        <div className="text-center relative z-10 mt-1 mb-2">
                          <h1 
                            className="text-xl sm:text-2xl font-black uppercase tracking-wider text-transparent bg-clip-text drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-sans"
                            style={{
                              backgroundImage: `linear-gradient(to bottom, #ffffff, ${goldTextColor}, ${goldPrimaryColor}, ${goldAccentColor})`
                            }}
                          >
                            {printDetails.header || vendorProfile?.businessName || 'RESTAURANTKISINIA'}
                          </h1>
                          
                          {/* Gold Pill Subtitle Banner */}
                          <div 
                            className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full shadow-sm mt-1 border"
                            style={{
                              background: `linear-gradient(to right, ${goldAccentColor}33, ${goldPrimaryColor}4d, ${goldAccentColor}33)`,
                              borderColor: `${goldPrimaryColor}99`,
                            }}
                          >
                            <span className="text-[6.5px]" style={{ color: goldPrimaryColor }}>◆</span>
                            <span className="text-[7.5px] sm:text-[8.5px] font-black uppercase tracking-[0.18em]" style={{ color: goldTextColor }}>
                              {goldMenuBanner || 'DELICIOUS FOOD • GREAT TASTE • HAPPY YOU'}
                            </span>
                            <span className="text-[6.5px]" style={{ color: goldPrimaryColor }}>◆</span>
                          </div>
                        </div>

                        {/* Real Featured Food Items Showcase (ONLY IF PRODUCTS EXIST & ARE ENABLED) */}
                        {showGoldDishes && showcaseDishes.length > 0 && (
                          <div className="space-y-2.5 relative z-10 my-2">
                            {showcaseDishes.map((dish, dIdx) => {
                              const itemQrLink = `${window.location.origin}/table/${vendorProfile?.id || ''}/${selectedSection?.number || '21'}?item=${encodeURIComponent(dish.name)}`;
                              return (
                                <div 
                                  key={`gold-dish-card-v2-${dish.id}-${dIdx}`}
                                  className="relative rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2.5 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.6)] border"
                                  style={{
                                    background: `linear-gradient(to right, ${goldCardBgColor}f2, #0d0803f2, ${goldCardBgColor}f2)`,
                                    borderColor: `${goldPrimaryColor}88`,
                                  }}
                                >
                                  {/* Left: Circular Dish Image with Gold Ring & Rosette Badge */}
                                  <div className="relative shrink-0 flex flex-col items-center">
                                    {/* Rosette Badge Tag */}
                                    <div 
                                      className="absolute -top-2 -left-1.5 z-20 px-2 py-0.5 rounded-full text-[6px] font-black uppercase tracking-wider shadow-md border flex flex-col items-center justify-center leading-none text-center"
                                      style={{ 
                                        backgroundColor: dish.badgeColor || (dIdx === 0 ? '#dc2626' : dIdx === 1 ? '#15803d' : '#1d4ed8'),
                                        borderColor: 'rgba(255,255,255,0.6)',
                                        color: '#ffffff'
                                      }}
                                    >
                                      <span>{dish.badge || (dIdx === 0 ? 'BEST SELLER' : dIdx === 1 ? "CHEF'S CHOICE" : 'FRESH & NATURAL')}</span>
                                      <span className="text-[5px] tracking-widest" style={{ color: goldTextColor }}>★★★</span>
                                    </div>

                                    {/* Dish Image */}
                                    <div 
                                      className="w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-full overflow-hidden border-2 bg-neutral-900 shrink-0"
                                      style={{
                                        borderColor: goldPrimaryColor,
                                        boxShadow: `0 0 14px ${goldAccentColor}66`,
                                      }}
                                    >
                                      <img 
                                        src={getProxiedImageUrl(dish.imageUrl) || 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80'} 
                                        alt={dish.name} 
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  </div>

                                  {/* Middle: Title, Price, Dotted Line, Description */}
                                  <div className="flex-1 min-w-0 pr-1 text-left">
                                    <div className="flex items-center gap-1 leading-tight mb-0.5">
                                      <h4 className="text-xs sm:text-[13px] font-black uppercase text-amber-50 tracking-tight leading-snug">
                                        {dish.name}
                                      </h4>
                                      <span className="text-xs shrink-0">{dish.emoji}</span>
                                    </div>

                                    <div className="text-xs sm:text-sm font-black font-serif leading-tight" style={{ color: goldTextColor }}>
                                      TSH {dish.price}
                                    </div>

                                    {/* Gold Dotted Divider */}
                                    <div className="my-1 border-b border-dotted" style={{ borderColor: `${goldPrimaryColor}99` }}></div>

                                    <p className="text-[7.5px] sm:text-[8.5px] font-medium leading-tight line-clamp-2 italic" style={{ color: `${goldTextColor}cc` }}>
                                      {dish.description}
                                    </p>
                                  </div>

                                  {/* Right: High-Contrast QR Code + SCAN TO ORDER Button */}
                                  <div className="shrink-0 flex flex-col items-center justify-center text-center">
                                    <div className="p-1 bg-white rounded-lg shadow-md border" style={{ borderColor: `${goldPrimaryColor}99` }}>
                                      <MiniQrCode 
                                        data={itemQrLink} 
                                        size={48} 
                                        dotsColor="#000000"
                                        dotsType={patternShape}
                                      />
                                    </div>
                                    <div 
                                      className="mt-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] border font-black text-[6.5px] uppercase tracking-wider shadow-xs whitespace-nowrap"
                                      style={{
                                        borderColor: goldPrimaryColor,
                                        color: goldTextColor,
                                      }}
                                    >
                                      SCAN TO ORDER
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* "INGIA KWENYE DUKA" Main CTA Card (Matching Bottom Banner) */}
                        <div 
                          className="relative border-2 rounded-2xl p-2.5 sm:p-3 my-2 flex items-center justify-between gap-2 shadow-[0_6px_25px_rgba(0,0,0,0.7)] relative z-10"
                          style={{
                            background: `linear-gradient(to right, ${goldCardBgColor}, #0a0602, ${goldCardBgColor})`,
                            borderColor: `${goldPrimaryColor}b3`,
                          }}
                        >
                          {/* Left: Store QR with chalk arrow */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="text-center">
                              <span className="text-[7px] font-serif italic block -rotate-6" style={{ color: goldTextColor }}>Scan hapa!</span>
                              <div className="text-xs" style={{ color: goldPrimaryColor }}>↷</div>
                            </div>
                            <div className="p-1 bg-white rounded-xl shadow-md border" style={{ borderColor: `${goldPrimaryColor}80` }}>
                              <MiniQrCode 
                                data={`${window.location.origin}/store/${vendorProfile?.id || ''}`} 
                                size={52} 
                                dotsColor="#000000"
                                dotsType={patternShape}
                              />
                            </div>
                          </div>

                          {/* Center: Title & Red Badge */}
                          <div className="flex-1 text-center min-w-0 px-1">
                            <h3 className="text-[10px] sm:text-xs font-black italic uppercase tracking-wider text-neutral-300 leading-none">
                              INGIA KWENYE
                            </h3>
                            <h2 
                              className="text-lg sm:text-xl font-black uppercase tracking-wider leading-tight text-transparent bg-clip-text"
                              style={{
                                backgroundImage: `linear-gradient(to bottom, #ffffff, ${goldTextColor}, ${goldPrimaryColor}, ${goldAccentColor})`
                              }}
                            >
                              DUKA
                            </h2>
                            <div className="inline-block px-2 py-0.5 rounded-full bg-red-600 text-white font-black text-[6.5px] uppercase tracking-widest shadow-xs">
                              CHANGANUA KWA SIMU YAKO
                            </div>
                            <p className="text-[6.5px] font-bold uppercase mt-0.5 truncate" style={{ color: `${goldTextColor}cc` }}>
                              FUNGUA DUKA KAMILI & PATA BIDHAA ZOTE!
                            </p>
                          </div>

                          {/* Right: Golden Easy Shopping Seal */}
                          <div className="shrink-0 flex flex-col items-center justify-center">
                            <div 
                              className="w-11 h-11 rounded-full border flex flex-col items-center justify-center shadow-md text-center p-1"
                              style={{
                                background: `linear-gradient(to bottom, #2b170c, #0a0502)`,
                                borderColor: goldAccentColor,
                              }}
                            >
                              <ShoppingCart className="w-4 h-4 mb-0.5" style={{ color: goldPrimaryColor }} />
                              <span className="text-[5.5px] font-black uppercase leading-none" style={{ color: goldTextColor }}>EASY</span>
                              <span className="text-[5px] font-bold uppercase leading-none" style={{ color: `${goldTextColor}cc` }}>SHOPPING</span>
                            </div>
                          </div>
                        </div>

                        {/* Guest WiFi Info Plaque (If enabled) */}
                        {showWifiOnStand && standWifiName && (
                          <div 
                            className="p-2 rounded-xl border flex items-center justify-between gap-2 relative z-10 my-1.5 shadow-sm"
                            style={{
                              background: `linear-gradient(to right, ${goldCardBgColor}cc, #0c0804cc)`,
                              borderColor: `${goldPrimaryColor}66`,
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <Wifi className="w-3.5 h-3.5" style={{ color: goldPrimaryColor }} />
                              <div>
                                <span className="text-[7px] font-black uppercase tracking-wider block" style={{ color: goldTextColor }}>GUEST WI-FI</span>
                                <span className="text-[8.5px] font-mono font-bold text-white leading-none">{standWifiName}</span>
                              </div>
                            </div>
                            {standWifiPass && (
                              <div className="text-right">
                                <span className="text-[6.5px] font-black text-neutral-400 uppercase tracking-widest block">PASSWORD</span>
                                <span className="text-[8px] font-mono font-bold text-amber-200">{standWifiPass}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Bottom 3 Metallic Widget Cards: Section, Seating, Highlights */}
                        <div className="grid grid-cols-3 gap-1.5 relative z-10 my-2">
                          {/* Card 1: Section / Meza */}
                          <div 
                            className="p-2 rounded-xl border text-center flex flex-col items-center justify-center shadow-sm"
                            style={{
                              background: `linear-gradient(to bottom, ${goldCardBgColor}e6, #120a04e6)`,
                              borderColor: `${goldPrimaryColor}80`,
                            }}
                          >
                            <div className="flex items-center justify-center gap-1 mb-0.5">
                              <Utensils className="w-3 h-3" style={{ color: goldPrimaryColor }} />
                              <span className="text-[7px] font-black uppercase tracking-wider" style={{ color: goldTextColor }}>SECTION</span>
                            </div>
                            <span className="text-sm font-black font-mono text-white">#{selectedSection?.number || '21'}</span>
                          </div>

                          {/* Card 2: Seating / Viti */}
                          <div 
                            className="p-2 rounded-xl border text-center flex flex-col items-center justify-center shadow-sm"
                            style={{
                              background: `linear-gradient(to bottom, ${goldCardBgColor}e6, #120a04e6)`,
                              borderColor: `${goldPrimaryColor}80`,
                            }}
                          >
                            <div className="flex items-center justify-center gap-1 mb-0.5">
                              <Users className="w-3 h-3" style={{ color: goldPrimaryColor }} />
                              <span className="text-[7px] font-black uppercase tracking-wider" style={{ color: goldTextColor }}>SEATING</span>
                            </div>
                            <span className="text-sm font-black text-white flex items-center justify-center gap-1">
                              <span>👥</span> {selectedSection?.capacity || '4'}
                            </span>
                          </div>

                          {/* Card 3: Maalumu Yetu / Checklist */}
                          <div 
                            className="p-2 rounded-xl border text-left flex flex-col justify-center shadow-sm"
                            style={{
                              background: `linear-gradient(to bottom, ${goldCardBgColor}e6, #120a04e6)`,
                              borderColor: `${goldPrimaryColor}80`,
                            }}
                          >
                            <span className="text-[6.5px] font-black uppercase tracking-wider text-center block mb-0.5" style={{ color: goldTextColor }}>MAALUMU YETU</span>
                            <div className="space-y-0.5 text-[6px] text-amber-100 font-medium">
                              <p className="truncate">☑ Ladha Halisi</p>
                              <p className="truncate">☑ Huduma Bora</p>
                              <p className="truncate">☑ Bei Fair</p>
                              <p className="truncate flex items-center gap-0.5">
                                <span>☑ Wateja wa Furahi</span>
                                <span className="text-[7px] text-red-500">❤️</span>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Gold Footer Bar with Official Vendor Portal & Contacts */}
                        <div 
                          className="relative z-10 pt-2 border-t flex items-center justify-between text-[6.5px] font-mono text-neutral-400"
                          style={{
                            borderColor: `${goldPrimaryColor}4d`,
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <Globe className="w-3 h-3" style={{ color: goldPrimaryColor }} />
                            <div>
                              <span className="block text-[5.5px] text-neutral-500 uppercase leading-none">OFFICIAL VENDOR PORTAL:</span>
                              <span className="font-bold uppercase leading-none" style={{ color: goldTextColor }}>{goldWebsiteUrl || 'WWW.AGIZA.CO.TZ'}</span>
                            </div>
                          </div>

                          {/* Central Mini Seal */}
                          <div className="flex flex-col items-center">
                            <div 
                              className="w-5 h-5 rounded-full border flex items-center justify-center"
                              style={{
                                borderColor: goldPrimaryColor,
                                background: '#000000',
                              }}
                            >
                              <Crown className="w-2.5 h-2.5" style={{ color: goldPrimaryColor }} />
                            </div>
                            <span className="text-[4.5px] font-black uppercase mt-0.5 tracking-tighter" style={{ color: goldTextColor }}>AGIZA.CO.TZ</span>
                          </div>

                          <div className="text-right">
                            <span className="block text-[5.5px] text-neutral-500 uppercase leading-none">SUPPORT: <span className="font-bold uppercase" style={{ color: goldTextColor }}>{goldSupportEmail || 'SUPPORT@AGIZA.CO.TZ'}</span></span>
                            <span className="block text-[5.5px] text-neutral-500 uppercase leading-none mt-0.5">SALES: <span className="font-bold text-amber-200">{goldSalesPhone || '+255 7XX XXX XXX'}</span></span>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}'''

start_ctrl = content.find('{/* Controls for Gold Menu Showcase */}')
end_ctrl = content.find('{/* Controls for Single Table Stand */}')

if start_ctrl == -1 or end_ctrl == -1:
    print(f"Could not find control markers: {start_ctrl}, {end_ctrl}")
    exit(1)

content = content[:start_ctrl] + new_controls_section + "\n\n                      " + content[end_ctrl:]

start_prev = content.find('{/* STAND YA MEZANI PREVIEW: LUXURY GOLD MENU SHOWCASE')
end_prev = content.find('{/* STAND YA MEZANI PREVIEW: SINGLE TABLE STAND')

if start_prev == -1 or end_prev == -1:
    print(f"Could not find preview markers: {start_prev}, {end_prev}")
    exit(1)

content = content[:start_prev] + new_preview_section + "\n\n                  " + content[end_prev:]

with open('src/components/VendorDashboard.tsx', 'w') as f:
    f.write(content)

print("Customizer updated successfully!")
