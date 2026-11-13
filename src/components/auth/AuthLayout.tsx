import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-4 pt-safe pb-safe scroll-touch relative">
      <Link 
        to="/" 
        className="absolute top-4 left-4 sm:top-8 sm:left-8 flex items-center gap-2 text-neutral-500 hover:text-orange-600 font-bold transition-colors group z-20"
      >
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all">
          <ArrowLeft className="w-5 h-5" />
        </div>
        <span className="hidden sm:inline">Rudi Nyumbani</span>
      </Link>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white px-5 py-2.5 rounded-2xl shadow-lg border border-orange-100 mb-4 flex items-center justify-center">
            <img
              src="/brand/logo-full.png"
              alt="Papo Hapo Super App"
              className="h-12 sm:h-14 w-auto object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white text-center">{title}</h1>
          {subtitle && <p className="text-neutral-500 dark:text-neutral-400 mt-2 text-center">{subtitle}</p>}
        </div>
        
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-neutral-100">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
