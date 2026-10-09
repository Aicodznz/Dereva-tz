import React, { useState } from 'react';
import { 
  X, 
  GraduationCap, 
  Coins, 
  CreditCard, 
  Smartphone, 
  Baby, 
  ShieldCheck, 
  PhoneCall, 
  CheckCircle2, 
  Bell, 
  Sparkles,
  QrCode,
  HeartHandshake,
  AlertTriangle,
  Send,
  PlusCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface DaladalaStudentFareModalProps {
  onClose: () => void;
}

export default function DaladalaStudentFareModal({ onClose }: DaladalaStudentFareModalProps) {
  const [activeTab, setActiveTab] = useState<'methods' | 'simulator' | 'rights'>('methods');

  // Simulator state
  const [parentBalance, setParentBalance] = useState<number>(4800);
  const [studentTaps, setStudentTaps] = useState<
    Array<{ id: string; time: string; vehiclePlate: string; route: string; fare: number }>
  >([
    {
      id: '1',
      time: 'Leo 06:45 Asubuhi',
      vehiclePlate: 'T 842 DFM',
      route: 'Kimara ➔ Kariakoo',
      fare: 200,
    },
  ]);
  const [lastNotification, setLastNotification] = useState<string | null>(
    'PapoDaladala SMS: Mtoto Amina Juma amepanda basi T 842 DFM (Kimara ➔ Kariakoo). Nauli TSh 200 imekatwa.'
  );

  const handleSimulateTap = () => {
    if (parentBalance < 200) {
      toast.error('Salio la mzazi halitoshi! Tafadhali jaza salio kwanza.');
      return;
    }

    const newBalance = parentBalance - 200;
    setParentBalance(newBalance);

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const newTap = {
      id: Date.now().toString(),
      time: `Leo ${timeStr}`,
      vehiclePlate: 'T 315 BKD',
      route: 'Posta ➔ Mwenge',
      fare: 200,
    };

    setStudentTaps([newTap, ...studentTaps]);

    const sms = `🔔 SMS KWA MZAZI: Mtoto Amina Juma amegusa kadi ya mwanafunzi na kupanda daladala T 315 BKD (Posta ➔ Mwenge) saa ${timeStr}. Nauli TSh 200 imelipwa. Salio lililobaki: TSh ${newBalance.toLocaleString()}.`;
    setLastNotification(sms);

    // Audio feedback if supported
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch beep
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.18);
    } catch (e) {}

    toast.success('Kadi ya Mwanafunzi Imesomwa! TSh 200 Imelipwa & SMS Imetumwa kwa Mzazi.');
  };

  const handleTopUp = () => {
    setParentBalance((prev) => prev + 2000);
    toast.success('Salio la TSh 2,000 limeongezwa kutoka M-Pesa ya Mzazi!');
  };

  return (
    <div className="fixed inset-0 z-[600] bg-neutral-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-2xl p-5 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-neutral-900 dark:text-white">
                  Nauli za Wanafunzi & Watoto Bila Simujanja
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-[10px] uppercase">
                  TSh 200 Rasmi LATRA
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Jinsi wanafunzi na watoto wadogo wanavyosafiri na kulipa bila kuhitaji simu janja
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800/80 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('methods')}
            className={`py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'methods'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs font-black'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            }`}
          >
            <Coins className="w-4 h-4 text-emerald-600" />
            <span>Njia 4 za Kulipa</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className={`py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'simulator'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs font-black'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            }`}
          >
            <CreditCard className="w-4 h-4 text-blue-600" />
            <span>Kadi & NFC ya Shule</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rights')}
            className={`py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'rights'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs font-black'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Haki za Wanafunzi</span>
          </button>
        </div>

        {/* TAB 1: 4 WAYS STUDENTS & KIDS PAY WITHOUT SMARTPHONES */}
        {activeTab === 'methods' && (
          <div className="space-y-3.5">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 text-xs">
              <strong>Jibu la Msingi:</strong> Mwanafunzi hahitaji simujanja hata kidogo ili kupanda daladala. Mfumo wa usafiri wa Tanzania na PapoDaladala umeundwa ukizingatia uhalisia huu kupitia njia hizi kuu 4:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Method 1: Cash Coin TSh 200 */}
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
                    🪙
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-neutral-900 dark:text-white">
                      1. Sarafu Taslimu ya TSh 200
                    </h4>
                    <span className="text-[10px] text-neutral-500">Njia ya Asili na ya Haraka</span>
                  </div>
                </div>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  Mwanafunzi akiwa kwenye sare ya shule (uniform) humkabidhi kondakta sarafu ya Shilingi mia mbili (TSh 200) mkononi. Kwenye skrini ya kondakta kuna kitufe maalum cha haraka cha <strong>&ldquo;200 (Mwnz)&rdquo;</strong> kinachomruhusu kupokea na kutoa chenji papo hapo.
                </p>
              </div>

              {/* Method 2: Student Smart Card / NFC Tap */}
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
                    💳
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-neutral-900 dark:text-white">
                      2. Kadi ya Plastiki ya NFC (Tap &amp; Go)
                    </h4>
                    <span className="text-[10px] text-neutral-500">Bila Simu Wala Internet kwa Mtoto</span>
                  </div>
                </div>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  Mtoto anapewa kadi ndogo ya plastiki (au kibandiko/beji kwenye kitambulisho cha shule). Mtoto anapoingia mlangoni, <strong>anagusa kadi nyuma ya simu ya konda (NFC Tap)</strong>. Kondakta anasikia &ldquo;beep&rdquo; na nauli ya TSh 200 inakatwa moja kwa moja bila mtoto kuwa na simu.
                </p>
              </div>

              {/* Method 3: Parent Mobile Money Wallet & SMS Alert */}
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black">
                    📲
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-neutral-900 dark:text-white">
                      3. Pochi ya Mzazi (Parent Wallet &amp; SMS)
                    </h4>
                    <span className="text-[10px] text-neutral-500">M-Pesa / Tigo Pesa / Airtel Money</span>
                  </div>
                </div>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  Mzazi ndiye anayejaza salio (mfano TSh 5,000 au 10,000) kutoka kwenye simu yake. Mtoto akigusa kadi yake kwenye daladala, <strong>mzazi anapokea ujumbe mfupi wa SMS papo hapo</strong> ukimtaarifu namba ya gari alilopanda mtoto na muda alioingia!
                </p>
              </div>

              {/* Method 4: Under 5 Toddlers / Kids Free */}
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-black">
                    👶
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-neutral-900 dark:text-white">
                      4. Watoto Chini ya Miaka 5 (Chekechea)
                    </h4>
                    <span className="text-[10px] text-neutral-500">Usafiri wa Bure Kabisa</span>
                  </div>
                </div>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  Kwa mwongozo wa LATRA na mila ya usafiri wa umma nchini Tanzania, watoto wadogo chini ya miaka 4 hadi 5 wanaosafiri wakiwa wamebebwa mapajani na wazazi/walezi <strong>hawahesabiwi nauli (Bure)</strong>. Hawatozwi ada yoyote.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-between text-xs">
              <span className="text-neutral-600 dark:text-neutral-400">
                Unataka kuona jinsi kadi ya mwanafunzi inavyoguswa kwa konda?
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('simulator')}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition"
              >
                Jaribu Kiigaji cha Kadi ➔
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: INTERACTIVE STUDENT NFC & PARENT WALLET SIMULATOR */}
        {activeTab === 'simulator' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Student Physical ID Card Representation */}
              <div className="rounded-3xl p-4 bg-gradient-to-tr from-emerald-700 via-teal-800 to-emerald-950 text-white shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-6 h-6 text-amber-300" />
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-wider">KADI YA MWANAFUNZI</h4>
                      <p className="text-[10px] text-emerald-200">Jamhuri ya Muungano wa Tanzania</p>
                    </div>
                  </div>
                  <div className="px-2 py-0.5 rounded-lg bg-black/30 border border-white/20 text-[10px] font-mono font-bold">
                    NFC ENABLED
                  </div>
                </div>

                <div className="my-2 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-2xl font-black">
                    🎒
                  </div>
                  <div>
                    <h5 className="font-black text-sm">Amina Juma Mohamed</h5>
                    <p className="text-[11px] text-emerald-100">Kidato cha 2 • Shule ya Sekondari Jangwani</p>
                    <p className="text-[10px] text-emerald-300 font-mono mt-0.5">ID: TZ-STD-2026-8941</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/20 text-xs">
                  <div>
                    <span className="text-[10px] text-emerald-200 block">Nauli ya Kisheria</span>
                    <strong className="text-amber-300 font-black font-mono">TSh 200 Flat</strong>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-200 bg-white/10 px-2.5 py-1 rounded-xl">
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Scan / Tap to Pay</span>
                  </div>
                </div>
              </div>

              {/* Parent Mobile Wallet Box */}
              <div className="p-4 rounded-3xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-black text-neutral-800 dark:text-neutral-200">
                      Pochi ya Mzazi (Simu ya Nyumbani)
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-500 font-semibold">M-Pesa / Tigo Pesa</span>
                </div>

                <div>
                  <span className="text-[11px] text-neutral-500 font-semibold block">Salio la Nauli ya Mtoto:</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      TSh {parentBalance.toLocaleString()}
                    </span>
                    <span className="text-xs text-neutral-400">
                      (~Safari {Math.floor(parentBalance / 200)} zilizobaki)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTopUp}
                    className="flex-1 py-2 px-3 rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 text-neutral-800 dark:text-neutral-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Ongeza TSh 2,000</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSimulateTap}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Gusa Kadi (Tap TSh 200)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Live Parent Notification Simulation */}
            {lastNotification && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 space-y-1">
                <div className="flex items-center gap-2 font-black text-xs text-amber-800 dark:text-amber-400">
                  <Bell className="w-3.5 h-3.5 animate-bounce" />
                  <span>Ujumbe wa SMS Uliopokelewa Kwenye Simu ya Mzazi:</span>
                </div>
                <p className="text-[11px] font-mono leading-relaxed bg-white/70 dark:bg-black/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900">
                  {lastNotification}
                </p>
              </div>
            )}

            {/* Trip logs */}
            <div className="space-y-2">
              <h5 className="font-extrabold text-xs text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Historia ya Safari za Mtoto (Muda &amp; Namba ya Gari):</span>
              </h5>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {studentTaps.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 font-bold text-neutral-900 dark:text-white">
                        <span className="tz-number-plate text-[10px] py-0 px-1.5">
                          <span className="tz-strip">TZ</span>
                          <span>{item.vehiclePlate}</span>
                        </span>
                        <span>{item.route}</span>
                      </div>
                      <span className="text-[10px] text-neutral-400">{item.time}</span>
                    </div>
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                      -TSh {item.fare}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LATRA LAWS & STUDENT TRANSPORT RIGHTS */}
        {activeTab === 'rights' && (
          <div className="space-y-3.5">
            <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 text-xs space-y-1">
              <div className="flex items-center gap-2 font-black">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Mwongozo wa Kisheria wa Mamlaka ya LATRA (GN No. 416):</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                Wanafunzi wa shule za msingi na sekondari wana haki ya kisheria kutumia usafiri wa umma bila kubaguliwa wala kudhalilishwa.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-neutral-900 dark:text-white block">1. Nauli ya TSh 200 ya Kudumu</strong>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5">
                    Mwanafunzi yeyote aliyevaa sare ya shule analipa TSh 200 pekee bila kujali umbali wa ruti (hata ruti za TSh 800 au TSh 1,000 kama Mbagala hadi Tegeta).
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-neutral-900 dark:text-white block">2. Marufuku ya Kukataa Wanafunzi Vituoni</strong>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5">
                    Dereva au kondakta haruhusiwi kukimbiza basi au kufunga mlango makusudi ili kuzuia wanafunzi kupanda kwa kisingizio cha nauli ndogo. Ni kosa linalofutiwa leseni ya LATRA.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-neutral-900 dark:text-white block">3. Marufuku ya Kushusha Wanafunzi Porini</strong>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5">
                    Kondakta haruhusiwi kumshusha mwanafunzi kabla ya kituo chake rasmi kwa sababu yoyote ile ya uhaba wa chenji au kutoa nafasi kwa abiria wa fedha nyingi.
                  </p>
                </div>
              </div>
            </div>

            {/* Emergency Hotline Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <a
                href="tel:0800110020"
                className="p-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs flex items-center justify-between shadow-md transition"
              >
                <div className="flex items-center gap-2">
                  <PhoneCall className="w-4 h-4" />
                  <span>Ripoti LATRA (Toll-Free)</span>
                </div>
                <span className="font-mono bg-white/20 px-2 py-0.5 rounded">0800 110 020</span>
              </a>

              <a
                href="tel:116"
                className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center justify-between shadow-md transition"
              >
                <div className="flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4" />
                  <span>Dawati la Watoto &amp; Jinsia</span>
                </div>
                <span className="font-mono bg-white/20 px-2 py-0.5 rounded">Piga 116</span>
              </a>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <span className="text-[11px] text-neutral-400 font-medium">
            PapoDaladala Inamlinda Mwanafunzi &amp; Kumpa Amani Mzazi
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-extrabold text-xs transition"
          >
            Funga Dirisha
          </button>
        </div>

      </div>
    </div>
  );
}
