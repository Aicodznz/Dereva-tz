import React from 'react';
import { useAuth } from '../AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Store, Bike, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RoleSelection() {
  const { updateRole, profile } = useAuth();
  const navigate = useNavigate();

  const roles = [
    { id: 'customer', title: 'Customer / Mteja', description: 'Order food, groceries, rides and more.', icon: ShoppingBag, color: 'bg-blue-100 text-blue-600' },
    { id: 'vendor', title: 'Vendor / Muuzaji', description: 'Sell products or services on the platform.', icon: Store, color: 'bg-green-100 text-green-600' },
    { id: 'rider', title: 'Rider & Driver / Dereva', description: 'Deliver parcels and transport passengers.', icon: Bike, color: 'bg-orange-100 text-orange-600' },
  ];

  if (profile?.role === 'admin') {
    roles.push({ id: 'admin', title: 'Super Admin', description: 'Manage the entire platform.', icon: Shield, color: 'bg-red-100 text-red-600' });
  }

  const handleSelectRole = async (roleId: string) => {
    await updateRole(roleId as any);
    navigate('/');
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-black text-neutral-900 dark:text-white uppercase italic tracking-tight mb-2">Chagua Aina ya Akaunti</h1>
        <p className="text-neutral-500 font-medium">Chagua jinsi unavyotaka kutumia Papo Hapo leo.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {roles.map((role) => (
          <Card key={role.id} className={`cursor-pointer transition-all hover:shadow-lg border-2 ${profile?.role === role.id || (role.id === 'rider' && profile?.role === 'driver') ? 'border-orange-600 shadow-xl' : 'border-transparent'}`}>
            <CardHeader>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${role.color}`}>
                <role.icon className="w-6 h-6" />
              </div>
              <CardTitle className="font-black text-lg uppercase italic tracking-tight">{role.title}</CardTitle>
              <CardDescription className="text-xs">
                {role.id === 'customer' ? 'Agiza chakula, vipeto, teksi na bidhaa.' : 
                 role.id === 'vendor' ? 'Uza bidhaa au huduma zako sokoni.' : 
                 role.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant={profile?.role === role.id || (role.id === 'rider' && profile?.role === 'driver') ? 'default' : 'outline'} 
                className={`w-full font-bold uppercase text-xs tracking-wider rounded-2xl h-11 ${profile?.role === role.id ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                onClick={() => handleSelectRole(role.id)}
              >
                {profile?.role === role.id || (role.id === 'rider' && profile?.role === 'driver') ? 'Inatumika Sasa' : `Badili Kuwa ${role.title}`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
