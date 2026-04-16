import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, deleteDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { VendorProfile } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Check, X, ShieldAlert, Store, UserCheck, Image as ImageIcon, 
  Bell, Plus, Trash2, Send, LayoutDashboard, Megaphone
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface Banner {
  id?: string;
  title: string;
  sub: string;
  img: string;
  active: boolean;
}

type AdminTab = 'vendors' | 'banners' | 'notifications';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('vendors');
  const [pendingVendors, setPendingVendors] = useState<VendorProfile[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isAddBannerOpen, setIsAddBannerOpen] = useState(false);
  const [newBanner, setNewBanner] = useState<Banner>({ title: '', sub: '', img: '', active: true });
  
  // Notification State
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'vendors'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingVendors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'vendors');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'banners'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBanners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'banners');
    });
    return () => unsubscribe();
  }, []);

  const handleApprove = async (id: string) => {
    const vendorRef = doc(db, 'vendors', id);
    try {
      await updateDoc(vendorRef, { status: 'active' });
      toast.success('Vendor approved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vendors/${id}`);
    }
  };

  const handleReject = async (id: string) => {
    const vendorRef = doc(db, 'vendors', id);
    try {
      await updateDoc(vendorRef, { status: 'suspended' });
      toast.error('Vendor rejected.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vendors/${id}`);
    }
  };

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'banners'), {
        ...newBanner,
        createdAt: serverTimestamp()
      });
      setIsAddBannerOpen(false);
      setNewBanner({ title: '', sub: '', img: '', active: true });
      toast.success('Banner added successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'banners');
    }
  };

  const handleDeleteBanner = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'banners', id));
      toast.success('Banner deleted.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `banners/${id}`);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle || !notifBody) return;
    setIsSending(true);
    try {
      // Get all users
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch = usersSnap.docs.map(userDoc => {
        return addDoc(collection(db, 'notifications'), {
          title: notifTitle,
          body: notifBody,
          userId: userDoc.id,
          type: 'system',
          isRead: false,
          createdAt: serverTimestamp()
        });
      });
      await Promise.all(batch);
      setNotifTitle('');
      setNotifBody('');
      toast.success(`Notification sent to ${usersSnap.size} users!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Super Admin Panel</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-neutral-500">Platform-wide management and oversight.</p>
              <span className="text-neutral-300">•</span>
              <Link to="/profile" className="text-sm text-orange-600 font-medium hover:underline">
                Switch Role
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex gap-2 p-1 bg-neutral-100 rounded-2xl w-fit">
        {[
          { id: 'vendors', label: 'Vendors', icon: Store },
          { id: 'banners', label: 'Banners', icon: ImageIcon },
          { id: 'notifications', label: 'Broadcast', icon: Megaphone },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as AdminTab)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-orange-600 shadow-sm' 
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'vendors' && (
          <motion.div
            key="vendors"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                  <Store className="h-4 w-4 text-neutral-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingVendors.length}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Vendor Applications</CardTitle>
                <CardDescription>Review and manage new business applications.</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingVendors.length === 0 ? (
                  <div className="text-center py-12 text-neutral-500">
                    No pending applications.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingVendors.map((vendor) => (
                      <div key={vendor.id} className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center font-bold text-neutral-400">
                            {vendor.businessName[0]}
                          </div>
                          <div>
                            <h3 className="font-bold text-neutral-900">{vendor.businessName}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="capitalize">{vendor.category}</Badge>
                              <span className="text-xs text-neutral-500">TIN: {vendor.tin}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleReject(vendor.id!)}>
                            <X className="w-4 h-4 mr-1" /> Reject
                          </Button>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(vendor.id!)}>
                            <Check className="w-4 h-4 mr-1" /> Approve
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === 'banners' && (
          <motion.div
            key="banners"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Manage Banners</h2>
              <Button onClick={() => setIsAddBannerOpen(true)} className="bg-orange-600 hover:bg-orange-700 gap-2">
                <Plus className="w-4 h-4" /> Add Banner
              </Button>
            </div>

            {isAddBannerOpen && (
              <Card className="border-orange-200 bg-orange-50/30">
                <CardHeader>
                  <CardTitle className="text-lg">New Promotional Banner</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddBanner} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-neutral-500">Title</label>
                      <Input 
                        required 
                        placeholder="e.g. 50% OFF Chakula" 
                        value={newBanner.title} 
                        onChange={e => setNewBanner({...newBanner, title: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-neutral-500">Subtitle</label>
                      <Input 
                        required 
                        placeholder="e.g. Order from your favorite restaurants" 
                        value={newBanner.sub} 
                        onChange={e => setNewBanner({...newBanner, sub: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold uppercase text-neutral-500">Image URL</label>
                      <Input 
                        required 
                        placeholder="https://images.unsplash.com/..." 
                        value={newBanner.img} 
                        onChange={e => setNewBanner({...newBanner, img: e.target.value})}
                      />
                    </div>
                    <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                      <Button type="button" variant="ghost" onClick={() => setIsAddBannerOpen(false)}>Cancel</Button>
                      <Button type="submit" className="bg-orange-600 hover:bg-orange-700">Save Banner</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {banners.map((banner) => (
                <Card key={banner.id} className="overflow-hidden group">
                  <div className="h-40 relative">
                    <img src={banner.img} alt={banner.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-4 text-white">
                      <h3 className="font-bold text-lg">{banner.title}</h3>
                      <p className="text-xs opacity-80">{banner.sub}</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteBanner(banner.id!)}
                      className="absolute top-2 right-2 p-2 bg-white/90 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 hover:text-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              ))}
              {banners.length === 0 && (
                <div className="md:col-span-2 py-20 text-center border-2 border-dashed border-neutral-200 rounded-3xl text-neutral-400">
                  No active banners. Add one to show on the home screen.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'notifications' && (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-2xl mx-auto"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-orange-600" />
                  Broadcast Notification
                </CardTitle>
                <CardDescription>Send a push-style notification to all registered users.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendNotification} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700">Notification Title</label>
                    <Input 
                      required 
                      placeholder="e.g. Karibu Kwenye Papo Hapo!" 
                      value={notifTitle}
                      onChange={e => setNotifTitle(e.target.value)}
                      className="h-12 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700">Message Body</label>
                    <Textarea 
                      required 
                      placeholder="Write your message here..." 
                      value={notifBody}
                      onChange={e => setNotifBody(e.target.value)}
                      className="min-h-[120px] rounded-xl resize-none"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isSending}
                    className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-lg font-bold rounded-2xl shadow-lg shadow-orange-200 gap-2"
                  >
                    {isSending ? (
                      <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" /> Send to All Users
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
