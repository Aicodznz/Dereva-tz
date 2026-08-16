import re

with open('src/components/VendorDashboard.tsx', 'r') as f:
    content = f.read()

# Replace the circular crest in preview
crest_target = """{/* Center Crest: Circular Seal */}
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
                          </div>"""

crest_replacement = """{/* Center Crest / Vendor Logo: Circular Seal */}
                          <div className="flex flex-col items-center justify-center -mt-1 relative z-30">
                            {showGoldLogo && (goldLogoUrl || vendorProfile?.logoUrl) ? (
                              <div 
                                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center relative p-1 border-2 shadow-xl overflow-hidden group bg-black/70"
                                style={{
                                  borderColor: goldPrimaryColor,
                                  boxShadow: `0 0 20px ${goldAccentColor}80, inset 0 0 12px rgba(0,0,0,0.8)`,
                                }}
                              >
                                <img 
                                  src={goldLogoUrl || vendorProfile?.logoUrl || ''} 
                                  alt="Logo" 
                                  className="w-full h-full object-contain rounded-full drop-shadow-md"
                                />
                                <div 
                                  className="absolute inset-0 rounded-full pointer-events-none border"
                                  style={{ borderColor: `${goldPrimaryColor}4d` }}
                                ></div>
                              </div>
                            ) : (
                              <div 
                                className="w-13 h-13 sm:w-14 sm:h-14 rounded-full flex flex-col items-center justify-center relative p-1 border-2 shadow-lg"
                                style={{
                                  background: `linear-gradient(to bottom, ${goldBgColorStart}, #0d0905, ${goldCardBgColor})`,
                                  borderColor: goldPrimaryColor,
                                  boxShadow: `0 0 16px ${goldAccentColor}66`,
                                }}
                              >
                                <div className="text-[5.5px] font-black uppercase tracking-widest text-center leading-none" style={{ color: goldTextColor }}>
                                  {vendorProfile?.businessName?.slice(0, 10) || 'RESTAURANT'}
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
                            )}
                          </div>"""

if crest_target in content:
    content = content.replace(crest_target, crest_replacement)
    print("Replaced crest preview successfully!")
else:
    print("Crest target not found exactly, let's search with regex")
    # regex fallback
    content = re.sub(
        r'\{\/\* Center Crest: Circular Seal \*\/\}[\s\S]*?\{\/\* Right Hanging Sign: Karibu Sana \*\/\}',
        crest_replacement + '\n\n                          {/* Right Hanging Sign: Karibu Sana */}',
        content
    )
    print("Replaced crest via regex!")

# Now add Logo management control in the Gold Menu Showcase controls section (above Header & Branding Settings)
logo_control_block = """{/* LOGO YA DUKA / MGAHAWA (STORE LOGO CUSTOMIZER) */}
                          <div className="space-y-3.5 p-4 bg-gradient-to-br from-neutral-900/90 to-neutral-950 border border-amber-500/30 rounded-2xl shadow-md">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-amber-300 uppercase tracking-[0.18em] flex items-center gap-1.5">
                                <ImageIcon className="w-3.5 h-3.5 text-amber-400" /> Nembo ya Duka / Logo ya Mgahawa (Top Logo)
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] text-neutral-400 font-bold uppercase">
                                  {showGoldLogo ? 'Inaonekana' : 'Imezimwa'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowGoldLogo(!showGoldLogo)}
                                  className={`w-9 h-5 rounded-full transition-all relative flex items-center px-0.5 cursor-pointer ${showGoldLogo ? 'bg-amber-500' : 'bg-neutral-800'}`}
                                >
                                  <div className={`w-4 h-4 bg-white rounded-full transition-all shadow-xs ${showGoldLogo ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </button>
                              </div>
                            </div>

                            {/* Current Logo Preview & Actions */}
                            <div className="flex items-center gap-3 p-3 bg-black/50 rounded-xl border border-white/5">
                              <div className="w-14 h-14 rounded-full border-2 border-amber-500/40 bg-neutral-950 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                                {(goldLogoUrl || vendorProfile?.logoUrl) ? (
                                  <img 
                                    src={goldLogoUrl || vendorProfile?.logoUrl} 
                                    alt="Logo Preview" 
                                    className="w-full h-full object-contain rounded-full"
                                  />
                                ) : (
                                  <div className="text-center">
                                    <Utensils className="w-4 h-4 text-amber-400 mx-auto" />
                                    <span className="text-[6px] text-neutral-400 uppercase block font-bold">Crest</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0 space-y-1.5">
                                <p className="text-[9.5px] font-black text-white uppercase truncate">
                                  {(goldLogoUrl || vendorProfile?.logoUrl) ? 'Nembo ya Mgahawa Wako Imewekwa' : 'Inatumia Nembo ya Dhahabu (Default Crest)'}
                                </p>
                                
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Upload Button */}
                                  <label className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-black text-[8.5px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-sm">
                                    <Upload className="w-3 h-3 text-black" />
                                    {isGoldLogoUploading ? 'Inapakia...' : 'Pakia Logo Mpya'}
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      className="hidden" 
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          setIsGoldLogoUploading(true);
                                          const reader = new FileReader();
                                          reader.onload = (ev) => {
                                            const res = ev.target?.result as string;
                                            setGoldLogoUrl(res);
                                            setShowGoldLogo(true);
                                            setIsGoldLogoUploading(false);
                                            toast.success('Logo imewekwa kwenye bango!');
                                          };
                                          reader.onerror = () => {
                                            setIsGoldLogoUploading(false);
                                            toast.error('Imeshindwa kusoma picha');
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                  </label>

                                  {/* Use Store Profile Logo */}
                                  {vendorProfile?.logoUrl && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setGoldLogoUrl(vendorProfile.logoUrl || '');
                                        setShowGoldLogo(true);
                                        toast.success('Nembo ya wasifu wa duka imewekwa!');
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-200 font-bold text-[8.5px] uppercase tracking-wider transition-all cursor-pointer"
                                    >
                                      Logo ya Wasifu
                                    </button>
                                  )}

                                  {/* Reset / Remove Logo */}
                                  {(goldLogoUrl || vendorProfile?.logoUrl) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setGoldLogoUrl('');
                                        setShowGoldLogo(false);
                                        toast.success('Nembo imeondolewa, inatumia muhuri wa dhahabu!');
                                      }}
                                      className="px-2 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 font-bold text-[8.5px] uppercase tracking-wider transition-all cursor-pointer"
                                    >
                                      Ondoa
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Image URL Input */}
                            <div className="space-y-1">
                              <span className="text-[7.5px] font-black text-neutral-400 uppercase tracking-widest block">Au Weka Kiungo cha Logo (Logo Image URL)</span>
                              <Input 
                                value={goldLogoUrl || vendorProfile?.logoUrl || ''}
                                onChange={(e) => {
                                  setGoldLogoUrl(e.target.value);
                                  setShowGoldLogo(true);
                                }}
                                placeholder="https://..."
                                className="bg-black/60 border-white/10 h-9 rounded-xl text-neutral-300 text-xs font-mono"
                              />
                            </div>
                          </div>"""

# Insert logo_control_block right above {/* 3. Banner Header & Branding Settings */}
header_anchor = "{/* 3. Banner Header & Branding Settings */}"
if header_anchor in content and "Nembo ya Duka / Logo ya Mgahawa (Top Logo)" not in content:
    content = content.replace(header_anchor, logo_control_block + "\n\n                          " + header_anchor)
    print("Added logo control block!")

with open('src/components/VendorDashboard.tsx', 'w') as f:
    f.write(content)
