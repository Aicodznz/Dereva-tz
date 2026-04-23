import React from 'react';
import AuthLayout from './AuthLayout';
import { ShoppingBag, Truck, Store, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../../AuthContext';
import { useEffect } from 'react';

export default function RegisterChoice() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const options = [
    {
      title: "I'm a Customer",
      subtitle: "Mimi ni Mteja",
      icon: ShoppingBag,
      color: "bg-blue-50 text-blue-600",
      path: "/register/customer"
    },
    {
      title: "I'm a Driver",
      subtitle: "Mimi ni Dereva",
      icon: Truck,
      color: "bg-green-50 text-green-600",
      path: "/register/driver"
    },
    {
      title: "I'm a Vendor",
      subtitle: "Mimi ni Muuzaji",
      icon: Store,
      color: "bg-orange-50 text-orange-600",
      path: "/register/vendor"
    }
  ];

  return (
    <AuthLayout 
      title="Join Us!" 
      subtitle="How would you like to register? / Ungependa kujisajili kama nani?"
    >
      <div className="space-y-4">
        {options.map((opt, i) => (
          <motion.div
            key={opt.path}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Link 
              to={opt.path}
              className="flex items-center p-6 rounded-[2rem] border-2 border-neutral-100 dark:border-neutral-800 hover:border-orange-500 hover:bg-orange-50/10 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-orange-500/5 blur-3xl rounded-full" />
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mr-5 shadow-xl transition-transform group-hover:scale-110 ${opt.color}`}>
                <opt.icon className="w-10 h-10" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter text-xl">{opt.title}</h3>
                <p className="text-sm text-neutral-500 font-medium leading-none mt-1">{opt.subtitle}</p>
              </div>
              <div className="w-10 h-10 rounded-full border border-neutral-100 dark:border-neutral-800 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-all">
                <ArrowRight className="w-5 h-5" />
              </div>
            </Link>
          </motion.div>
        ))}

        <p className="text-center text-sm text-neutral-600 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-orange-600 font-bold hover:underline">
            Sign in / Ingia
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
