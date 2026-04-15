import React from 'react';
import { motion } from 'motion/react';
import { Store } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <Store className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900">{title}</h1>
          {subtitle && <p className="text-neutral-500 mt-2">{subtitle}</p>}
        </div>
        
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-neutral-100">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
