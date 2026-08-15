import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Box, Camera, Sparkles, Check, Upload, RefreshCw, 
  Layers, ArrowRight, Smartphone, Zap, Eye, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { storageService } from '../services/storageService';
import { generate3DFoodModelUrl } from '../services/food3DGenerator';

interface PapoFood3DStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect3DModel: (modelUrl: string) => void;
  vendorId?: string;
  productName?: string;
  initialModelUrl?: string;
}

// Curated High Quality 3D Food Asset Presets
export const PRESET_3D_FOODS = [
  {
    id: 'burger-special',
    name: 'Burger & Sandwich / Special Dish',
    category: 'fastfood',
    dishType: 'burger' as const,
    icon: '🍔',
    previewImage: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
    description: 'Aina zote za Burger, Shawarma na Sandwich zenye nyama na jibini.'
  },
  {
    id: 'pizza-slice',
    name: 'Pizza & Fast Food / Pepperoni Pizza',
    category: 'fastfood',
    dishType: 'pizza' as const,
    icon: '🍕',
    previewImage: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
    description: 'Pizza nzima au slice yenye mozzarella na pepperoni.'
  },
  {
    id: 'chips-chicken',
    name: 'Chips Kuku / Fried Chicken & Fries',
    category: 'fastfood',
    dishType: 'plate_meal' as const,
    icon: '🍗',
    previewImage: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=400&q=80',
    description: 'Sahani ya Chips Kuku, Chips Mayai, au Kuku wa kukaanga.'
  },
  {
    id: 'rice-fish',
    name: 'Wali Samaki & Pilau / Rice & Stew',
    category: 'local',
    dishType: 'plate_meal' as const,
    icon: '🍛',
    previewImage: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
    description: 'Wali Samaki, Pilau, Biryani, Wali Maharage au Ugali.'
  },
  {
    id: 'cake-dessert',
    name: 'Keki & Vitafunwa / Dessert Cake',
    category: 'dessert',
    dishType: 'cake' as const,
    icon: '🎂',
    previewImage: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=400&q=80',
    description: 'Keki za sherehe, keki za vipande, vitafunwa na dessert.'
  },
  {
    id: 'grill-mishkaki',
    name: 'Nyama Choma & Mishkaki / BBQ Platter',
    category: 'grill',
    dishType: 'grill' as const,
    icon: '🥩',
    previewImage: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=400&q=80',
    description: 'Mishkaki ya nyama au kuku, kuku choma na BBQ.'
  },
  {
    id: 'soup-bowl',
    name: 'Supu & Mchuzi / Soup & Stew Bowl',
    category: 'soup',
    dishType: 'soup' as const,
    icon: '🍲',
    previewImage: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=400&q=80',
    description: 'Supu ya kongoro, samaki, kuku wa kienyeji au mboga.'
  },
  {
    id: 'soft-drinks',
    name: 'Soda, Juice & Vinywaji / Drinks',
    category: 'drinks',
    dishType: 'drink' as const,
    icon: '🥤',
    previewImage: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80',
    description: 'Juice safi, Soda, Kahawa, Cocktail na Maji baridi.'
  }
];

export const PapoFood3DStudioModal: React.FC<PapoFood3DStudioModalProps> = ({
  isOpen,
  onClose,
  onSelect3DModel,
  vendorId = 'vendor',
  productName = 'Chakula',
  initialModelUrl = ''
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'ai-scanner' | 'custom'>('presets');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESET_3D_FOODS[0].id);
  const [presetModelsCache, setPresetModelsCache] = useState<Record<string, string>>({});
  const [isLoadingPresetModel, setIsLoadingPresetModel] = useState<boolean>(false);
  
  // AI Scanner state
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiStepText, setAiStepText] = useState('');
  const [generatedModelUrl, setGeneratedModelUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom upload state
  const [customUrl, setCustomUrl] = useState(initialModelUrl);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Generate 3D model for the selected preset on demand
  useEffect(() => {
    if (!isOpen) return;

    const currentPreset = PRESET_3D_FOODS.find(p => p.id === selectedPresetId);
    if (!currentPreset) return;

    if (presetModelsCache[selectedPresetId]) return;

    let isMounted = true;
    setIsLoadingPresetModel(true);

    generate3DFoodModelUrl({
      productName: currentPreset.name,
      category: currentPreset.category,
      dishType: currentPreset.dishType,
      photoDataUrls: [currentPreset.previewImage],
    })
      .then(res => {
        if (isMounted) {
          setPresetModelsCache(prev => ({ ...prev, [selectedPresetId]: res.url }));
          setIsLoadingPresetModel(false);
        }
      })
      .catch(err => {
        console.error('Failed to generate preset 3D model:', err);
        if (isMounted) setIsLoadingPresetModel(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPresetId, isOpen, presetModelsCache]);

  if (!isOpen) return null;

  // Handle image capture or selection for AI Scanner
  const handleCaptureImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    fileList.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCapturedImages(prev => [...prev.slice(-2), event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Run AI 2D-to-3D Reconstruction Pipeline with Three.js & GLTFExporter
  const runAi3DGenerator = async () => {
    if (capturedImages.length === 0) {
      toast.error('Tafadhali piga au chagua angalau picha 1 ya chakula chako.');
      return;
    }

    setIsAiProcessing(true);
    setAiProgress(15);
    setAiStepText('1/4: Inachanganua picha na kutambua muundo wa chakula...');

    try {
      await new Promise(r => setTimeout(r, 800));
      setAiProgress(40);
      setAiStepText('2/4: Inatengeneza 3D Mesh Geometry & Sahani...');

      await new Promise(r => setTimeout(r, 700));
      setAiProgress(70);
      setAiStepText('3/4: Inaweka PBR Photogrammetry Texture & Mwanga wa 3D...');

      // Generate authentic 3D food model from the captured photos
      const generated = await generate3DFoodModelUrl({
        productName: productName || 'Chakula Maalum',
        photoDataUrls: capturedImages,
        dishType: 'auto',
      });

      await new Promise(r => setTimeout(r, 600));
      setAiProgress(90);
      setAiStepText('4/4: Inakamilisha na ku-export faili la .GLB...');

      // Upload to Firebase storage in background if available
      try {
        const file = new File([generated.blob], `ai_food_${Date.now()}.glb`, { type: 'model/gltf-binary' });
        const path = storageService.getProductPath(vendorId, '3d_studio', file.name);
        const remoteUrl = await storageService.uploadFile('products', path, file);
        setGeneratedModelUrl(remoteUrl);
      } catch {
        // Fallback to local blob URL for instant preview
        setGeneratedModelUrl(generated.url);
      }

      setAiProgress(100);
      toast.success('🎉 3D Model ya chakula chako imetengenezwa kikamilifu!');
    } catch (err) {
      console.error('AI 3D generation error:', err);
      toast.error('Imeshindwa kutengeneza 3D model. Tafadhali jaribu tena.');
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Handle custom file upload
  const handleGlbFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.glb') && !file.name.toLowerCase().endsWith('.gltf')) {
      toast.error('Tafadhali chagua faili lenye format ya .glb au .gltf');
      return;
    }

    setIsUploadingFile(true);
    setUploadProgress(10);

    try {
      const path = storageService.getProductPath(vendorId, '3d_studio', `model_${Date.now()}.glb`);
      const url = await storageService.uploadFile('products', path, file, (progress) => {
        setUploadProgress(progress);
      });
      setCustomUrl(url);
      toast.success('Faili la 3D lilipakiwa vyema!');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error('Imeshindwa kupakia faili: ' + err.message);
    } finally {
      setIsUploadingFile(false);
      setUploadProgress(0);
    }
  };

  const handleApplyModel = (modelUrl: string) => {
    if (!modelUrl) {
      toast.error('Tafadhali chagua au tengeneza 3D model kwanza.');
      return;
    }
    onSelect3DModel(modelUrl);
    toast.success('3D AR Model imeunganishwa kwenye bidhaa hii!');
    onClose();
  };

  const activePreset = PRESET_3D_FOODS.find(p => p.id === selectedPresetId);
  const activePresetModelUrl = presetModelsCache[selectedPresetId];

  return (
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl text-white my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-orange-950/60 via-neutral-900 to-amber-950/40 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-tr from-orange-600 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-600/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                PapoFood 3D Studio <span className="bg-orange-600/30 text-orange-400 border border-orange-500/40 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Direct AI</span>
              </h2>
              <p className="text-xs text-neutral-400">Tengeneza au chagua mfano halisi wa 3D wa sahani yako kwa ajili ya Wateja</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-full flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/60 p-2 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'presets'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Box className="w-4 h-4" />
            <span>Maktaba ya Vyakula (Presets)</span>
          </button>

          <button
            onClick={() => setActiveTab('ai-scanner')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'ai-scanner'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Camera className="w-4 h-4 text-amber-400" />
            <span>AI Studio Generator</span>
          </button>

          <button
            onClick={() => setActiveTab('custom')}
            className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'custom'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Link / Upload</span>
          </button>
        </div>

        {/* Modal Content Area */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: PRESET 3D FOODS */}
          {activeTab === 'presets' && (
            <div className="space-y-4">
              <div className="bg-orange-600/10 border border-orange-500/20 rounded-2xl p-3.5 flex items-start gap-3">
                <Zap className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Chagua mfano wa 3D unaolingana na chakula chako. Kagua muundo halisi wa sahani kwenye kioo cha 3D kisha bonyeza <strong>"Unganisha 3D Model Hii"</strong>.
                </p>
              </div>

              {/* Live 3D Preview Box for Presets */}
              {activePreset && (
                <div className="bg-neutral-950 border-2 border-orange-500/40 rounded-2xl p-3.5 space-y-3 relative overflow-hidden shadow-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-orange-400">
                      <Eye className="w-4 h-4 animate-pulse" />
                      <h4 className="font-extrabold text-xs uppercase tracking-wider">3D Live Preview: {activePreset.name}</h4>
                    </div>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                      .GLB 360° Ready
                    </span>
                  </div>

                  <div className="h-56 sm:h-64 w-full bg-gradient-to-b from-neutral-900 to-black rounded-xl border border-neutral-800 relative overflow-hidden flex items-center justify-center">
                    {isLoadingPresetModel ? (
                      <div className="flex flex-col items-center gap-2 text-neutral-400 text-xs">
                        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                        <span>Inatengeneza mfano halisi wa 3D...</span>
                      </div>
                    ) : activePresetModelUrl ? (
                      <>
                        {/* @ts-ignore */}
                        <model-viewer
                          src={activePresetModelUrl}
                          camera-controls
                          auto-rotate
                          shadow-intensity="1.5"
                          exposure="1"
                          loading="eager"
                          reveal="auto"
                          className="w-full h-full"
                          style={{ width: '100%', height: '100%', backgroundColor: '#09090b' }}
                        >
                          <div slot="poster" className="w-full h-full flex items-center justify-center bg-neutral-900 text-neutral-400 text-xs font-bold">
                            Inapakia 3D Model...
                          </div>
                        {/* @ts-ignore */}
                        </model-viewer>
                        <div className="absolute bottom-2 left-2 right-2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center justify-between text-[10px] text-neutral-300">
                          <span>👆 Gusa ufungue / zungushe 360°</span>
                          <span className="text-orange-400 font-bold">Zoom: Vidole 2</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-neutral-400 text-xs font-bold">Inaandaa 3D Model...</div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                    <button
                      onClick={() => activePresetModelUrl && handleApplyModel(activePresetModelUrl)}
                      disabled={!activePresetModelUrl}
                      className="w-full sm:flex-1 py-3 bg-gradient-to-r from-orange-600 to-amber-500 hover:brightness-110 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>✅ Mfano Unapendeza, Unganisha Sasa</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESET_3D_FOODS.map((item) => {
                  const isSelected = selectedPresetId === item.id;
                  return (
                    <div 
                      key={item.id}
                      onClick={() => setSelectedPresetId(item.id)}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 relative overflow-hidden group ${
                        isSelected 
                          ? 'border-orange-500 bg-orange-600/10 shadow-lg shadow-orange-600/10' 
                          : 'border-neutral-800 bg-neutral-950/80 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-neutral-700 bg-neutral-900 relative">
                          <img src={item.previewImage} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          <span className="absolute top-1 left-1 text-base">{item.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-white truncate">{item.name}</h4>
                          <p className="text-[11px] text-neutral-400 leading-tight mt-1 line-clamp-2">{item.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80 mt-auto">
                        <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full uppercase">
                          .GLB 3D Food
                        </span>
                        {isSelected && (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-extrabold">
                            <Check className="w-3.5 h-3.5" /> Inakaguliwa
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: DIRECT AI 2D-TO-3D GENERATOR */}
          {activeTab === 'ai-scanner' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-amber-950/40 to-neutral-900 p-4 rounded-2xl border border-amber-500/30">
                <h3 className="font-black text-sm text-amber-400 uppercase tracking-wide flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  AI Photogrammetry Studio Direct
                </h3>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Piga au chagua picha za sahani yako halisi (Ngazi ya meza & Juu). Mfumo wetu wa AI utatengeneza mfano halisi wa 3D wa sahani yako wenye muundo na picha yako moja kwa moja (.glb)!
                </p>
              </div>

              {/* Photo Input Area */}
              <div className="space-y-3">
                <label className="text-xs font-extrabold text-neutral-300 uppercase tracking-wider block">
                  1. Piga / Chagua Picha Za Sahani (1 - 3 Photos)
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {capturedImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-amber-500/50 group shadow-md">
                      <img src={img} alt={`Capture ${idx + 1}`} className="w-full h-full object-cover" />
                      <button 
                        onClick={() => setCapturedImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white text-xs shadow-md hover:bg-red-700 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <span className="absolute bottom-1.5 left-1.5 bg-black/70 backdrop-blur-md text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                        Picha #{idx + 1}
                      </span>
                    </div>
                  ))}

                  {capturedImages.length < 3 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-2xl border-2 border-dashed border-neutral-700 hover:border-amber-500 bg-neutral-950/60 hover:bg-amber-500/10 flex flex-col items-center justify-center p-3 gap-1.5 text-neutral-400 hover:text-amber-400 transition-all cursor-pointer"
                    >
                      <Camera className="w-6 h-6" />
                      <span className="text-[10px] font-extrabold uppercase text-center">Piga / Chagua Picha</span>
                    </button>
                  )}
                </div>

                <input 
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  multiple
                  onChange={handleCaptureImage}
                  className="hidden"
                />
              </div>

              {/* AI Processing Status Card */}
              {isAiProcessing && (
                <div className="bg-neutral-950 p-5 rounded-2xl border border-amber-500/40 space-y-3 text-center">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto text-amber-400 animate-bounce">
                    <Sparkles className="w-6 h-6 animate-spin" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white">{aiStepText}</h4>
                    <p className="text-xs text-neutral-400 mt-1">AI Direct Studio inachakata muundo na muonekano wa 3D...</p>
                  </div>

                  <div className="w-full bg-neutral-800 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-orange-500 to-amber-400 h-full transition-all duration-500 rounded-full"
                      style={{ width: `${aiProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-extrabold text-amber-400">{aiProgress}% Imekamilika</p>
                </div>
              )}

              {/* Generated Result Preview */}
              {generatedModelUrl && !isAiProcessing && (
                <div className="bg-neutral-950 border-2 border-emerald-500/50 p-4 rounded-2xl space-y-3 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5 shrink-0 animate-pulse" />
                      <h4 className="font-extrabold text-xs uppercase tracking-wider">3D AI Model Live Preview</h4>
                    </div>
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                      Interactive 360°
                    </span>
                  </div>

                  <p className="text-xs text-neutral-300">
                    Mfumo wa AI umetengeneza 3D Model ya chakula chako kutokana na picha ulizoweka. Zungusha na kagua kama iko vizuri kabla ya kuiweka kwa wateja:
                  </p>

                  <div className="h-56 sm:h-64 w-full bg-gradient-to-b from-neutral-900 to-black rounded-xl border border-neutral-800 relative overflow-hidden">
                    {/* @ts-ignore */}
                    <model-viewer
                      src={generatedModelUrl}
                      camera-controls
                      auto-rotate
                      shadow-intensity="1.5"
                      exposure="1"
                      loading="eager"
                      reveal="auto"
                      className="w-full h-full"
                      style={{ width: '100%', height: '100%', backgroundColor: '#09090b' }}
                    >
                      <div slot="poster" className="w-full h-full flex items-center justify-center bg-neutral-900 text-neutral-400 text-xs font-bold">
                        Inapakia AI 3D Model...
                      </div>
                    {/* @ts-ignore */}
                    </model-viewer>
                    <div className="absolute bottom-2 left-2 right-2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center justify-between text-[10px] text-neutral-300">
                      <span>👆 Gusa ufungue / zungushe 360°</span>
                      <span className="text-amber-400 font-bold">Zoom: Vidole 2</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                    <button
                      onClick={() => handleApplyModel(generatedModelUrl)}
                      className="w-full sm:flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:brightness-110 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>✅ Mfano Unapendeza, Unganisha Sasa</span>
                    </button>

                    <button
                      onClick={() => {
                        setGeneratedModelUrl('');
                        setCapturedImages([]);
                        toast.info('Piga au chagua picha mpya kutengeneza tena.');
                      }}
                      className="w-full sm:w-auto px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-neutral-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <RefreshCw className="w-4 h-4 text-amber-400" />
                      <span>Haiko Vizuri? Tengeneza Tena</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Generate Trigger Button */}
              {!generatedModelUrl && !isAiProcessing && (
                <button
                  onClick={runAi3DGenerator}
                  disabled={capturedImages.length === 0}
                  className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${
                    capturedImages.length > 0
                      ? 'bg-gradient-to-r from-orange-600 to-amber-500 hover:brightness-110 text-white shadow-orange-600/30 cursor-pointer'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                  <span>2. Tengeneza 3D Model Sasa (AI Generation)</span>
                </button>
              )}
            </div>
          )}

          {/* TAB 3: CUSTOM UPLOAD OR URL PASTE */}
          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800 space-y-3">
                <label className="text-xs font-extrabold text-neutral-300 uppercase tracking-wider block">
                  Weka Direct 3D Model URL (.glb)
                </label>
                <input 
                  type="url"
                  placeholder="https://example.com/models/food.glb"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="relative text-center my-2">
                <span className="bg-neutral-900 px-3 text-[10px] text-neutral-500 uppercase font-extrabold">AU PAKUA FAILI LAKO</span>
              </div>

              <div className="bg-neutral-950 p-5 rounded-2xl border-2 border-dashed border-neutral-800 hover:border-orange-500 transition-all text-center space-y-3">
                <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center mx-auto text-orange-500 border border-neutral-800">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-white">Pakua Faili la .GLB Kutoka Kwenye Simu / Kompyuta</h4>
                  <p className="text-[11px] text-neutral-400 mt-1">Inasaidia faili za .glb na .gltf</p>
                </div>

                <input 
                  type="file"
                  id="direct-glb-input"
                  accept=".glb,.gltf"
                  onChange={handleGlbFileUpload}
                  className="hidden"
                />

                <button
                  onClick={() => document.getElementById('direct-glb-input')?.click()}
                  disabled={isUploadingFile}
                  className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-extrabold transition-all border border-neutral-700 cursor-pointer"
                >
                  {isUploadingFile ? `Inapakia... ${Math.round(uploadProgress)}%` : 'Chagua Faili la .GLB'}
                </button>
              </div>

              {customUrl && (
                <div className="bg-neutral-950 border-2 border-orange-500/50 p-4 rounded-2xl space-y-3 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-orange-400">
                      <Eye className="w-4 h-4 animate-pulse" />
                      <h4 className="font-extrabold text-xs uppercase tracking-wider">3D Uploaded Live Preview</h4>
                    </div>
                    <span className="text-[10px] text-orange-400 bg-orange-500/10 border border-orange-500/30 px-2 py-0.5 rounded-full font-bold">
                      Interactive 360°
                    </span>
                  </div>

                  <div className="h-56 sm:h-64 w-full bg-gradient-to-b from-neutral-900 to-black rounded-xl border border-neutral-800 relative overflow-hidden">
                    {/* @ts-ignore */}
                    <model-viewer
                      src={customUrl}
                      camera-controls
                      auto-rotate
                      shadow-intensity="1.5"
                      exposure="1"
                      loading="eager"
                      reveal="auto"
                      className="w-full h-full"
                      style={{ width: '100%', height: '100%', backgroundColor: '#09090b' }}
                    >
                      <div slot="poster" className="w-full h-full flex items-center justify-center bg-neutral-900 text-neutral-400 text-xs font-bold">
                        Inapakia 3D Model...
                      </div>
                    {/* @ts-ignore */}
                    </model-viewer>
                    <div className="absolute bottom-2 left-2 right-2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center justify-between text-[10px] text-neutral-300">
                      <span>👆 Gusa ufungue / zungushe 360°</span>
                      <span className="text-orange-400 font-bold">Zoom: Vidole 2</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleApplyModel(customUrl)}
                    className="w-full py-3.5 bg-gradient-to-r from-orange-600 to-amber-500 hover:brightness-110 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <Check className="w-5 h-5" />
                    <span>✅ Hifadhi & Unganisha 3D Model</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
