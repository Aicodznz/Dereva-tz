import React from 'react';
import { motion } from 'motion/react';
import { 
  QrCode, 
  Utensils, 
  ShoppingCart, 
  CreditCard, 
  Clock, 
  Star,
  CheckCircle2,
  Bell,
  ArrowRight
} from 'lucide-react';

const steps = [
  {
    number: 1,
    title: "SKANI & FUNGUA MENU",
    swahiliTitle: "SKANI & FUNGUA MENU",
    description: "Changanua QR code iliyopo mezani ili kuanza.",
    details: "Mteja anascan QR code yenye nembo ya duka kwenye stendi ya meza.",
    icon: QrCode,
    color: "bg-blue-500",
    shadowColor: "shadow-blue-200",
    highlights: ["Nembo ya Mkahawa", "Meza namba X", "Agiza kwa Changanuo"]
  },
  {
    number: 2,
    title: "CHAGUA NA WEKA SAWA",
    swahiliTitle: "CHAGUA NA WEKA SAWA",
    description: "Tazama menu na uchague chakula ukipendacho.",
    details: "Chagua chaguzi kama 'Pilipili zaidi' au 'Bila chumvi' (Customization).",
    icon: Utensils,
    color: "bg-red-500",
    shadowColor: "shadow-red-200",
    highlights: ["Picha bora za vyakula", "Customization Pop-up", "Ongeza Kwenye Kapu"]
  },
  {
    number: 3,
    title: "HAKIKI NA THIBITISHA",
    swahiliTitle: "HAKIKI NA THIBITISHA",
    description: "Kagua oda yako na muda wa kusubiri.",
    details: "Hakikisha kila kitu kipo sawa kabla ya kutuma oda jikoni.",
    icon: ShoppingCart,
    color: "bg-orange-500",
    shadowColor: "shadow-orange-200",
    highlights: ["Muda wa kusubiri: Dakika 15-20", "Summary ya kile ulichoagiza", "Thibitisha & Endelea"]
  },
  {
    number: 4,
    title: "CHAGUA JINSI YA KULIPA",
    swahiliTitle: "CHAGUA JINSI YA KULIPA",
    description: "Lipa sasa upate ofa au lipa baadae ukiwa umemaliza.",
    details: "Ofa! Lipa Sasa na upate kinywaji bure (M-Pesa, Tigo Pesa, n.k).",
    icon: CreditCard,
    color: "bg-green-500",
    shadowColor: "shadow-green-200",
    highlights: ["Lipa Sasa (Ofa!)", "Lipa Baadae (Tab)", "M-Pesa / Tigo Pesa"]
  },
  {
    number: 5,
    title: "FUATILIA ODA YAKO 'LIVE'",
    swahiliTitle: "FUATILIA ODA YAKO 'LIVE'",
    description: "Pata taarifa oda yako inavyoendelea jikoni.",
    details: "Tracker inakuonyesha hatua: 'Inaandaliwa Jikoni', 'Ipo Tayari'.",
    icon: Clock,
    color: "bg-yellow-500",
    shadowColor: "shadow-yellow-200",
    highlights: ["Live Progress Tracker", "Arifa za simu", "Kujua muda kamili"]
  },
  {
    number: 6,
    title: "TOA MAONI & PATA ZAWADI",
    swahiliTitle: "TOA MAONI & PATA ZAWADI",
    description: "Tuambie umeridhika na upate zawadi.",
    details: "Toa maoni na upewe pointi 50 kwa oda yako ijayo.",
    icon: Star,
    color: "bg-purple-500",
    shadowColor: "shadow-purple-200",
    highlights: ["5-star Rating system", "Ushuhuda wa mlo", "Pointi za zawadi"]
  }
];

export default function HowToOrder() {
  return (
    <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-2xl border border-neutral-100 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full -mr-32 -mt-32 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500/5 rounded-full -ml-32 -mb-32 blur-3xl" />

      <div className="relative z-10 space-y-12">
        <div className="text-center space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest"
          >
            <CheckCircle2 className="w-4 h-4" />
            Simple & Smart
          </motion.div>
          <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-neutral-900 leading-none">
            Mchanganuo wa <span className="text-orange-600">Self-Service</span>
          </h2>
          <p className="text-neutral-500 font-bold uppercase tracking-[0.2em] text-[10px] md:text-xs">
            Hatua kwa hatua jinsi ya kuanza kutumia Papo Hapo
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group relative bg-neutral-50 rounded-[2.5rem] p-8 border border-neutral-100 hover:border-orange-200 transition-all hover:shadow-2xl hover:shadow-orange-500/10"
            >
              {/* Step Number Badge */}
              <div className="absolute top-6 right-6 w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-lg font-black italic text-neutral-300 group-hover:text-orange-600 transition-colors">
                {step.number}
              </div>

              <div className="space-y-6">
                <div className={`w-16 h-16 rounded-3xl ${step.color} ${step.shadowColor} shadow-xl flex items-center justify-center text-white transform group-hover:rotate-6 transition-transform`}>
                  <step.icon className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-black italic uppercase tracking-tight text-neutral-900 leading-tight">
                    {step.title}
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium leading-relaxed">
                    {step.description}
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Highlights:</p>
                  <div className="flex flex-wrap gap-2">
                    {step.highlights.map((h, hi) => (
                      <span key={hi} className="px-3 py-1 bg-white border border-neutral-100 rounded-full text-[9px] font-bold text-neutral-600 group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-all">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Arrow to next step (for desktop layout) */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:flex absolute -right-6 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white rounded-full items-center justify-center shadow-lg text-orange-600 group-hover:translate-x-2 transition-transform">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Closing Panel with Interactive Vibe */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-neutral-900 rounded-[3rem] p-8 md:p-12 text-center space-y-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/20 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="relative z-10 space-y-6">
            <h3 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-white leading-none">
              Umejiandaa <span className="text-orange-600">Kuanza?</span>
            </h3>
            <p className="text-neutral-400 text-sm md:text-md max-w-2xl mx-auto font-medium">
              Mfumo wetu ni rahisi, wa haraka, na salama. Anza sasa kufurahia huduma ya kipekee ya Papo Hapo kwenye mkahawa wako uupendao.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-6 py-3 rounded-2xl text-white">
                <Bell className="w-5 h-5 text-orange-600" />
                <span className="text-xs font-black uppercase tracking-widest">Real-time alerts</span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-6 py-3 rounded-2xl text-white">
                <CreditCard className="w-5 h-5 text-orange-600" />
                <span className="text-xs font-black uppercase tracking-widest">Secure Payments</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
