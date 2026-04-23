import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, TrendingDown, Calendar, ArrowUpRight, 
  MapPin, Clock, DollarSign, Bike, Car
} from 'lucide-react';
import { motion } from 'motion/react';

const bookingData = [
  { name: 'Completed', value: 45, color: '#10b981' },
  { name: 'Pending', value: 15, color: '#f59e0b' },
  { name: 'Cancelled', value: 5, color: '#ef4444' },
];

const earningsData = [
  { day: 'Mon', amount: 12000 },
  { day: 'Tue', amount: 19000 },
  { day: 'Wed', amount: 15000 },
  { day: 'Thu', amount: 22000 },
  { day: 'Fri', amount: 30000 },
  { day: 'Sat', amount: 25000 },
  { day: 'Sun', amount: 18000 },
];

const performanceData = [
  { time: '08:00', distance: 2, hours: 0.5 },
  { time: '10:00', distance: 15, hours: 2.5 },
  { time: '12:00', distance: 25, hours: 4.5 },
  { time: '14:00', distance: 45, hours: 6.5 },
  { time: '16:00', distance: 60, hours: 8.5 },
  { time: '18:00', distance: 85, hours: 10.5 },
];

export default function RiderStats() {
  return (
    <div className="p-6 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
         <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-neutral-900 dark:text-white">Performance</h1>
            <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Real-time stats overview</p>
         </div>
         <motion.button 
          whileTap={{ scale: 0.95 }}
          className="p-3 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800"
         >
            <Calendar className="w-5 h-5 text-neutral-500" />
         </motion.button>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Booking Chart */}
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-neutral-900 overflow-hidden">
          <CardHeader className="p-6 pb-0">
             <CardTitle className="text-sm font-black uppercase italic tracking-tighter">Total Booking</CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex items-center justify-between">
             <div className="w-1/2 h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={bookingData}
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {bookingData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
             </div>
             <div className="w-1/2 space-y-3">
                {bookingData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider flex-1">{item.name}</span>
                    <span className="text-sm font-black italic">{item.value}%</span>
                  </div>
                ))}
             </div>
          </CardContent>
        </Card>

        {/* Total Earnings Card */}
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-emerald-600 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
             <DollarSign className="w-24 h-24" />
          </div>
          <CardHeader className="p-8 pb-0">
             <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Total Earnings</p>
             <div className="flex items-baseline gap-2">
                <h2 className="text-4xl font-black italic uppercase tracking-tighter">TZS 3.2M</h2>
                <div className="flex items-center text-xs font-bold gap-0.5 bg-white/20 px-2 py-0.5 rounded-full">
                  <ArrowUpRight className="w-3 h-3" />
                  <span>12%</span>
                </div>
             </div>
          </CardHeader>
          <CardContent className="p-8 h-[120px]">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={earningsData}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fff" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="amount" stroke="#fff" fillOpacity={1} fill="url(#colorAmount)" strokeWidth={3} />
                </AreaChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Drive Performance Charts */}
      <h3 className="text-lg font-black uppercase italic tracking-tighter mt-8">Drive Performance</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Distance Performance */}
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-neutral-900 overflow-hidden">
          <CardHeader className="p-6 pb-2">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                   <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                      <Bike className="w-4 h-4 text-blue-500" />
                   </div>
                   <CardTitle className="text-sm font-black uppercase italic tracking-tighter">Distance</CardTitle>
                </div>
                <div className="text-right">
                   <p className="text-xl font-black italic">85 km</p>
                   <p className="text-[8px] font-black uppercase text-emerald-500 flex items-center justify-end gap-0.5">
                      <TrendingUp className="w-2 h-2" /> 2% Higher
                   </p>
                </div>
             </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 h-[150px]">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={performanceData}>
                 <Area type="monotone" dataKey="distance" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={3} />
               </AreaChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hours Performance */}
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-neutral-900 overflow-hidden">
          <CardHeader className="p-6 pb-2">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                   <div className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                      <Clock className="w-4 h-4 text-orange-500" />
                   </div>
                   <CardTitle className="text-sm font-black uppercase italic tracking-tighter">Hours</CardTitle>
                </div>
                <div className="text-right">
                   <p className="text-xl font-black italic">10.5 hrs</p>
                   <p className="text-[8px] font-black uppercase text-red-500 flex items-center justify-end gap-0.5">
                      <TrendingDown className="w-2 h-2" /> 1% Lower
                   </p>
                </div>
             </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 h-[150px]">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={performanceData}>
                 <Area type="monotone" dataKey="hours" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeWidth={3} />
               </AreaChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats Overview */}
      <div className="bg-neutral-100 dark:bg-neutral-900/50 rounded-[2rem] p-6 grid grid-cols-2 gap-4">
        {[
          { label: "Active Minutes", value: "482", color: "text-emerald-500" },
          { label: "Total Trips", value: "65", color: "text-blue-500" },
          { label: "Top Rated", value: "4.9", color: "text-orange-500" },
          { label: "Revenue Share", value: "85%", color: "text-purple-500" }
        ].map((item, idx) => (
          <div key={idx} className="bg-white dark:bg-neutral-900 p-4 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm border border-neutral-100 dark:border-neutral-800">
             <p className="text-[8px] font-black uppercase text-neutral-400 tracking-widest mb-1">{item.label}</p>
             <h4 className={`text-lg font-black italic uppercase tracking-tighter ${item.color}`}>{item.value}</h4>
          </div>
        ))}
      </div>
    </div>
  );
}
