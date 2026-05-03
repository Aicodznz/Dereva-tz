import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Zap, Smartphone, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';

const steps = [
  {
    icon: Smartphone,
    title: 'Chagua Huduma',
    desc: 'Bofya duka au huduma unayohitaji kutoka kwenye list yetu ya washirika.',
    color: 'text-orange-500',
    bg: 'bg-orange-50'
  },
  {
    icon: CheckCircle2,
    title: 'Weka Oda',
    desc: 'Chagua bidhaa au huduma yako kisha thibitisha oda yako kwa urahisi.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50'
  },
  {
    icon: Zap,
    title: 'Subiri Lete',
    desc: 'Mshirika wetu atakufuata popote ulipo na kukupatia huduma yako haraka.',
    color: 'text-blue-500',
    bg: 'bg-blue-50'
  }
];

export default function HowToOrder() {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
          Simple & <span className="text-orange-600">Smart</span>
        </h2>
        <p className="text-neutral-500 font-medium text-sm">
          Mchanganuo wa <span className="text-orange-600 font-bold italic">Self-Service</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((step, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="p-6 rounded-[2rem] border-2 border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl shadow-neutral-900/5 hover:border-orange-500/20 transition-all group">
              <div className={`w-14 h-14 ${step.bg} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <step.icon className={`w-7 h-7 ${step.color}`} />
              </div>
              <h3 className="font-black text-lg text-neutral-900 dark:text-white mb-2">{step.title}</h3>
              <p className="text-sm text-neutral-500 font-medium leading-relaxed">{step.desc}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="bg-orange-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h4 className="text-xl font-black tracking-tight">Anza sasa na Papo Hapo</h4>
            <p className="text-orange-100 text-sm font-medium">Huduma bora, haraka na salama kwa kila mteja.</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white text-orange-600 px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-black/10"
          >
            Anza Hapa
          </motion.button>
        </div>
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -left-10 -top-10 w-40 h-40 bg-black/10 rounded-full blur-3xl" />
      </div>
    </div>
  );
}
