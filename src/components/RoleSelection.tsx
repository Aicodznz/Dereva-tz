import React from 'react';
import { useAuth } from '../AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Store, Bike, Shield } from 'lucide-react';

export default function RoleSelection() {
  const { updateRole, profile } = useAuth();

  const roles = [
    { id: 'customer', title: 'Customer', description: 'Order food, groceries, and more.', icon: ShoppingBag, color: 'bg-blue-100 text-blue-600' },
    { id: 'vendor', title: 'Vendor', description: 'Sell products or services on the platform.', icon: Store, color: 'bg-green-100 text-green-600' },
    { id: 'rider', title: 'Rider', description: 'Deliver parcels and transport people.', icon: Bike, color: 'bg-orange-100 text-orange-600' },
  ];

  if (profile?.role === 'admin') {
    roles.push({ id: 'admin', title: 'Super Admin', description: 'Manage the entire platform.', icon: Shield, color: 'bg-red-100 text-red-600' });
  }

  return (
    <div className="max-w-4xl mx-auto py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-neutral-900 mb-4">Choose Your Role</h1>
        <p className="text-neutral-600">Select how you want to use OmniServe today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {roles.map((role) => (
          <Card key={role.id} className={`cursor-pointer transition-all hover:shadow-lg ${profile?.role === role.id ? 'ring-2 ring-orange-600' : ''}`}>
            <CardHeader>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${role.color}`}>
                <role.icon className="w-6 h-6" />
              </div>
              <CardTitle>{role.title}</CardTitle>
              <CardDescription>{role.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant={profile?.role === role.id ? 'default' : 'outline'} 
                className="w-full"
                onClick={() => updateRole(role.id as any)}
              >
                {profile?.role === role.id ? 'Active Role' : `Switch to ${role.title}`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
