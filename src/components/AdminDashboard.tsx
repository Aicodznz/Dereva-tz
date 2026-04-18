import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, deleteDoc, getDocs, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { VendorProfile, Order, Product } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Check, X, ShieldAlert, Store, UserCheck, Image as ImageIcon, 
  Bell, Plus, Trash2, Send, LayoutDashboard, Megaphone,
  Users, ShoppingBag, DollarSign, MessageCircle, AlertTriangle,
  ExternalLink, Search, Ban, History, BarChart3
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

interface UserRecord {
  id: string;
  displayName: string;
  email: string;
  role: string;
  phone?: string;
  status: 'active' | 'blocked';
  createdAt: any;
}

interface ProductWithVendor extends Product {
  vendorName?: string;
}

type AdminTab = 'overview' | 'vendors' | 'products' | 'users' | 'orders' | 'banners' | 'notifications' | 'coupons';

interface Coupon {
  id?: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  active: boolean;
  vendorId?: string | null;
  productId?: string | null;
  validUntil?: any;
  createdBy: string;
  createdAt?: any;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserRecord[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [allProducts, setAllProducts] = useState<ProductWithVendor[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [isAddBannerOpen, setIsAddBannerOpen] = useState(false);
  const [isAddCouponOpen, setIsAddCouponOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  
  const [newCoupon, setNewCoupon] = useState<Partial<Coupon>>({
    code: '',
    discountType: 'percentage',
    discountValue: 0,
    active: true,
    vendorId: null,
    productId: null
  });
  const [newBanner, setNewBanner] = useState<Banner>({ title: '', sub: '', img: '', active: true });
  
  // Notification State
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Stats / Finances (Mongike 3.5% fee estimated)
  const stats = useMemo(() => {
    const totalRev = allOrders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.totalAmount, 0);
    const platformFee = totalRev * 0.10; // Assuming 10% platform commission
    const mongikeFees = totalRev * 0.035; // Assuming 3.5% PG fee
    return {
      totalRev,
      platformFee,
      mongikeFees,
      netProfit: platformFee - mongikeFees,
      totalOrders: allOrders.length,
      activeVendors: vendors.filter(v => v.status === 'active').length,
      totalUsers: allUsers.length
    };
  }, [allOrders, vendors, allUsers]);

  useEffect(() => {
    const unsubVendors = onSnapshot(collection(db, 'vendors'), (snapshot) => {
      setVendors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorProfile)));
    });
    
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserRecord)));
    });
    
    const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      setAllOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });

    const unsubBanners = onSnapshot(collection(db, 'banners'), (snapshot) => {
      setBanners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner)));
    });

    const unsubCoupons = onSnapshot(collection(db, 'coupons'), (snapshot) => {
      setCoupons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon)));
    });

    const unsubProducts = onSnapshot(query(collection(db, 'products')), (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setAllProducts(prods);
    });

    return () => {
      unsubVendors();
      unsubUsers();
      unsubOrders();
      unsubProducts();
      unsubBanners();
      unsubCoupons();
    };
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, 'vendors', id), { status: 'active' });
      toast.success('Vendor approved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vendors/${id}`);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await updateDoc(doc(db, 'vendors', id), { status: 'suspended' });
      toast.error('Vendor status updated to suspended.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vendors/${id}`);
    }
  };

  const handleBlockUser = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    try {
      await updateDoc(doc(db, 'users', id), { status: newStatus });
      toast.success(`User ${newStatus === 'blocked' ? 'blocked' : 'unblocked'}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${id}`);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user forever?')) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      toast.success('User deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
    }
  };

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'banners'), { ...newBanner, createdAt: serverTimestamp() });
      setIsAddBannerOpen(false);
      setNewBanner({ title: '', sub: '', img: '', active: true });
      toast.success('Banner added successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'banners');
    }
  };

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'coupons'), { ...newCoupon, createdBy: 'admin', createdAt: serverTimestamp() });
      setIsAddCouponOpen(false);
      setNewCoupon({ code: '', discountType: 'percentage', discountValue: 0, active: true, vendorId: null, productId: null });
      toast.success('Coupon added successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'coupons');
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle || !notifBody) return;
    setIsSending(true);
    try {
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

  const filteredUsers = allUsers.filter(u => 
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVendors = vendors.filter(v => 
    v.businessName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    v.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-32 max-w-7xl mx-auto px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-red-600 text-white rounded-[2rem] shadow-lg shadow-red-200">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-neutral-900 tracking-tighter uppercase italic">Control Panel</h1>
            <p className="text-neutral-500 font-medium">Platform-wide management & financial oversight.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/profile">
            <Button variant="outline" className="rounded-2xl border-neutral-200 font-bold">Switch Profile</Button>
          </Link>
          <div className="bg-neutral-900 text-white px-4 py-2 rounded-2xl flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest">Admin Live</span>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-neutral-100 rounded-[2rem] w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'vendors', label: 'Businesses', icon: Store },
          { id: 'products', label: 'Products', icon: ShoppingBag },
          { id: 'users', label: 'Communities', icon: Users },
          { id: 'orders', label: 'Sales Feed', icon: ShoppingBag },
          { id: 'banners', label: 'Marketing', icon: Megaphone },
          { id: 'notifications', label: 'Broadcast', icon: Bell },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as AdminTab)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-tight transition-all ${
              activeTab === tab.id 
                ? 'bg-neutral-900 text-white shadow-xl shadow-neutral-200' 
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            <Card className="bg-neutral-900 text-white rounded-[2.5rem] border-none shadow-2xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <DollarSign className="w-24 h-24" />
              </div>
              <CardHeader>
                <CardTitle className="text-neutral-400 text-xs font-black uppercase tracking-[0.2rem]">Gross Volume</CardTitle>
                <div className="text-3xl font-black mt-2">TZS {stats.totalRev.toLocaleString()}</div>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-500 text-[10px] font-bold uppercase">Total processed via Mongike</p>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-teal-50 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-24 h-24 text-teal-600" />
              </div>
              <CardHeader>
                <CardTitle className="text-teal-600/60 text-xs font-black uppercase tracking-[0.2rem]">Est. Commission</CardTitle>
                <div className="text-3xl font-black text-teal-900 mt-2">TZS {stats.platformFee.toLocaleString()}</div>
              </CardHeader>
              <CardContent>
                <p className="text-teal-600/50 text-[10px] font-bold uppercase">Target revenue (10%)</p>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-red-50 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <ShieldAlert className="w-24 h-24 text-red-600" />
              </div>
              <CardHeader>
                <CardTitle className="text-red-400 text-xs font-black uppercase tracking-[0.2rem]">Calculated Fees</CardTitle>
                <div className="text-3xl font-black text-red-900 mt-2">- TZS {stats.mongikeFees.toLocaleString()}</div>
              </CardHeader>
              <CardContent>
                <p className="text-red-400 text-[10px] font-bold uppercase">Mongike Gateway Costs (3.5%)</p>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-orange-600 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <LayoutDashboard className="w-24 h-24" />
              </div>
              <CardHeader>
                <CardTitle className="text-white/60 text-xs font-black uppercase tracking-[0.2rem]">Total Sales</CardTitle>
                <div className="text-3xl font-black mt-2">{stats.totalOrders}</div>
              </CardHeader>
              <CardContent>
                <p className="text-white/40 text-[10px] font-bold uppercase">Successful conversions</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === 'products' && (
          <motion.div key="products" className="space-y-6">
             <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter">Inventory Oversight</h3>
                <div className="relative w-64">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                   <Input 
                     placeholder="Search products..." 
                     className="pl-10 h-10 rounded-xl"
                     value={searchQuery}
                     onChange={e => setSearchQuery(e.target.value)}
                   />
                </div>
             </div>
             <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                   <table className="w-full">
                      <thead className="bg-neutral-50">
                        <tr className="text-left">
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Product</th>
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Vendor</th>
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Price (Gross)</th>
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Net (Est)</th>
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                         {allProducts.filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(product => {
                            const currentVendor = vendors.find(v => v.id === product.vendorId);
                           const mongikeFee = product.price * 0.035;
                           const platformCommission = product.price * 0.10;
                           const netToVendor = product.price - platformCommission;
                           
                           return (
                             <tr key={product.id}>
                                <td className="px-8 py-6">
                                   <div className="flex items-center gap-4">
                                      <img src={product.imageUrl || "https://picsum.photos/seed/food/100"} className="w-12 h-12 rounded-xl object-cover" />
                                      <span className="font-bold">{product.name}</span>
                                   </div>
                                </td>
                                <td className="px-8 py-6">
                                   <div className="flex items-center gap-2">
                                      {currentVendor?.logoUrl && <img src={currentVendor.logoUrl} className="w-6 h-6 rounded-lg object-cover" />}
                                      <span className="text-xs font-bold text-neutral-600">
                                         {currentVendor?.businessName || 'Unknown Vendor'}
                                      </span>
                                   </div>
                                </td>
                                <td className="px-8 py-6 font-bold">TZS {product.price.toLocaleString()}</td>
                                <td className="px-8 py-6">
                                   <div className="space-y-1 text-[10px] font-bold">
                                      <p className="text-neutral-400">Gateway Fee: -{mongikeFee.toLocaleString()}</p>
                                      <p className="text-orange-600 italic tracking-tighter uppercase">Platform Net (10%): -{platformCommission.toLocaleString()}</p>
                                      <p className="text-teal-600 font-black text-xs">Vendor Gets: TZS {netToVendor.toLocaleString()}</p>
                                   </div>
                                </td>
                                <td className="px-8 py-6 text-right">
                                   <div className="flex justify-end gap-2">
                                      <Button 
                                        variant="outline"
                                        size="sm"
                                        className={`rounded-xl font-bold text-[10px] ${product.status === 'out_of_stock' ? 'border-red-200 text-red-500' : 'border-green-200 text-green-500'}`}
                                        onClick={async () => {
                                          const newStatus = product.status === 'active' ? 'out_of_stock' : 'active';
                                          await updateDoc(doc(db, 'products', product.id!), { status: newStatus });
                                        }}
                                      >
                                        {product.status === 'active' ? 'Deactivate' : 'Activate'}
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => deleteDoc(doc(db, 'products', product.id!))}
                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                                      >
                                         <Trash2 className="w-5 h-5" />
                                      </Button>
                                   </div>
                                </td>
                             </tr>
                           );
                         })}
                      </tbody>
                   </table>
                </div>
             </Card>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div key="users" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <Input 
                  placeholder="Search members by name or email..." 
                  className="pl-12 h-14 rounded-2xl border-none bg-neutral-100 font-bold"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-4 text-xs font-bold text-neutral-500 uppercase">
                <span>Total Members: <span className="text-neutral-900">{allUsers.length}</span></span>
              </div>
            </div>

            <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50">
                    <tr className="text-left">
                      <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-neutral-400">Identity</th>
                      <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-neutral-400">Role</th>
                      <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-neutral-400">Status</th>
                      <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-neutral-400 text-right">Interactions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredUsers.map(user => (
                      <tr key={user.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center font-black text-orange-600">
                              {user.displayName[0]}
                            </div>
                            <div>
                              <p className="font-black text-neutral-900">{user.displayName}</p>
                              <p className="text-xs text-neutral-400">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <Badge className="bg-neutral-100 text-neutral-600 border-none font-bold uppercase text-[10px] tracking-tighter">
                            {user.role}
                          </Badge>
                        </td>
                        <td className="px-8 py-6">
                          <Badge className={`${user.status === 'blocked' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'} border-none font-black uppercase text-[10px]`}>
                            {user.status || 'Active'}
                          </Badge>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-2">
                             {user.phone && (
                               <a href={`https://wa.me/${user.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer">
                                  <Button size="icon" variant="ghost" className="rounded-xl text-green-600 hover:bg-green-50">
                                    <MessageCircle className="w-5 h-5" />
                                  </Button>
                               </a>
                             )}
                             <Button 
                               onClick={() => handleBlockUser(user.id, user.status)}
                               size="icon" 
                               variant="ghost" 
                               className={`rounded-xl ${user.status === 'blocked' ? 'text-green-600 hover:bg-green-50' : 'text-red-500 hover:bg-red-50'}`}
                             >
                                <Ban className="w-5 h-5" />
                             </Button>
                             <Button 
                               onClick={() => handleDeleteUser(user.id)}
                               size="icon" 
                               variant="ghost" 
                               className="rounded-xl text-neutral-300 hover:text-red-600 hover:bg-red-50"
                             >
                                <Trash2 className="w-5 h-5" />
                             </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )}

        {activeTab === 'vendors' && (
          <motion.div key="vendors" className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-orange-50 text-orange-900">
                <CardHeader>
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2rem]">Onboarding Queue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {vendors.filter(v => v.status === 'pending').map(v => (
                      <div key={v.id} className="flex items-center justify-between p-4 bg-white rounded-3xl shadow-sm">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center font-black">
                              {v.businessName[0]}
                            </div>
                            <div>
                               <p className="font-bold text-sm">{v.businessName}</p>
                               <p className="text-[10px] opacity-60 uppercase font-black">{v.category}</p>
                            </div>
                         </div>
                         <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleApprove(v.id!)} className="bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-[10px]">Approve</Button>
                            <Button size="sm" variant="ghost" onClick={() => handleReject(v.id!)} className="text-red-500 hover:bg-red-50 rounded-xl font-bold text-[10px]">Reject</Button>
                         </div>
                      </div>
                    ))}
                    {vendors.filter(v => v.status === 'pending').length === 0 && (
                      <p className="text-center py-8 text-neutral-400 font-bold italic text-sm">No pending applications</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter">Active Network</h3>
                <div className="grid grid-cols-1 gap-4">
                   {vendors.filter(v => v.status === 'active').map(v => (
                     <Card key={v.id} className="rounded-[2rem] border-none shadow-lg group hover:shadow-2xl transition-all cursor-pointer">
                        <CardContent className="p-6 flex items-center justify-between">
                           <div className="flex items-center gap-4">
                              <img src={v.logoUrl} alt="" className="w-16 h-16 rounded-2xl object-cover" />
                              <div>
                                 <h4 className="font-black text-lg text-neutral-900 group-hover:text-orange-600 transition-colors uppercase italic">{v.businessName}</h4>
                                 <p className="text-xs text-neutral-400">{v.address}</p>
                                 <Badge className="mt-2 bg-neutral-100 text-neutral-500 border-none font-bold uppercase text-[8px]">{v.category}</Badge>
                              </div>
                           </div>
                           <div className="flex flex-col items-end gap-2">
                              <div className="flex gap-2">
                                 {v.phoneNumber && (
                                   <a href={`https://wa.me/${v.phoneNumber.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer">
                                      <Button size="icon" variant="ghost" className="rounded-xl text-green-600 hover:bg-green-50">
                                        <MessageCircle className="w-5 h-5" />
                                      </Button>
                                   </a>
                                 )}
                                 <Button variant="ghost" onClick={() => handleReject(v.id!)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl size-10">
                                    <Ban className="w-5 h-5" />
                                 </Button>
                              </div>
                              <Link to={`/vendor/${v.id}`} target="_blank">
                                <Button size="sm" variant="ghost" className="text-xs font-black uppercase text-neutral-400 hover:text-orange-600">
                                  View Store <ExternalLink className="w-3 h-3 ml-1" />
                                </Button>
                              </Link>
                           </div>
                        </CardContent>
                     </Card>
                   ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'orders' && (
          <motion.div key="orders" className="space-y-6">
             <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden">
                <div className="p-8 bg-neutral-900 text-white flex justify-between items-center">
                   <h3 className="text-2xl font-black uppercase italic tracking-widest">Global Live Feed</h3>
                   <Badge className="bg-orange-600 border-none px-4 py-1 animate-pulse">Live Monitoring</Badge>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full">
                      <thead>
                        <tr className="bg-neutral-50 text-left">
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Order Ref</th>
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Merchant</th>
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Payment</th>
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Status</th>
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                         {allOrders.map(order => (
                           <tr key={order.id}>
                              <td className="px-8 py-6">
                                 <span className="font-black text-neutral-900">#{order.id?.slice(-8).toUpperCase()}</span>
                                 <p className="text-[10px] text-neutral-400">{order.createdAt?.toDate?.().toLocaleString() || 'Just now'}</p>
                              </td>
                              <td className="px-8 py-6 italic font-bold text-sm text-neutral-600">
                                 {vendors.find(v => v.id === order.vendorId)?.businessName || (order.vendorId ? `ID: ${order.vendorId.slice(0, 8)}...` : 'Unknown Merchant')}
                              </td>
                              <td className="px-8 py-6">
                                 <Badge className={`${order.paymentStatus === 'paid' ? 'bg-green-400' : 'bg-red-400'} text-white border-none font-black text-[8px] uppercase`}>
                                   {order.paymentStatus || 'pending'}
                                 </Badge>
                              </td>
                              <td className="px-8 py-6">
                                 <Badge variant="outline" className="border-neutral-200 text-neutral-400 font-bold uppercase text-[8px]">
                                   {order.status}
                                 </Badge>
                              </td>
                              <td className="px-8 py-6 text-right">
                                 <div className="flex justify-end gap-2">
                                    {order.paymentStatus !== 'paid' && (
                                      <Button 
                                        size="sm" 
                                        className="bg-green-600 text-white rounded-xl font-bold text-[10px]"
                                        onClick={async () => {
                                          await updateDoc(doc(db, 'orders', order.id!), { paymentStatus: 'paid' });
                                          toast.success('Markup as Paid');
                                        }}
                                      >
                                        Mark Paid
                                      </Button>
                                    )}
                                    <span className="font-black text-orange-600">TZS {order.totalAmount.toLocaleString()}</span>
                                 </div>
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </Card>
          </motion.div>
        )}

        {/* Marketing Tabs */}
        {activeTab === 'banners' && (
          <motion.div
            key="banners"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold uppercase italic font-black">Manage Banners</h2>
              <Button onClick={() => setIsAddBannerOpen(true)} className="bg-orange-600 hover:bg-orange-700 rounded-[1.2rem] gap-2">
                <Plus className="w-4 h-4" /> Add Banner
              </Button>
            </div>

            {isAddBannerOpen && (
              <Card className="border-orange-200 bg-orange-50/30 rounded-[2rem]">
                <CardHeader>
                  <CardTitle className="text-lg">New Promotional Banner</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddBanner} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-neutral-500">Title</label>
                      <Input required placeholder="e.g. 50% OFF Chakula" value={newBanner.title} onChange={e => setNewBanner({...newBanner, title: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-neutral-500">Subtitle</label>
                      <Input required placeholder="e.g. Order from your favorite restaurants" value={newBanner.sub} onChange={e => setNewBanner({...newBanner, sub: e.target.value})} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold uppercase text-neutral-500">Image URL</label>
                      <Input required placeholder="https://images.unsplash.com/..." value={newBanner.img} onChange={e => setNewBanner({...newBanner, img: e.target.value})} />
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
              {banners.map((banner) => banner.img && (
                <Card key={banner.id} className="overflow-hidden group rounded-[2.5rem] border-none shadow-xl">
                  <div className="h-48 relative">
                    <img src={banner.img} alt={banner.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-8 text-white">
                      <h3 className="font-black text-2xl uppercase italic leading-tight">{banner.title}</h3>
                      <p className="text-xs opacity-80 font-bold uppercase tracking-widest">{banner.sub}</p>
                    </div>
                    <button onClick={() => deleteDoc(doc(db, 'banners', banner.id!))} className="absolute top-4 right-4 p-3 bg-white/90 text-red-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 hover:text-white">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'coupons' && (
          <motion.div key="coupons" className="space-y-6">
             <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter">Manage Coupons</h2>
                <Button onClick={() => setIsAddCouponOpen(true)} className="bg-orange-600 hover:bg-orange-700 rounded-2xl gap-2">
                   <Plus className="w-4 h-4" /> Add Coupon
                </Button>
             </div>
             {/* ... reuse existing coupon mapping ... */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {coupons.map(coupon => (
                  <Card key={coupon.id} className="p-8 border-none shadow-xl rounded-[2.5rem] bg-white relative group">
                     <div className="flex justify-between items-start">
                        <div>
                           <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-orange-100 text-orange-600 border-none font-black text-[8px] tracking-[0.2rem] uppercase">Official Coupon</Badge>
                           </div>
                           <h3 className="font-black text-3xl text-neutral-900 tracking-tighter uppercase italic">{coupon.code}</h3>
                           <p className="text-lg font-black text-orange-600 mt-1">
                              {coupon.discountType === 'percentage' ? `${coupon.discountValue}% Off` : `TZS ${coupon.discountValue.toLocaleString()} Off`}
                           </p>
                        </div>
                        <Button variant="ghost" className="text-red-400 hover:text-red-600 rounded-2xl p-4 size-14" onClick={() => deleteDoc(doc(db, 'coupons', coupon.id!))}>
                           <Trash2 className="w-6 h-6" />
                        </Button>
                     </div>
                  </Card>
                ))}
             </div>
          </motion.div>
        )}

        {activeTab === 'notifications' && (
          <motion.div key="notifications" className="max-w-2xl mx-auto py-12">
             <Card className="rounded-[3rem] border-none shadow-2xl p-12 bg-neutral-900 text-white">
                <CardHeader className="text-center">
                   <Megaphone className="w-16 h-16 text-orange-600 mx-auto mb-6" />
                   <CardTitle className="text-3xl font-black italic uppercase tracking-widest">Global Broadcast</CardTitle>
                   <CardDescription className="text-neutral-500 font-bold uppercase tracking-widest text-[10px]">Reach every user in your community instantly.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 mt-8">
                   <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.3rem] text-neutral-500">Alert Title</label>
                      <Input className="bg-neutral-800 border-none h-16 rounded-2xl font-bold text-white placeholder:text-neutral-600" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} placeholder="What's happening?" />
                   </div>
                   <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.3rem] text-neutral-500">Alert Content</label>
                      <Textarea className="bg-neutral-800 border-none min-h-[160px] rounded-[2rem] font-bold text-white placeholder:text-neutral-600" value={notifBody} onChange={e => setNotifBody(e.target.value)} placeholder="Tell them everything..." />
                   </div>
                   <Button disabled={isSending} onClick={handleSendNotification} className="w-full h-20 bg-orange-600 hover:bg-orange-700 text-xl font-black uppercase tracking-widest rounded-[2rem] shadow-2xl shadow-orange-900/50">
                      {isSending ? 'Transmitting...' : 'Initiate Broadcast'}
                   </Button>
                </CardContent>
             </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
