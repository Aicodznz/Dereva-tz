import React, { useEffect, useState, useMemo } from 'react';
import { initiatePayment } from '../services/paymentService';
import QRCodeStyling, { DotType, CornerSquareType, CornerDotType } from "qr-code-styling";
import { useAuth } from '../AuthContext';
import { db, storage, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, limit, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { VendorProfile, VendorCategory, Product, Order, OrderStatus } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  TrendingUp, 
  Plus, 
  Search, 
  Bell, 
  Settings, 
  LogOut, 
  ChevronRight, 
  Clock, 
  DollarSign,
  BarChart3,
  Store,
  Truck,
  AlertCircle,
  MoreVertical,
  Filter,
  Download,
  Calendar,
  History,
  CreditCard,
  User,
  MapPin,
  Phone,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Camera,
  Trash2,
  X,
  Megaphone,
  UserPlus,
  Save,
  ShoppingBag,
  Beer,
  Smartphone,
  Banknote,
  QrCode,
  Layout,
  Zap,
  Gift,
  Tag,
  Edit2,
  Box,
  Check,
  Link as LinkIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format } from 'date-fns';

type TabType = 'overview' | 'orders' | 'products' | 'pos' | 'tables' | 'customers' | 'coupons' | 'settings';

const chartData = [
  { name: 'Mon', sales: 4000, orders: 24 },
  { name: 'Tue', sales: 3000, orders: 18 },
  { name: 'Wed', sales: 2000, orders: 12 },
  { name: 'Thu', sales: 2780, orders: 20 },
  { name: 'Fri', sales: 1890, orders: 15 },
  { name: 'Sat', sales: 2390, orders: 17 },
  { name: 'Sun', sales: 3490, orders: 22 },
];

import { useLanguage } from '../LanguageContext';

export default function VendorDashboard() {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleteOrderModalOpen, setIsDeleteOrderModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [isAddCouponOpen, setIsAddCouponOpen] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: 0,
    active: true,
    productId: null
  });

  // POS Enhanced States
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [tableNumber, setTableNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile_money'>('cash');
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [posCustomer, setPosCustomer] = useState<any>(null);

  // Dine Tables States
  const [tables, setTables] = useState<any[]>([]);
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [newTable, setNewTable] = useState({ number: '', capacity: 4 });
  const [selectedTable, setSelectedTable] = useState<any>(null);

  // Settings State
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [updatedProfile, setUpdatedProfile] = useState<Partial<VendorProfile>>({});
  const [inventorySearch, setInventorySearch] = useState('');
  const [stockLevelFilter, setStockLevelFilter] = useState('all');

  // QR Builder State
  const [isQrBuilderOpen, setIsQrBuilderOpen] = useState(false);
  const [printDetails, setPrintDetails] = useState({
    header: '',
    subHeader: 'MENU YA KIDIJITALI',
    footer: 'CHANGANUA HAPA KUTAZAMA MENU & KUAGIZA',
    address: '',
    phone: '',
    isPrintMode: false
  });
  const [qrOptions, setQrOptions] = useState<any>({
    width: 300,
    height: 300,
    data: '',
    image: '',
    dotsOptions: {
      color: '#000000',
      type: 'square' as DotType
    },
    backgroundOptions: {
      color: '#ffffff',
    },
    cornersSquareOptions: {
      color: '#000000',
      type: 'square' as CornerSquareType
    },
    cornersDotOptions: {
      color: '#000000',
      type: 'square' as CornerDotType
    },
    margin: 10,
    qrOptions: {
      typeNumber: 0,
      mode: 'Byte',
      errorCorrectionLevel: 'Q'
    },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: 0.4,
      margin: 0
    }
  });

  const qrRef = React.useRef<HTMLDivElement>(null);
  const [qrCodeInstance, setQrCodeInstance] = useState<QRCodeStyling | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setQrCodeInstance(new QRCodeStyling(qrOptions));
    }
  }, [qrOptions]);

  useEffect(() => {
    if (isQrBuilderOpen && qrRef.current && qrCodeInstance) {
      const container = qrRef.current;
      container.innerHTML = "";
      qrCodeInstance.append(container);
    }
  }, [isQrBuilderOpen, qrCodeInstance]);

  const downloadQr = () => {
    if (qrCodeInstance) {
      qrCodeInstance.download({
        name: 'Table Stand QR Code',
        extension: 'png'
      });
    }
  };

  useEffect(() => {
    if (vendorProfile && !printDetails.header) {
      setPrintDetails(prev => ({ 
        ...prev, 
        header: vendorProfile.businessName || 'KARIBU CHAKULA',
        address: vendorProfile.address || '',
        phone: vendorProfile.phoneNumber || ''
      }));
    }
  }, [vendorProfile]);

  const handlePrint = () => {
    window.print();
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const tabs = [
    { id: 'overview', label: t('overview') || 'Overview', icon: LayoutDashboard },
    { id: 'orders', label: t('orders') || 'Orders', icon: ShoppingCart, badge: orders.length > 0 ? orders.length : null },
    { id: 'products', label: t('inventory') || 'Inventory', icon: Package },
    { id: 'pos', label: t('pos_system') || 'POS System', icon: CreditCard },
    { id: 'tables', label: 'Dine Tables', icon: QrCode },
    { id: 'coupons', label: 'Coupons', icon: Megaphone },
    { id: 'customers', label: t('customers') || 'Customers', icon: Users },
    { id: 'settings', label: t('settings') || 'Settings', icon: Settings },
  ];

  const categories = Array.from(new Set(['all', ...products.map(p => p.category)]));
  const filteredProducts = products.filter(p => 
    (selectedCategory === 'all' || p.category === selectedCategory)
  );

  // Onboarding Form State
  const [formData, setFormData] = useState({
    businessName: '',
    category: '' as VendorCategory,
    description: '',
    tin: '',
    address: '',
    deliveryRadius: 5,
    operatingHours: '9:00 AM - 9:00 PM',
  });

  // New Product Form State
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    description: '',
    price: 0,
    category: '',
    stock: 0,
    unit: 'pcs',
    expiryDate: '',
    medicationType: 'otc',
    variations: [],
    addOns: [],
    imageUrl: '',
    imageUrls: [],
  });

  // POS Cart State
  const [cart, setCart] = useState<{product: Product, quantity: number}[]>([]);
  const [isKDSMode, setIsKDSMode] = useState(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'vendors'), where('ownerUid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setVendorProfile({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as VendorProfile);
        setShowOnboarding(false);
      } else {
        setShowOnboarding(true);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'vendors');
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!vendorProfile?.id) return;
    
    const ordersQ = query(
      collection(db, 'orders'), 
      where('vendorId', '==', vendorProfile.id),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    
    const unsubOrders = onSnapshot(ordersQ, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    });

    const productsQ = query(
      collection(db, 'products'), 
      where('vendorId', '==', vendorProfile.id)
    );
    
    const unsubProducts = onSnapshot(productsQ, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    const tablesQ = query(
      collection(db, 'tables'),
      where('vendorId', '==', vendorProfile.id)
    );

    const unsubTables = onSnapshot(tablesQ, (snap) => {
      setTables(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubOrders();
      unsubProducts();
      unsubTables();
    };
  }, [vendorProfile?.id]);

  useEffect(() => {
    if (vendorProfile) {
      setUpdatedProfile({
        businessName: vendorProfile.businessName,
        description: vendorProfile.description,
        address: vendorProfile.address,
        phoneNumber: vendorProfile.phoneNumber,
        logoUrl: vendorProfile.logoUrl,
        bannerUrl: vendorProfile.bannerUrl,
        operatingHours: vendorProfile.operatingHours
      });
    }
  }, [vendorProfile]);

  useEffect(() => {
    if (!vendorProfile?.id) return;
    const q = query(collection(db, 'coupons'), where('vendorId', '==', vendorProfile.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCoupons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [vendorProfile?.id]);

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, 'vendors'), {
        ...formData,
        ownerUid: user.uid,
        status: 'pending',
        rating: 0,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'vendors');
    }
  };


  const handleFileUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    
    if (!vendorProfile?.id) {
      toast.error('Tafadhali subiri wasifu wa biashara upakiwe kwanza.');
      return;
    }

    if (!auth.currentUser) {
      toast.error('Tafadhali ingia kwenye akaunti yako kwanza ili uweze kupakia picha.');
      return;
    }
    
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
      toast.error('Tafadhali weka picha pekee.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    
    const uploadPromises = validFiles.map(async (file, index) => {
      try {
        const storageRef = ref(storage, `products/${vendorProfile.id}/${Date.now()}_${index}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        return new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            uploadTask.cancel();
            reject(new Error(`Muda wa kupakia umeisha kwa ${file.name}. Tafadhali jaribu tena.`));
          }, 300000); // 5 minute timeout per file

          uploadTask.on('state_changed', 
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(prev => Math.max(prev, progress));
            }, 
            (error) => {
              clearTimeout(timeout);
              if (error.code === 'storage/canceled') {
                // Ignore cancellation error as it's handled by timeout or manual cancel
                return;
              }
              console.error('Upload error:', error);
              reject(error);
            }, 
            async () => {
              clearTimeout(timeout);
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            }
          );
        });
      } catch (error: any) {
        throw new Error(`Imeshindwa kuanza kupakia ${file.name}: ${error.message}`);
      }
    });

    try {
      const urls = await Promise.all(uploadPromises);
      setNewProduct(prev => ({ 
        ...prev, 
        imageUrls: [...(prev.imageUrls || []), ...urls],
        imageUrl: prev.imageUrl || urls[0]
      }));
      toast.success(`${urls.length} picha zimepakiwa!`);
    } catch (error: any) {
      toast.error(error.message || 'Kuna tatizo lilitokea wakati wa kupakia.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorProfile?.id) return;
    try {
      if (editingProduct?.id) {
        await updateDoc(doc(db, 'products', editingProduct.id), {
          ...newProduct,
          vendorCategory: vendorProfile.category,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'products'), {
          ...newProduct,
          vendorId: vendorProfile.id,
          vendorCategory: vendorProfile.category,
          createdAt: serverTimestamp(),
        });
      }
      setIsAddProductOpen(false);
      setEditingProduct(null);
      setNewProduct({
        name: '',
        description: '',
        price: 0,
        category: '',
        stock: 0,
        unit: 'pcs',
        expiryDate: '',
        medicationType: 'otc',
        variations: [],
        addOns: [],
        imageUrl: '',
        imageUrls: [],
      });
    } catch (error) {
      handleFirestoreError(error, editingProduct ? OperationType.UPDATE : OperationType.CREATE, 'products');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    setProductToDelete(productId);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      await deleteDoc(doc(db, 'products', productToDelete));
      toast.success('Bidhaa imefutwa kikamilifu!');
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'products');
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrderToDelete(orderId);
    setIsDeleteOrderModalOpen(true);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    try {
      await deleteDoc(doc(db, 'orders', orderToDelete));
      toast.success('Oda imefutwa kikamilifu!');
      setIsDeleteOrderModalOpen(false);
      setOrderToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'orders');
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      stock: product.stock,
      unit: product.unit || 'pcs',
      expiryDate: product.expiryDate || '',
      medicationType: product.medicationType || 'otc',
      variations: product.variations || [],
      addOns: product.addOns || [],
      imageUrl: product.imageUrl || '',
      imageUrls: product.imageUrls || (product.imageUrl ? [product.imageUrl] : []),
    });
    setIsAddProductOpen(true);
  };

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorProfile?.id) return;
    try {
      await addDoc(collection(db, 'coupons'), {
        ...newCoupon,
        vendorId: vendorProfile.id,
        createdBy: user?.uid,
        createdAt: serverTimestamp()
      });
      setIsAddCouponOpen(false);
      setNewCoupon({ code: '', discountType: 'percentage', discountValue: 0, active: true, productId: null });
      toast.success('Coupon added successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'coupons');
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'coupons', id));
      toast.success('Coupon deleted.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `coupons/${id}`);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorProfile?.id) return;
    setIsSavingSettings(true);
    try {
      await updateDoc(doc(db, 'vendors', vendorProfile.id), {
        ...updatedProfile,
        updatedAt: serverTimestamp()
      });
      toast.success('Duka limefanyiwa maboresho!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vendors/${vendorProfile.id}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const filteredInventory = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(inventorySearch.toLowerCase()) || 
                         p.id?.toLowerCase().includes(inventorySearch.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesStock = stockLevelFilter === 'all' || 
                        (stockLevelFilter === 'low' && p.stock < 10) || 
                        (stockLevelFilter === 'out' && p.stock === 0);
    return matchesSearch && matchesCategory && matchesStock;
  });

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const handleCompleteSale = async () => {
    if (cart.length === 0 || !vendorProfile?.id || !user) return;
    
    if (paymentMethod === 'mobile_money' && !posCustomer?.phone) {
      toast.error('Tafadhali ongeza namba ya simu ya mteja ili kufanya malipo ya simu.');
      setIsAddCustomerModalOpen(true);
      return;
    }

    setIsProcessingSale(true);
    try {
      const orderData = {
        vendorId: vendorProfile.id,
        customerId: posCustomer ? (posCustomer.id || 'POS_CUSTOMER') : 'WALK_IN_CUSTOMER',
        customerName: posCustomer?.name || 'Walk-in Customer',
        customerPhone: posCustomer?.phone || '',
        items: cart.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity
        })),
        totalAmount: cartTotal * 1.18, // Total with tax
        subtotal: cartTotal,
        taxAmount: cartTotal * 0.18,
        status: 'pending',
        orderSource: 'pos',
        orderType: orderType,
        tableNumber: orderType === 'dine_in' ? tableNumber : null,
        paymentMethod: paymentMethod,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deliveryAddress: orderType === 'delivery' ? (posCustomer?.address || 'POS Delivery') : 'In-Store POS',
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      // If Mobile Money, initiate Mongike payment
      if (paymentMethod === 'mobile_money' && posCustomer?.phone) {
        toast.info('Inatuma ombi la malipo kwenye simu ya mteja...');
        try {
          const formattedPhone = posCustomer.phone.startsWith('0') 
            ? '255' + posCustomer.phone.substring(1) 
            : posCustomer.phone.replace('+', '');
            
          await initiatePayment({
            order_id: docRef.id,
            amount: Math.round(cartTotal * 1.18),
            buyer_phone: formattedPhone,
            fee_payer: 'MERCHANT'
          });
          toast.success('Ombi la malipo limetumwa! Mteja aweke siri kukamilisha.');
        } catch (payError: any) {
          console.error('Mongike initiation failed:', payError);
          toast.error('Imeshindwa kutuma ombi la malipo: ' + payError.message);
        }
      } else {
        toast.success('Malipo yamekamilika! Oda imehifadhiwa na kutumwa jikoni.');
      }

      setCart([]);
      setPosCustomer(null);
      setTableNumber('');
      setOrderType('dine_in');
      setActiveTab('orders');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    } finally {
      setIsProcessingSale(false);
    }
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorProfile?.id) return;
    try {
      await addDoc(collection(db, 'tables'), {
        ...newTable,
        vendorId: vendorProfile.id,
        status: 'available',
        createdAt: serverTimestamp()
      });
      setIsAddTableOpen(false);
      setNewTable({ number: '', capacity: 4 });
      toast.success('Table added successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tables');
    }
  };

  const handleDeleteTable = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tables', id));
      toast.success('Table removed.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'tables');
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 space-y-4">
      <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-neutral-500 font-medium animate-pulse">Loading your business center...</p>
    </div>
  );

  if (showOnboarding) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-2xl shadow-orange-100 overflow-hidden border border-neutral-100"
        >
          <div className="bg-orange-600 p-8 text-white">
            <h1 className="text-3xl font-bold">Vendor Onboarding</h1>
            <p className="text-orange-100 mt-2">Register your business to start selling on OmniServe.</p>
          </div>
          <div className="p-8">
            <form onSubmit={handleOnboarding} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Business Name</label>
                  <Input required className="h-12 rounded-xl" value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} placeholder="e.g. Healthy Meds Pharmacy" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Category</label>
                  <Select required onValueChange={val => setFormData({...formData, category: val as VendorCategory})}>
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pharmacy">Pharmacy</SelectItem>
                      <SelectItem value="grocery">Grocery</SelectItem>
                      <SelectItem value="restaurant">Restaurant</SelectItem>
                      <SelectItem value="ecommerce">eCommerce</SelectItem>
                      <SelectItem value="salon">Salon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700">Business Description</label>
                <Input required className="h-12 rounded-xl" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Describe your business..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">TIN Number</label>
                  <Input required className="h-12 rounded-xl" value={formData.tin} onChange={e => setFormData({...formData, tin: e.target.value})} placeholder="Tax Identification Number" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Delivery Radius (km)</label>
                  <Input type="number" className="h-12 rounded-xl" required value={formData.deliveryRadius} onChange={e => setFormData({...formData, deliveryRadius: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700">Physical Address</label>
                <Input required className="h-12 rounded-xl" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Full business address" />
              </div>
              <Button type="submit" className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-lg font-bold rounded-2xl shadow-lg shadow-orange-200 transition-all hover:scale-[1.02]">
                Submit Application
              </Button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  if (vendorProfile?.status === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-yellow-50 text-yellow-600 rounded-3xl flex items-center justify-center mb-8 shadow-inner"
        >
          <Clock className="w-12 h-12" />
        </motion.div>
        <h2 className="text-3xl font-bold text-neutral-900 mb-3">Application Pending</h2>
        <p className="text-neutral-500 max-w-md mx-auto text-lg leading-relaxed">
          Your application for <span className="font-bold text-orange-600">{vendorProfile.businessName}</span> is being reviewed. We'll notify you once it's approved.
        </p>
        <Button variant="outline" className="mt-8 rounded-xl px-8 h-12 font-semibold" onClick={() => window.location.reload()}>
          Check Status
        </Button>
      </div>
    );
  }


  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Order #${orderId.slice(-4)} moved to ${newStatus}`);
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch(status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'accepted': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'preparing': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'prepared': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'delivered': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'completed': return 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20';
    }
  };

  const renderKDSColumn = (title: string, statusList: OrderStatus[], color: string) => {
    const filteredOrders = orders.filter(o => statusList.includes(o.status));
    return (
      <div className="flex-1 min-w-[320px] bg-neutral-900/30 rounded-3xl p-6 border border-neutral-800/50 flex flex-col gap-6 h-[calc(100vh-280px)] overflow-hidden">
        <div className="flex items-center justify-between">
           <h3 className={`font-black uppercase tracking-widest text-[10px] ${color}`}>{title}</h3>
           <Badge variant="outline" className="bg-white/5 border-none text-neutral-500 font-black">{filteredOrders.length}</Badge>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-2">
           {filteredOrders.map((order, index) => (
             <motion.div 
               layout
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               key={`kds-card-${order.id}-${index}`} 
               className="bg-neutral-950 border border-neutral-800 p-5 rounded-2xl space-y-4 hover:border-orange-600/30 transition-all cursor-pointer group"
             >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Order ID</span>
                    <p className="font-bold text-sm text-white">#{order.id?.slice(-6).toUpperCase()}</p>
                  </div>
                  <div className="flex gap-2">
                    {order.orderType === 'dine_in' && (
                      <Badge className="bg-orange-600 text-white border-none text-[8px] font-black uppercase">Meza {order.tableNumber}</Badge>
                    )}
                    {order.orderType === 'delivery' && (
                      <Badge className="bg-blue-600 text-white border-none text-[8px] font-black uppercase">Delivery</Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                   {order.items.map((item: any, idx: number) => (
                     <div key={idx} className="flex justify-between items-start">
                        <div className="flex gap-2 items-center">
                          <span className="w-5 h-5 rounded-lg bg-neutral-800 flex items-center justify-center text-[10px] font-black text-white">{item.quantity}x</span>
                          <span className="text-xs font-bold text-neutral-300">{item.name}</span>
                        </div>
                     </div>
                   ))}
                </div>

                <div className="pt-4 border-t border-neutral-900 flex items-center justify-between">
                   <div className="flex items-center gap-2 text-neutral-500">
                      <Clock className="w-3 h-3" />
                      <span className="text-[10px] font-bold">{order.createdAt ? format(order.createdAt.toDate(), 'HH:mm') : 'Now'}</span>
                   </div>
                   <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <Button 
                          size="sm" 
                          className="bg-orange-600 hover:bg-orange-700 h-8 rounded-lg text-[10px] font-black uppercase"
                          onClick={() => updateOrderStatus(order.id!, 'preparing')}
                        >
                          Start Preparing
                        </Button>
                      )}
                      {order.status === 'preparing' && (
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700 h-8 rounded-lg text-[10px] font-black uppercase"
                          onClick={() => updateOrderStatus(order.id!, 'prepared')}
                        >
                          Mark Done
                        </Button>
                      )}
                       {order.status === 'prepared' && (
                        <Button 
                          size="sm" 
                          className="bg-blue-600 hover:bg-blue-700 h-8 rounded-lg text-[10px] font-black uppercase"
                          onClick={() => updateOrderStatus(order.id!, 'completed')}
                        >
                          Finish
                        </Button>
                      )}
                      <Button
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-neutral-600 hover:text-red-500 hover:bg-red-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteOrder(order.id!);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                   </div>
                </div>
             </motion.div>
           ))}
           {filteredOrders.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center opacity-20 py-12">
                <Layout className="w-12 h-12 mb-4" />
                <p className="text-xs font-black uppercase tracking-widest">No orders</p>
             </div>
           )}
        </div>
      </div>
    );
  };

  const ordersTab = (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">Orders & KDS</h1>
          <p className="text-neutral-500 font-medium">Manage live kitchen tickets and delivery status.</p>
        </div>
        <div className="flex items-center gap-2 p-1 bg-neutral-900 rounded-2xl border border-neutral-800">
           <Button 
             variant={isKDSMode ? 'default' : 'ghost'} 
             onClick={() => setIsKDSMode(true)}
             className={`rounded-xl h-10 px-6 font-bold text-[10px] uppercase tracking-widest ${isKDSMode ? 'bg-orange-600 shadow-lg shadow-orange-900/20' : 'text-neutral-500'}`}
           >
              KDS Panel
           </Button>
           <Button 
             variant={!isKDSMode ? 'default' : 'ghost'} 
             onClick={() => setIsKDSMode(false)}
             className={`rounded-xl h-10 px-6 font-bold text-[10px] uppercase tracking-widest ${!isKDSMode ? 'bg-orange-600 shadow-lg shadow-orange-900/20' : 'text-neutral-500'}`}
           >
              List View
           </Button>
        </div>
      </div>

      {isKDSMode ? (
        <div className="flex gap-8 overflow-x-auto no-scrollbar pb-8 min-h-[600px]">
           {renderKDSColumn("New Orders", ["pending"], "text-yellow-500")}
           {renderKDSColumn("Kitchen / Preparing", ["preparing", "accepted"], "text-orange-500")}
           {renderKDSColumn("Ready / Done", ["prepared"], "text-purple-500")}
           {renderKDSColumn("Recent History", ["delivered", "completed"], "text-green-500")}
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/50">
                  <th className="px-8 py-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Order Details</th>
                  <th className="px-8 py-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Mode</th>
                  <th className="px-8 py-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Items</th>
                  <th className="px-8 py-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Amount</th>
                  <th className="px-8 py-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-right">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {orders.map((order, index) => (
                  <tr key={`${order.id}-${index}`} className="hover:bg-neutral-800/30 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-neutral-800 flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all">
                          <Receipt className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-white text-lg">#{order.id?.slice(-6).toUpperCase()}</p>
                          <p className="text-[10px] text-neutral-500 font-bold uppercase">{order.customerName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className={`border-none ${order.orderSource === 'pos' ? 'bg-orange-600/10 text-orange-600' : 'bg-blue-600/10 text-blue-600'} text-[10px] font-black px-2.5 py-1 uppercase`}>
                          {order.orderSource === 'pos' ? 'In-Store POS' : 'Online App'}
                        </Badge>
                        <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest ml-1">{order.orderType}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-bold text-neutral-400">{order.items.length} Items</p>
                      <p className="text-[10px] text-neutral-600">{order.items[0]?.name}...</p>
                    </td>
                    <td className="px-8 py-6">
                      <p className="font-black text-white text-lg">TZS {order.totalAmount.toLocaleString()}</p>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{order.paymentMethod}</p>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <Badge className={`${getStatusColor(order.status)} border rounded-lg px-4 py-1.5 text-[10px] font-black uppercase tracking-widest`}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-neutral-500 hover:text-red-500 hover:bg-neutral-800 rounded-xl"
                        onClick={() => handleDeleteOrder(order.id!)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-12rem)] -mx-4 sm:-mx-6 lg:-mx-8 -my-8 bg-neutral-950 text-white overflow-hidden rounded-3xl border border-neutral-800 shadow-2xl relative">
      {/* Mobile Menu Toggle */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-neutral-900 border-b border-neutral-800 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center shadow-lg">
            <Store className="w-5 h-5 text-white" />
          </div>
          <h2 className="font-bold text-xs truncate max-w-[150px]">{vendorProfile?.businessName}</h2>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-neutral-400"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <MoreVertical className="w-6 h-6" />}
        </Button>
      </div>

      {/* Sidebar - Desktop and Mobile Overlay */}
      <aside className={`
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        fixed lg:relative inset-y-0 left-0 w-64 bg-neutral-900 border-r border-neutral-800 p-6 flex flex-col gap-8 z-40 transition-transform duration-300 lg:z-auto
      `}>
        <div className="hidden lg:flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/20">
            <Store className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm truncate w-32">{vendorProfile?.businessName}</h2>
            <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">{vendorProfile?.category}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 overflow-y-auto no-scrollbar">
          {tabs.map((item) => (
            <button
              key={`tab-nav-${item.id}`}
              onClick={() => {
                setActiveTab(item.id as TabType);
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${
                activeTab === item.id 
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' 
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5" />
                <span className="font-medium text-sm">{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  activeTab === item.id ? 'bg-white text-orange-600' : 'bg-orange-600 text-white'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-neutral-800">
          <Link to="/profile" className="flex items-center gap-3 px-4 py-3 text-neutral-400 hover:text-white transition-colors group">
            <History className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span className="font-medium text-sm">Switch Role</span>
          </Link>
        </div>
      </aside>

      {/* Mobile Overlay Background */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-x-hidden overflow-y-auto w-full">
        {/* Top Bar - Only on Desktop typically, but we adjust for mobile */}
        <header className="h-20 border-b border-neutral-800 px-4 md:px-8 flex items-center justify-between bg-neutral-900/20 backdrop-blur-xl sticky top-0 z-10 w-full">
          <div className="hidden sm:flex items-center gap-4 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input 
                type="text" 
                placeholder="Search orders, products..." 
                className="w-full bg-neutral-800/50 border-none rounded-xl pl-10 pr-4 h-10 text-sm focus:ring-2 focus:ring-orange-600 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button 
              onClick={() => setIsAddProductOpen(true)}
              className="bg-orange-600 hover:bg-orange-700 gap-2 h-10 rounded-xl px-4 font-bold hidden md:flex"
            >
              <Plus className="w-4 h-4" /> Add Product
            </Button>
            <div className="h-8 w-px bg-neutral-800 mx-2 hidden md:block"></div>
            <button className="p-2.5 rounded-xl bg-neutral-800/50 text-neutral-400 hover:text-white transition-all relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-orange-600 rounded-full border-2 border-neutral-900"></span>
            </button>
            <div className="h-8 w-px bg-neutral-800 mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-white">{profile?.displayName}</p>
                <p className="text-[10px] text-neutral-500 uppercase tracking-tighter">Owner</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-600/30 flex items-center justify-center text-orange-600 font-bold">
                {profile?.displayName?.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-8 pb-12"
              >
                {/* Header Info */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter">Business Overview</h1>
                    <p className="text-neutral-500 font-medium">Monitoring your store performance in real-time.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      className="rounded-xl border-neutral-800 bg-neutral-900 gap-2 h-11 px-5"
                      onClick={() => toast.info('Data export requested. Your report will be available shortly.')}
                    >
                      <Download className="w-4 h-4" /> Export Data
                    </Button>
                    <Button 
                      className="rounded-xl bg-orange-600 hover:bg-orange-700 gap-2 h-11 px-6 font-bold shadow-lg shadow-orange-900/20"
                      onClick={() => {
                        window.location.reload();
                      }}
                    >
                      <Zap className="w-4 h-4" /> Live Sync
                    </Button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {[
                    { label: "Add Item", icon: Plus, action: () => { setActiveTab('products'); setIsAddProductOpen(true); }, color: "bg-orange-600" },
                    { label: "New Order", icon: ShoppingBag, action: () => setActiveTab('pos'), color: "bg-blue-600" },
                    { label: "Add Table", icon: QrCode, action: () => { setActiveTab('tables'); setIsAddTableOpen(true); }, color: "bg-purple-600" },
                    { label: "Customers", icon: Users, action: () => setActiveTab('customers'), color: "bg-emerald-600" },
                    { label: "Coupons", icon: Tag, action: () => setActiveTab('coupons'), color: "bg-pink-600" },
                    { label: "Help", icon: AlertCircle, action: () => toast.info('Support team contacted.'), color: "bg-neutral-800" },
                  ].map((action, i) => (
                    <motion.button
                      key={`quick-action-${action.label}-${i}`}
                      whileHover={{ y: -4, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={action.action}
                      className="flex flex-col items-center justify-center p-6 rounded-[2rem] bg-neutral-900/60 border border-neutral-800 hover:border-orange-600/30 transition-all gap-3 overflow-hidden relative group"
                    >
                      <div className="absolute inset-0 bg-orange-600/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className={`p-4 rounded-2xl ${action.color} text-white shadow-lg relative z-10 transition-transform group-hover:scale-110`}>
                        <action.icon className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-white relative z-10">{action.label}</span>
                    </motion.button>
                  ))}
                </div>

                {/* Main Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: "Gross Sales", value: `TZS ${(orders.reduce((s,o) => s + o.totalAmount, 0)).toLocaleString()}`, icon: Banknote, trend: "+12.5%", positive: true, sub: "Total revenue generated" },
                    { label: "Active Orders", value: orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length.toString(), icon: Clock, trend: "+3 new", positive: true, sub: "Currently in kitchen/delivery" },
                    { label: "Available Stock", value: products.length.toString(), icon: Package, trend: "Stable", positive: true, sub: "Unique items listed" },
                    { label: "Active Tables", value: `${tables.filter(t => t.status === 'occupied').length}/${tables.length}`, icon: QrCode, trend: "Busy", positive: true, sub: "Dining occupancy" },
                  ].map((stat, i) => (
                    <Card key={`stat-card-${stat.label}-${i}`} className="bg-neutral-900/40 border-neutral-800 backdrop-blur-sm overflow-hidden group hover:border-orange-600/50 transition-all cursor-default">
                      <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-6">
                          <div className="p-3.5 rounded-2xl bg-neutral-800 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all transform group-hover:rotate-6">
                            <stat.icon className="w-6 h-6" />
                          </div>
                          <div className={`flex items-center gap-1 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                            stat.positive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                            {stat.trend}
                          </div>
                        </div>
                        <h3 className="text-3xl font-black text-white tracking-tighter mb-1">{stat.value}</h3>
                        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className="text-[10px] text-neutral-600 font-medium">{stat.sub}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Complex Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Card className="lg:col-span-2 bg-neutral-900/40 border-neutral-800 p-8">
                    <div className="flex items-center justify-between mb-10">
                      <div>
                        <h3 className="text-xl font-black uppercase tracking-tight italic">Revenue Stream</h3>
                        <p className="text-xs text-neutral-500">Hourly sales performance</p>
                      </div>
                      <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800">
                        <button className="px-4 py-2 text-[10px] font-bold uppercase bg-orange-600 rounded-lg">Sales</button>
                        <button className="px-4 py-2 text-[10px] font-bold uppercase text-neutral-500 hover:text-white">Orders</button>
                      </div>
                    </div>
                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ea580c" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                          <XAxis dataKey="name" stroke="#404040" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} dy={10} />
                          <YAxis stroke="#404040" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} tickFormatter={(v) => `${v/1000}k`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '16px', color: '#fff' }}
                            cursor={{ stroke: '#ea580c', strokeWidth: 2 }}
                          />
                          <Area type="monotone" dataKey="sales" stroke="#ea580c" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card className="bg-neutral-900/40 border-neutral-800 p-8 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight italic">Inventory Mix</h3>
                      <p className="text-xs text-neutral-500">Distribution by category</p>
                    </div>
                    <div className="h-[250px] w-full mt-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={Array.from(new Set(products.map(p => p.category))).map(cat => ({
                              name: cat,
                              value: products.filter(p => p.category === cat).length
                            }))}
                            cx="50%" cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                          {Array.from(new Set(products.map(p => p.category).filter(Boolean))).map((cat, index) => (
                            <Cell key={`insight-cell-${cat || 'uncategorized'}-${index}`} fill={['#ea580c', '#f97316', '#fb923c', '#fdba74'][index % 4]} />
                          ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', borderRadius: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-4">
                      {Array.from(new Set(products.map(p => p.category).filter(Boolean))).slice(0, 4).map((cat, i) => (
                        <div key={`insight-legend-${cat}-${i}`} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#ea580c', '#f97316', '#fb923c', '#fdba74'][i % 4] }}></div>
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{cat}</span>
                          </div>
                          <span className="text-xs font-bold text-white">{products.filter(p => p.category === cat).length} items</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                {/* Stock Alerts & Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card className="bg-neutral-900/40 border-neutral-800 p-8">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-xl font-black uppercase tracking-tight italic">Low Stock Alerts</h3>
                        <p className="text-xs text-neutral-500">Items that need restocking soon</p>
                      </div>
                      <Badge className="bg-red-500/10 text-red-500 border-none font-black uppercase tracking-widest text-[10px]">
                        {products.filter(p => p.stock < 10).length} ALERTS
                      </Badge>
                    </div>
                    <div className="space-y-4">
                      {products.filter(p => p.stock < 10).slice(0, 4).map((item, idx) => (
                        <div key={`low-stock-${item.id}-${idx}`} className="flex items-center justify-between bg-neutral-950/50 p-4 rounded-2xl border border-white/5">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-xl bg-neutral-800 overflow-hidden">
                                {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Package className="w-full h-full p-2.5 opacity-10" />}
                             </div>
                             <div>
                                <p className="font-bold text-sm text-white">{item.name}</p>
                                <p className="text-[10px] text-neutral-500 uppercase font-black">{item.category}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="font-black text-red-500 text-sm">{item.stock} left</p>
                             <button onClick={() => { setActiveTab('products'); handleEditProduct(item); }} className="text-[8px] font-black uppercase text-orange-600 hover:underline">Restock</button>
                          </div>
                        </div>
                      ))}
                      {products.filter(p => p.stock < 10).length === 0 && (
                        <div className="py-12 text-center opacity-20">
                           <Zap className="w-12 h-12 mx-auto mb-3" />
                           <p className="text-xs font-black uppercase tracking-[0.3em]">All stock stable</p>
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card className="bg-neutral-900/40 border-neutral-800 p-8">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-xl font-black uppercase tracking-tight italic">Live Orders</h3>
                        <p className="text-xs text-neutral-500">Ongoing kitchen & service activity</p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase text-orange-600" onClick={() => setActiveTab('orders')}>View KDS</Button>
                    </div>
                    <div className="space-y-6">
                      {orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').slice(0, 5).map((order, index) => (
                        <div key={`live-order-${order.id}-${index}`} className="flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                               order.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 
                               order.status === 'preparing' ? 'bg-orange-600/10 text-orange-600' :
                               'bg-green-500/10 text-green-500'
                             }`}>
                                <Clock className="w-6 h-6" />
                             </div>
                             <div>
                                <p className="font-bold text-white text-sm">#{order.id?.slice(-6).toUpperCase()}</p>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase">{order.customerName}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <Badge className={`${getStatusColor(order.status)} border-none text-[8px] font-black uppercase tracking-widest px-2`}>{order.status}</Badge>
                             <p className="text-[10px] text-neutral-600 font-bold uppercase mt-1">{format(order.createdAt?.toDate() || new Date(), 'p')}</p>
                          </div>
                        </div>
                      ))}
                      {orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length === 0 && (
                        <div className="py-20 text-center opacity-20">
                           <ShoppingCart className="w-16 h-16 mx-auto mb-4" />
                           <p className="font-black uppercase tracking-[0.5rem] text-xs">Awaiting Orders</p>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Second row of insights */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card className="bg-neutral-900/40 border-neutral-800 p-8">
                    <h3 className="text-xl font-black uppercase tracking-tight italic mb-6">Recent Sales</h3>
                    <div className="space-y-6">
                      {orders.slice(0, 5).map((order, index) => (
                        <div key={`recent-sale-${order.id}-${index}`} className="flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-neutral-800 flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all">
                                <Receipt className="w-6 h-6" />
                             </div>
                             <div>
                                <p className="font-bold text-white text-sm">#{order.id?.slice(-6).toUpperCase()}</p>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase">{order.customerName}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="font-black text-sm text-white">TZS {order.totalAmount.toLocaleString()}</p>
                             <p className="text-[9px] text-neutral-600 font-bold uppercase">{order.paymentMethod}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="bg-neutral-900/40 border-neutral-800 p-8 flex flex-col justify-center items-center text-center">
                    <div className="w-20 h-20 rounded-[2rem] bg-orange-600/10 flex items-center justify-center mb-6">
                      <Store className="w-10 h-10 text-orange-600" />
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tight italic text-white">Upgrade to Pro</h3>
                    <p className="text-neutral-500 text-sm mt-2 max-w-xs">Get advanced analytics, multi-store sync, and priority kitchen routing.</p>
                    <Button className="mt-8 rounded-2xl bg-white text-black hover:bg-neutral-200 h-12 px-8 font-black uppercase tracking-widest text-xs">Learn More</Button>
                  </Card>
                </div>
              </motion.div>
            )}
            {activeTab === 'orders' && ordersTab}

            {activeTab === 'pos' && (
              <motion.div 
                key="pos"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col xl:flex-row gap-8 h-full min-h-[700px] overflow-hidden"
              >
                {/* Product Selection */}
                <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar pr-2">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-3xl font-black italic uppercase italic tracking-tighter">Point of Sale</h2>
                      <p className="text-neutral-500 font-medium">Quick checkout and restaurant service</p>
                    </div>
                    <div className="flex items-center gap-3">
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="bg-neutral-900 border-neutral-800 rounded-xl gap-2 h-11 px-5 font-bold"
                         onClick={() => setIsAddCustomerModalOpen(true)}
                       >
                         <UserPlus className="w-4 h-4 text-orange-600" />
                         Add Customer
                       </Button>
                       <div className="relative w-full md:w-64">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                         <Input placeholder="Search manually..." className="bg-neutral-900 border-neutral-800 pl-10 h-11 rounded-xl text-sm" />
                       </div>
                    </div>
                  </div>

                  {/* Category Selection Carousel */}
                  <div className="flex gap-3 pb-4 overflow-x-auto no-scrollbar">
                    {categories.map((cat, idx) => (
                      <Button
                        key={`pos-cat-${cat}-${idx}`}
                        variant={selectedCategory === cat ? 'default' : 'ghost'}
                        onClick={() => setSelectedCategory(cat)}
                        className={`rounded-2xl px-6 h-12 border border-neutral-800 whitespace-nowrap font-black text-[10px] uppercase tracking-widest transition-all ${
                          selectedCategory === cat 
                            ? 'bg-orange-600 text-white border-orange-600 shadow-xl shadow-orange-900/30 ring-2 ring-orange-600/20' 
                            : 'bg-neutral-900/40 text-neutral-400 hover:text-white hover:bg-neutral-800'
                        }`}
                      >
                        {cat}
                      </Button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProducts.map((product, pIdx) => (
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        key={product.id || `pos-p-${pIdx}`}
                        onClick={() => addToCart(product)}
                        className="bg-neutral-900/40 border border-neutral-800 p-4 rounded-[2.5rem] hover:border-orange-600/50 transition-all text-left flex flex-col group relative overflow-hidden h-full"
                      >
                        <div className="aspect-square rounded-[2rem] bg-neutral-800/50 mb-4 overflow-hidden relative">
                          {product.imageUrl ? (
                            <img 
                              src={product.imageUrl} 
                              alt={product.name} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-600">
                              <Package className="w-12 h-12 opacity-10" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-orange-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                             <div className="bg-white text-black p-3 rounded-2xl shadow-xl">
                                <Plus className="w-6 h-6" />
                             </div>
                          </div>
                        </div>
                        <div className="px-1 mt-auto">
                          <h4 className="font-black text-sm text-white truncate mb-1 italic uppercase tracking-tight">{product.name}</h4>
                          <div className="flex items-center justify-between">
                            <p className="text-orange-500 font-black text-xs">TZS {product.price.toLocaleString()}</p>
                            <span className="text-[9px] text-neutral-600 font-black uppercase tracking-widest bg-neutral-950 px-2 py-0.5 rounded-lg border border-neutral-800">{product.stock} left</span>
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Cart / Invoice Sidebar */}
                <div className="w-full xl:w-[450px] bg-neutral-950 border border-neutral-800 rounded-[3rem] flex flex-col overflow-hidden shadow-2xl relative">
                  <div className="p-8 border-b border-white/5 space-y-8">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-2xl italic flex items-center gap-3">
                        <Smartphone className="w-7 h-7 text-orange-600" /> Order Summary
                      </h3>
                      {posCustomer ? (
                         <div className="flex items-center gap-2 bg-orange-600/10 py-1.5 px-3 rounded-xl">
                            <div className="w-2 h-2 rounded-full bg-orange-600 animate-pulse"></div>
                            <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{posCustomer.name}</span>
                         </div>
                      ) : (
                         <button onClick={() => setIsAddCustomerModalOpen(true)} className="text-[10px] font-black text-neutral-500 hover:text-orange-500 uppercase tracking-widest">Walking Customer</button>
                      )}
                    </div>

                    {/* Order Meta Selection */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 bg-neutral-900/50 p-2 rounded-2xl border border-white/5">
                        {[
                          { id: 'dine_in', label: 'Dine-In', icon: Beer },
                          { id: 'takeaway', label: 'Takeaway', icon: ShoppingBag },
                          { id: 'delivery', label: 'Delivery', icon: Truck },
                        ].map((type, idx) => (
                          <button
                            key={`ot-${type.id}-${idx}`}
                            onClick={() => setOrderType(type.id as any)}
                            className={`flex flex-col items-center justify-center gap-2 py-3 rounded-xl transition-all ${
                              orderType === type.id 
                                ? 'bg-orange-600 text-white shadow-lg' 
                                : 'text-neutral-500 hover:text-white'
                            }`}
                          >
                            <type.icon className="w-4 h-4" />
                            <span className="text-[8px] font-black uppercase tracking-widest">{type.label}</span>
                          </button>
                        ))}
                      </div>

                      {orderType === 'dine_in' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="pt-2"
                        >
                           <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1 block mb-2">Select Table</label>
                           <Select value={tableNumber} onValueChange={setTableNumber}>
                              <SelectTrigger className="bg-neutral-900 border-neutral-800 h-12 rounded-xl font-bold">
                                <SelectValue placeholder="Chagua Meza..." />
                              </SelectTrigger>
                              <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                {tables.map((t, index) => (
                                  <SelectItem key={`${t.id}-${index}`} value={t.number} disabled={t.status !== 'available'}>
                                    Table {t.number} ({t.capacity} seats) - {t.status}
                                  </SelectItem>
                                ))}
                                {tables.length === 0 && <SelectItem value="none" disabled>No tables added yet</SelectItem>}
                              </SelectContent>
                           </Select>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar min-h-[200px]">
                    {cart.map((item, cartIdx) => (
                      <div key={item.product.id || `cart-i-${cartIdx}`} className="flex justify-between items-center group animate-in slide-in-from-right-4 duration-300">
                        <div className="flex gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden relative">
                             {item.product.imageUrl ? (
                               <img src={item.product.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                             ) : (
                               <Package className="w-full h-full p-4 opacity-10" />
                             )}
                          </div>
                          <div className="flex flex-col justify-center">
                             <p className="font-bold text-white text-sm">{item.product.name}</p>
                             <div className="flex items-center gap-3 mt-1">
                                <button onClick={() => {
                                  if(item.quantity > 1) {
                                    setCart(cart.map(i => i.product.id === item.product.id ? {...i, quantity: i.quantity - 1} : i));
                                  } else {
                                    removeFromCart(item.product.id!);
                                  }
                                }} className="p-1 rounded bg-neutral-900 text-neutral-500 hover:bg-orange-600 hover:text-white transition-colors">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                                <span className="text-xs font-black text-orange-500">{item.quantity}</span>
                                <button onClick={() => addToCart(item.product)} className="p-1 rounded bg-neutral-900 text-neutral-500 hover:bg-orange-600 hover:text-white transition-colors">
                                  <Plus className="w-3 h-3" />
                                </button>
                             </div>
                          </div>
                        </div>
                        <div className="text-right">
                           <p className="font-black text-sm text-white">TZS {(item.product.price * item.quantity).toLocaleString()}</p>
                           <button onClick={() => removeFromCart(item.product.id!)} className="text-[8px] font-black uppercase text-neutral-700 hover:text-red-500 mt-1">Remove</button>
                        </div>
                      </div>
                    ))}
                    {cart.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center py-20 opacity-10">
                         <ShoppingCart className="w-16 h-16 mb-4" />
                         <p className="font-black uppercase tracking-[0.5rem] text-xs">Empty Cart</p>
                      </div>
                    )}
                  </div>

                  <div className="p-8 bg-neutral-900/50 border-t border-white/5 space-y-6 mt-auto">
                    <div className="space-y-2">
                       <div className="flex justify-between text-xs font-bold text-neutral-500 uppercase tracking-widest">
                          <span>Sub Total</span>
                          <span className="text-white">TZS {cartTotal.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between text-xs font-bold text-neutral-500 uppercase tracking-widest">
                          <span>TAX (18%)</span>
                          <span className="text-white">TZS {(cartTotal * 0.18).toLocaleString()}</span>
                       </div>
                       <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                          <span className="text-lg font-black uppercase italic tracking-tighter text-white">Total Payable</span>
                          <span className="text-2xl font-black text-orange-600 tracking-tighter">TZS {(cartTotal * 1.18).toLocaleString()}</span>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pb-2">
                       <Button 
                         variant="outline" 
                         className={`rounded-[1.2rem] h-12 border-neutral-800 font-black uppercase text-[10px] tracking-widest ${paymentMethod === 'cash' ? 'bg-orange-600 border-none text-white' : 'bg-neutral-950 text-neutral-500'}`}
                         onClick={() => setPaymentMethod('cash')}
                       >
                         <Banknote className="w-4 h-4 mr-2" /> Cash
                       </Button>
                       <Button 
                         variant="outline" 
                         className={`rounded-[1.2rem] h-12 border-neutral-800 font-black uppercase text-[10px] tracking-widest ${paymentMethod === 'card' ? 'bg-orange-600 border-none text-white' : 'bg-neutral-950 text-neutral-500'}`}
                         onClick={() => setPaymentMethod('card')}
                       >
                         <CreditCard className="w-4 h-4 mr-2" /> Card
                       </Button>
                       <Button 
                         variant="outline" 
                         className={`rounded-[1.2rem] h-12 border-neutral-800 font-black uppercase text-[10px] tracking-widest col-span-2 ${paymentMethod === 'mobile_money' ? 'bg-orange-600 border-none text-white' : 'bg-neutral-950 text-neutral-500'}`}
                         onClick={() => setPaymentMethod('mobile_money')}
                       >
                         <Smartphone className="w-4 h-4 mr-2" /> Mobile Money
                       </Button>
                    </div>

                    <div className="flex gap-4">
                       <Button variant="ghost" className="flex-1 rounded-2xl h-14 font-black uppercase text-[10px] tracking-widest text-neutral-500 hover:text-white transition-all hover:bg-neutral-800" onClick={() => setCart([])}>Cancel</Button>
                       <Button 
                         disabled={cart.length === 0 || isProcessingSale}
                         onClick={handleCompleteSale}
                         className="flex-[2] rounded-2xl h-14 bg-orange-600 hover:bg-orange-700 font-black uppercase text-xs tracking-[0.2rem] shadow-xl shadow-orange-900/30 text-white transition-all active:scale-95"
                       >
                         {isProcessingSale ? 'Processing...' : 'Complete Order'}
                       </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {/* Add Customer Modal */}
            <AnimatePresence>
               {isAddCustomerModalOpen && (
                 <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsAddCustomerModalOpen(false)}
                      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      className="relative w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-[2rem] overflow-hidden shadow-2xl p-6"
                    >
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <UserPlus className="w-5 h-5 text-orange-600" />
                          Add Customer
                        </h3>
                        <button onClick={() => setIsAddCustomerModalOpen(false)} className="text-neutral-500 hover:text-white">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-neutral-500 uppercase">Customer Name</label>
                          <Input 
                            placeholder="Full Name" 
                            className="bg-neutral-800 border-none h-11 rounded-xl"
                            value={newCustomer.name}
                            onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-neutral-500 uppercase">Phone Number</label>
                          <Input 
                            placeholder="+255..." 
                            className="bg-neutral-800 border-none h-11 rounded-xl"
                             value={newCustomer.phone}
                            onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                          />
                        </div>
                        <Button 
                          onClick={() => {
                            setPosCustomer(newCustomer);
                            setIsAddCustomerModalOpen(false);
                            toast.success(`Customer ${newCustomer.name} added!`);
                          }}
                          className="w-full bg-orange-600 hover:bg-orange-700 h-11 rounded-xl font-bold mt-4"
                        >
                          Confirm Customer
                        </Button>
                      </div>
                    </motion.div>
                 </div>
               )}
            </AnimatePresence>

            {activeTab === 'coupons' && (
              <motion.div 
                key="coupons"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter">Promotions</h2>
                    <p className="text-neutral-500 font-medium">Create and manage high-conversion discount codes</p>
                  </div>
                  <Button 
                    onClick={() => setIsAddCouponOpen(true)}
                    className="bg-orange-600 hover:bg-orange-700 rounded-2xl h-12 px-6 font-black uppercase tracking-widest text-[10px] shadow-xl shadow-orange-900/30 text-white"
                  >
                    <Zap className="w-4 h-4 mr-2" /> Launch New Coupon
                  </Button>
                </div>

                {isAddCouponOpen && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-neutral-900/60 border-2 border-orange-600/30 p-8 rounded-[2.5rem] relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-8">
                       <Gift className="w-24 h-24 text-orange-600/5 rotate-12" />
                    </div>
                    <form onSubmit={handleAddCoupon} className="relative z-10 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Campaign Code</label>
                           <Input 
                             placeholder="e.g. SUMMER25" 
                             className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-black text-white italic placeholder:not-italic"
                             value={newCoupon.code}
                             onChange={e => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})}
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Discount Config</label>
                           <div className="flex gap-3">
                              <Select value={newCoupon.discountType} onValueChange={val => setNewCoupon({...newCoupon, discountType: val as any})}>
                                 <SelectTrigger className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold flex-1">
                                    <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent className="bg-neutral-900 border-neutral-800 text-white border-neutral-700 shadow-2xl">
                                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                                    <SelectItem value="fixed">Fixed (TZS)</SelectItem>
                                 </SelectContent>
                              </Select>
                              <Input 
                                type="number" 
                                placeholder="Value" 
                                className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-black text-orange-600 w-32"
                                value={newCoupon.discountValue}
                                onChange={e => setNewCoupon({...newCoupon, discountValue: Number(e.target.value)})}
                              />
                           </div>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Product Scope</label>
                           <Select value={newCoupon.productId || 'all'} onValueChange={val => setNewCoupon({...newCoupon, productId: val === 'all' ? null : val})}>
                              <SelectTrigger className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold">
                                 <SelectValue placeholder="Universal Discount" />
                              </SelectTrigger>
                              <SelectContent className="bg-neutral-900 border-neutral-800 text-white border-neutral-700 shadow-2xl">
                                 <SelectItem value="all">Apply to All Products</SelectItem>
                                {products.map(p => <SelectItem key={`coupon-p-${p.id}`} value={p.id!}>{p.name}</SelectItem>)}
                              </SelectContent>
                           </Select>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <Button type="submit" className="flex-1 bg-white text-black hover:bg-neutral-200 h-14 rounded-2xl font-black uppercase tracking-widest text-xs">Activate Promotion</Button>
                        <Button type="button" variant="ghost" className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] text-neutral-500" onClick={() => setIsAddCouponOpen(false)}>Discard</Button>
                      </div>
                    </form>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {coupons.map((coupon, index) => (
                    <motion.div 
                      key={`${coupon.id}-${index}`}
                      whileHover={{ scale: 1.02 }}
                      className="bg-neutral-900/40 border border-neutral-800 rounded-[2.5rem] p-8 relative group overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="flex gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => handleDeleteCoupon(coupon.id!)}>
                               <Trash2 className="w-4 h-4" />
                            </Button>
                         </div>
                      </div>

                      <div className="flex items-start justify-between mb-8">
                         <div className="space-y-1">
                            <span className="text-[9px] font-black italic uppercase tracking-[0.2em] text-orange-600">Active Campaign</span>
                            <h3 className="text-3xl font-black text-white italic tracking-tighter">{coupon.code}</h3>
                         </div>
                         <div className="p-4 rounded-2xl bg-orange-600/10 text-orange-600">
                            <Zap className="w-6 h-6" />
                         </div>
                      </div>

                      <div className="space-y-4">
                         <div className="flex justify-between items-end">
                            <div>
                               <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Discount</p>
                               <p className="text-2xl font-black text-white">
                                  {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `TZS ${coupon.discountValue?.toLocaleString()}`}
                               </p>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Usage</p>
                               <p className="text-sm font-black text-neutral-400">{coupon.usageCount || 0} Redeemed</p>
                            </div>
                         </div>
                         <div className="pt-6 border-t border-neutral-800 flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                            <span className="text-neutral-600">Expires: {coupon.expiryDate ? format(new Date(coupon.expiryDate), 'MMM d, yyyy') : 'Never'}</span>
                            <span className={`px-3 py-1 rounded-full ${coupon.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                               {coupon.status}
                            </span>
                         </div>
                      </div>
                    </motion.div>
                  ))}

                  {coupons.length === 0 && !isAddCouponOpen && (
                    <div className="col-span-full py-32 text-center bg-neutral-900/20 rounded-[3rem] border border-dashed border-neutral-800">
                       <Tag className="w-20 h-20 text-neutral-800 mx-auto mb-6" />
                       <h3 className="text-xl font-black text-white italic uppercase mb-2">No Active Coupons</h3>
                       <p className="text-neutral-500 text-sm max-w-xs mx-auto">Create promotional codes to drive sales and reward your loyal customers.</p>
                       <Button onClick={() => setIsAddCouponOpen(true)} variant="link" className="mt-4 text-orange-500 font-bold uppercase tracking-widest text-[10px]">Launch First Campaign</Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'tables' && (
              <motion.div 
                key="tables"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter">Dining Area</h2>
                    <p className="text-neutral-500 font-medium">Manage tables, status, and QR code assignments</p>
                  </div>
                  <Button 
                    onClick={() => setIsAddTableOpen(true)}
                    className="bg-orange-600 hover:bg-orange-700 rounded-2xl h-12 px-6 font-black uppercase tracking-widest text-[10px] shadow-xl shadow-orange-900/30 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add New Table
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {tables.map((table, index) => (
                    <motion.div 
                      key={`${table.id}-${index}`}
                      whileHover={{ y: -5 }}
                      className="bg-neutral-900/40 border border-neutral-800 rounded-[2.5rem] p-6 relative overflow-hidden group"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className={`p-4 rounded-2xl ${
                          table.status === 'available' ? 'bg-green-500/10 text-green-500' : 
                          table.status === 'occupied' ? 'bg-orange-600/10 text-orange-600 animate-pulse' : 
                          'bg-neutral-800 text-neutral-500'
                        }`}>
                          <Store className="w-6 h-6" />
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white">
                              <MoreVertical className="w-4 h-4" />
                           </Button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-2xl font-black text-white italic">Table {table.number}</h3>
                        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{table.capacity} Seats • {table.status}</p>
                      </div>

                      <div className="mt-8 flex items-center justify-between">
                         <div className="p-3 bg-white rounded-xl">
                            <QrCode className="w-8 h-8 text-black" />
                         </div>
                         <Button 
                           variant="ghost" 
                           className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-400"
                           onClick={() => {
                             if (!vendorProfile?.id) {
                               toast.error("Taarifa za duka bado hazijapakuliwa. Tafadhali subiri.");
                               return;
                             }
                             setSelectedTable(table);
                             setQrOptions(prev => ({
                               ...prev,
                               data: `${window.location.origin}/table/${vendorProfile.id}/${table.number}`
                             }));
                             setIsQrBuilderOpen(true);
                           }}
                         >
                            Download QR
                         </Button>
                      </div>

                      {/* Status Overlay for Occupied */}
                      {table.status === 'occupied' && (
                        <div className="absolute top-0 right-0 p-4">
                           <div className="flex items-center gap-1.5 bg-orange-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-full text-white">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                              </span>
                              Live Order
                           </div>
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {tables.length === 0 && (
                    <div className="col-span-full py-32 text-center bg-neutral-900/20 rounded-[3rem] border border-dashed border-neutral-800">
                       <QrCode className="w-20 h-20 text-neutral-800 mx-auto mb-6" />
                       <h3 className="text-xl font-black text-white italic uppercase mb-2">No Tables Found</h3>
                       <p className="text-neutral-500 text-sm max-w-xs mx-auto">Add your restaurant tables to manage dining orders and generate QR codes for customers.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'customers' && (
              <motion.div 
                key="customers"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter">CRM & Loyalty</h2>
                    <p className="text-neutral-500 font-medium">Build relationships and track customer lifetime value</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      className="bg-neutral-900 border-neutral-800 rounded-2xl h-12 px-6 font-black uppercase tracking-widest text-[10px] text-neutral-400 hover:text-white"
                    >
                      <Download className="w-4 h-4 mr-2" /> Export CRM
                    </Button>
                    <Button 
                      onClick={() => setIsAddCustomerModalOpen(true)}
                      className="bg-orange-600 hover:bg-orange-700 rounded-2xl h-12 px-6 font-black uppercase tracking-widest text-[10px] shadow-xl shadow-orange-900/30 text-white"
                    >
                      <UserPlus className="w-4 h-4 mr-2" /> Add Customer
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-neutral-900/40 p-3 rounded-[2rem] border border-neutral-800">
                   <div className="md:col-span-2 relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <Input placeholder="Search by name or phone..." className="bg-neutral-950 border-neutral-800 h-12 rounded-2xl pl-11 text-sm text-white" />
                   </div>
                   <Button variant="outline" className="bg-neutral-950 border-neutral-800 h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] text-neutral-400">
                      <Filter className="w-4 h-4 mr-2" /> Advanced Filters
                   </Button>
                </div>

                <div className="bg-neutral-900/20 border border-neutral-800 rounded-[3rem] overflow-hidden">
                   <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-neutral-800 bg-neutral-900/50">
                             <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Customer Profile</th>
                             <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Orders</th>
                             <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-center">Total Spent</th>
                             <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/50">
                          {Array.from(new Set(orders.map(o => o.customerPhone || o.customerId))).filter(id => id).map((cId, index) => {
                             const customerOrders = orders.filter(o => (o.customerPhone || o.customerId) === cId);
                             const name = customerOrders[0]?.customerName || `Loyal Guest ${cId?.toString().slice(-4)}`;
                             const phone = customerOrders[0]?.customerPhone || 'PRIVATE';
                             const totalSpent = customerOrders.reduce((sum, o) => sum + o.totalAmount, 0);

                             return (
                               <tr key={`crm-row-${cId}-${totalSpent}-${index}`} className="hover:bg-neutral-800/20 transition-all group">
                                  <td className="px-8 py-6">
                                     <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-orange-600/10 flex items-center justify-center border border-orange-600/20">
                                           <User className="w-6 h-6 text-orange-600" />
                                        </div>
                                        <div>
                                           <p className="font-black text-white text-md uppercase tracking-tight italic">{name}</p>
                                           <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-wider">{phone}</p>
                                        </div>
                                     </div>
                                  </td>
                                  <td className="px-8 py-6">
                                     <span className="px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-[10px] font-black text-neutral-400 uppercase tracking-widest">{customerOrders.length} Orders</span>
                                  </td>
                                  <td className="px-8 py-6 text-center">
                                     <p className="font-black text-white">TZS {totalSpent.toLocaleString()}</p>
                                  </td>
                                  <td className="px-8 py-6 text-right">
                                     <div className="flex items-center justify-end gap-2">
                                        <Button variant="ghost" size="icon" className="h-10 w-10 bg-neutral-900 rounded-xl text-neutral-400 hover:text-white">
                                           <Receipt className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-10 w-10 bg-neutral-950/50 rounded-xl text-neutral-600 hover:text-orange-600 hover:bg-neutral-900">
                                           <MoreVertical className="w-4 h-4" />
                                        </Button>
                                     </div>
                                  </td>
                               </tr>
                             );
                          })}
                          {orders.filter(o => o.customerPhone || o.customerId).length === 0 && (
                             <tr>
                                <td colSpan={4} className="px-8 py-32 text-center bg-neutral-900/10">
                                   <Users className="w-20 h-20 text-neutral-800 mx-auto mb-6" />
                                   <h3 className="text-xl font-black text-white italic uppercase mb-2">No Customer Data</h3>
                                   <p className="text-neutral-400 text-sm max-w-xs mx-auto">Start recording customer details during checkout to build your CRM database.</p>
                                </td>
                             </tr>
                          )}
                        </tbody>
                     </table>
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-black text-white">Duka Settings</h2>
                    <p className="text-neutral-500 font-medium">Manage your store profile, appearance, and contact info</p>
                  </div>
                  <Button 
                    form="settings-form"
                    type="submit" 
                    disabled={isSavingSettings}
                    className="h-14 px-8 bg-orange-600 hover:bg-orange-700 font-black rounded-2xl shadow-xl shadow-orange-950/30 gap-3"
                  >
                    {isSavingSettings ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    Save Changes
                  </Button>
                </div>

                <form id="settings-form" onSubmit={handleUpdateSettings} className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
                  <div className="lg:col-span-2 space-y-6">
                    <Card className="bg-neutral-900 border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl p-8 space-y-8">
                      <div className="space-y-6">
                        <div className="flex items-center gap-4 text-orange-600">
                          <Store className="w-6 h-6" />
                          <h3 className="font-black text-xl">Basic Information</h3>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Store Name / Jina la Duka</label>
                          <Input 
                            value={updatedProfile.businessName}
                            onChange={e => setUpdatedProfile({...updatedProfile, businessName: e.target.value})}
                            className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl text-lg font-bold"
                            placeholder="e.g. Mama Ntilie Restaurant"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Description / Maelezo</label>
                          <textarea 
                            value={updatedProfile.description}
                            onChange={e => setUpdatedProfile({...updatedProfile, description: e.target.value})}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-4 text-sm font-medium text-white min-h-[120px] focus:ring-2 focus:ring-orange-600 focus:outline-none transition-all"
                            placeholder="Brief details about your store..."
                          />
                        </div>
                      </div>

                      <div className="space-y-6 pt-6 border-t border-neutral-800">
                        <div className="flex items-center gap-4 text-orange-600">
                          <MapPin className="w-6 h-6" />
                          <h3 className="font-black text-xl">Location & Contact</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Address / Sehemu Ilipo</label>
                            <Input 
                              value={updatedProfile.address}
                              onChange={e => setUpdatedProfile({...updatedProfile, address: e.target.value})}
                              className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold"
                              placeholder="e.g. Kariakoo, Dar es Salaam"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Phone / Namba ya Simu</label>
                            <Input 
                              value={updatedProfile.phoneNumber}
                              onChange={e => setUpdatedProfile({...updatedProfile, phoneNumber: e.target.value})}
                              className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold"
                              placeholder="+255..."
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="bg-neutral-900 border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl p-8 space-y-8">
                       <div className="flex items-center gap-4 text-orange-600">
                          <Clock className="w-6 h-6" />
                          <h3 className="font-black text-xl">Opening Hours</h3>
                        </div>
                        <Input 
                          value={updatedProfile.operatingHours}
                          onChange={e => setUpdatedProfile({...updatedProfile, operatingHours: e.target.value})}
                          className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold"
                          placeholder="e.g. 8:00 AM - 10:00 PM"
                        />
                    </Card>
                  </div>

                  <div className="space-y-8">
                    <Card className="bg-neutral-900 border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl p-8 space-y-6">
                      <div className="flex items-center gap-4 text-orange-600">
                        <Camera className="w-6 h-6" />
                        <h3 className="font-black text-xl">Branding</h3>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-3 text-center">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Logo / Picha ya Duka</label>
                          <div className="relative group mx-auto w-32 h-32">
                            <div className="w-full h-full rounded-[2.5rem] bg-neutral-950 border-2 border-dashed border-neutral-800 overflow-hidden flex items-center justify-center">
                              {updatedProfile.logoUrl ? (
                                <img src={updatedProfile.logoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <Store className="w-10 h-10 text-neutral-700" />
                              )}
                            </div>
                            <Button
                              type="button" 
                              variant="ghost" 
                              size="icon"
                              className="absolute -bottom-2 -right-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl h-10 w-10 shadow-lg"
                              onClick={() => {
                                const url = prompt('Enter Logo URL:');
                                if (url) setUpdatedProfile({...updatedProfile, logoUrl: url});
                              }}
                            >
                              <Plus className="w-5 h-5" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1 text-center block">Banner Image / Picha ya Juu</label>
                          <div className="relative group aspect-video rounded-3xl bg-neutral-950 border-2 border-dashed border-neutral-800 overflow-hidden flex items-center justify-center">
                            {updatedProfile.bannerUrl ? (
                              <img src={updatedProfile.bannerUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Camera className="w-8 h-8 text-neutral-700" />
                            )}
                            <Button
                              type="button" 
                              variant="ghost" 
                              size="icon"
                              className="absolute bottom-3 right-3 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white rounded-xl h-10 w-10 shadow-lg"
                              onClick={() => {
                                const url = prompt('Enter Banner URL:');
                                if (url) setUpdatedProfile({...updatedProfile, bannerUrl: url});
                              }}
                            >
                              <Plus className="w-5 h-5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-red-500/5 border-red-500/10 rounded-[2.5rem] overflow-hidden p-8 space-y-6">
                       <div className="flex items-center gap-4 text-red-500">
                        <Trash2 className="w-6 h-6" />
                        <h3 className="font-black text-xl">Danger Zone</h3>
                      </div>
                      <p className="text-xs text-red-500/60 font-medium">Hapa unaweza kusitisha duka lako kwa muda. Hatua hii itaficha bidhaa zako sokoni.</p>
                      <Button variant="ghost" className="w-full h-14 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl font-black">
                        Deactivate Store
                      </Button>
                    </Card>
                  </div>
                </form>
              </motion.div>
            )}

            {activeTab === 'products' && (
              <motion.div 
                key="products"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter">Inventory Control</h2>
                    <p className="text-neutral-500 font-medium">Manage your products and stock levels</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      className="bg-neutral-900 border-neutral-800 rounded-2xl h-12 px-6 font-black uppercase tracking-widest text-[10px] text-neutral-400 hover:text-white"
                    >
                      <Download className="w-4 h-4 mr-2" /> Bulk Export
                    </Button>
                    <Button 
                      onClick={() => setIsAddProductOpen(true)}
                      className="bg-orange-600 hover:bg-orange-700 rounded-2xl h-12 px-6 font-black uppercase tracking-widest text-[10px] shadow-xl shadow-orange-900/30 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add New Item
                    </Button>
                  </div>
                </div>

                {/* Search and Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-neutral-900/40 p-3 rounded-[2rem] border border-neutral-800">
                   <div className="md:col-span-2 relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <Input 
                        placeholder="Search by name or SKU..." 
                        className="bg-neutral-950 border-neutral-800 h-12 rounded-2xl pl-11 text-sm text-white" 
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                      />
                   </div>
                   <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="bg-neutral-950 border-neutral-800 h-12 rounded-2xl font-bold">
                         <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                         {categories.map((c, idx) => <SelectItem key={`inventory-cat-${c}-${idx}`} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                   </Select>
                   <Select value={stockLevelFilter} onValueChange={setStockLevelFilter}>
                      <SelectTrigger className="bg-neutral-950 border-neutral-800 h-12 rounded-2xl font-bold">
                         <SelectValue placeholder="Stock Level" />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                         <SelectItem value="all">All Items</SelectItem>
                         <SelectItem value="low">Low Stock</SelectItem>
                         <SelectItem value="out">Out of Stock</SelectItem>
                      </SelectContent>
                   </Select>
                </div>

                <div className="bg-neutral-900/20 border border-neutral-800 rounded-[3rem] overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-900/50">
                        <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Product Information</th>
                        <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Category</th>
                        <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-center">Price</th>
                        <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-center">Stock Level</th>
                        <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/50">
                      {filteredInventory.map((product, index) => (
                        <tr key={`${product.id}-${index}`} className="hover:bg-neutral-800/20 transition-all group">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-16 h-16 rounded-[1.5rem] bg-neutral-900 overflow-hidden relative border border-neutral-800 group-hover:border-orange-600/50 transition-all">
                                 {product.imageUrl ? (
                                   <img src={product.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                 ) : (
                                   <Package className="w-full h-full p-4 opacity-10" />
                                 )}
                              </div>
                              <div>
                                 <p className="font-black text-white text-md uppercase tracking-tight italic">{product.name}</p>
                                 <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-wider">SKU: {product.id?.slice(0, 8).toUpperCase()}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                             <span className="px-4 py-1.5 bg-neutral-900 border border-neutral-800 rounded-full text-[10px] font-black text-neutral-400 uppercase tracking-widest">{product.category}</span>
                          </td>
                          <td className="px-8 py-6 text-center">
                             <p className="font-black text-orange-500">TZS {product.price.toLocaleString()}</p>
                          </td>
                          <td className="px-8 py-6">
                             <div className="flex flex-col items-center gap-2">
                                <div className="w-24 h-1.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                                   <div 
                                     className={`h-full rounded-full transition-all duration-1000 ${
                                       product.stock < 10 ? 'bg-red-500' : product.stock < 50 ? 'bg-yellow-500' : 'bg-green-500'
                                     }`}
                                     style={{ width: `${Math.min(100, (product.stock / 200) * 100)}%` }}
                                   ></div>
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${
                                  product.stock < 10 ? 'text-red-500' : 'text-neutral-500'
                                }`}>
                                   {product.stock} units
                                </span>
                             </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                             <div className="flex items-center justify-end gap-2">
                                <Button variant="ghost" size="icon" className="h-10 w-10 bg-neutral-900 rounded-xl text-neutral-400 hover:text-white" onClick={() => handleEditProduct(product)}>
                                   <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-10 w-10 bg-neutral-950/50 rounded-xl text-neutral-600 hover:text-red-500 hover:bg-neutral-900" onClick={() => handleDeleteProduct(product.id!)}>
                                   <Trash2 className="w-4 h-4" />
                                </Button>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Add Product Modal */}
      <AnimatePresence>
        {isAddProductOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddProductOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-bold">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
                  <p className="text-xs text-neutral-500 font-medium">{editingProduct ? 'Hariri Bidhaa' : 'Ongeza Bidhaa Mpya'}</p>
                </div>
                <button 
                  onClick={() => {
                    setIsAddProductOpen(false);
                    setEditingProduct(null);
                  }} 
                  className="text-neutral-500 hover:text-white p-2"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleAddProduct} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                {/* Image Upload Section */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Product Images / Picha za Bidhaa</label>
                  
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    <AnimatePresence mode="popLayout">
                      {newProduct.imageUrls?.map((url, idx) => url && (
                        <motion.div 
                          key={`np-img-${idx}-${url.slice(-20)}`}
                          layout
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="aspect-square rounded-2xl bg-neutral-800 border border-neutral-700 overflow-hidden relative group"
                        >
                          <img 
                            src={url} 
                            alt={`Preview ${idx}`} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newUrls = newProduct.imageUrls?.filter((_, i) => i !== idx);
                              setNewProduct({
                                ...newProduct, 
                                imageUrls: newUrls,
                                imageUrl: newUrls?.[0] || ''
                              });
                            }}
                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          {idx === 0 && (
                            <div className="absolute bottom-0 inset-x-0 bg-orange-600 text-[8px] font-bold text-center py-0.5 uppercase">
                              Main
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {isUploading && (
                      <div className="aspect-square rounded-2xl bg-neutral-800 border border-orange-600/50 flex flex-col items-center justify-center p-2 relative">
                        <div className="relative w-10 h-10 mb-1">
                          <svg className="w-full h-full" viewBox="0 0 36 36">
                            <path
                              className="text-neutral-700"
                              strokeDasharray="100, 100"
                              stroke="currentColor"
                              strokeWidth="3"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                              className="text-orange-600 transition-all duration-300"
                              strokeDasharray={`${uploadProgress}, 100`}
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[8px] font-bold">{Math.round(uploadProgress)}%</span>
                          </div>
                        </div>
                        <span className="text-[8px] text-neutral-500 font-bold uppercase">Uploading...</span>
                      </div>
                    )}

                    <button 
                      type="button"
                      onDragOver={onDragOver}
                      onDrop={onDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-2xl bg-neutral-800 border-2 border-dashed border-neutral-700 hover:border-orange-600 hover:text-orange-600 flex flex-col items-center justify-center text-neutral-500 transition-all group"
                    >
                      <Plus className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-bold uppercase text-center px-1">Add Image</span>
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <Input 
                      className="bg-neutral-800 border-none h-11 rounded-xl text-xs"
                      placeholder="Or paste Image URL here..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value;
                          const srcMatch = val.match(/src=["']([^"']+)["']/);
                          const cleanUrl = srcMatch ? srcMatch[1] : val.trim();
                          if (cleanUrl) {
                            setNewProduct(prev => ({
                              ...prev,
                              imageUrls: [...(prev.imageUrls || []), cleanUrl],
                              imageUrl: prev.imageUrl || cleanUrl
                            }));
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      multiple
                      accept="image/*"
                      onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                    />
                  </div>
                  <p className="text-[10px] text-neutral-500 italic">
                    Drag and drop multiple images or click to upload. First image will be the main one.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Product Name / Jina la Bidhaa</label>
                  <Input 
                    required 
                    className="bg-neutral-800 border-none h-12 rounded-xl"
                    value={newProduct.name}
                    onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                    placeholder="e.g. Paracetamol 500mg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Price / Bei (TZS)</label>
                    <Input 
                      type="number"
                      required 
                      className="bg-neutral-800 border-none h-12 rounded-xl"
                      value={newProduct.price}
                      onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Stock / Kiasi Kilichopo</label>
                    <Input 
                      type="number"
                      required 
                      className="bg-neutral-800 border-none h-12 rounded-xl"
                      value={newProduct.stock}
                      onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Category / Aina</label>
                  <Input 
                    required 
                    className="bg-neutral-800 border-none h-12 rounded-xl"
                    value={newProduct.category}
                    onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                    placeholder="e.g. Pain Relief"
                  />
                </div>

                {/* Dynamic Fields based on Vendor Category */}
                {vendorProfile?.category === 'pharmacy' && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-500 uppercase">Expiry Date / Tarehe ya Kuisha</label>
                      <Input 
                        type="date"
                        className="bg-neutral-800 border-none h-12 rounded-xl"
                        value={newProduct.expiryDate}
                        onChange={e => setNewProduct({...newProduct, expiryDate: e.target.value})}
                      />
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-neutral-800/50 rounded-xl border border-neutral-800">
                      <input 
                        type="checkbox"
                        id="prescription"
                        className="w-5 h-5 rounded border-neutral-700 bg-neutral-800 text-orange-600 focus:ring-orange-600"
                        checked={newProduct.medicationType === 'prescription'}
                        onChange={e => setNewProduct({...newProduct, medicationType: e.target.checked ? 'prescription' : 'otc'})}
                      />
                      <label htmlFor="prescription" className="text-sm font-medium text-white cursor-pointer">
                        Requires Prescription? / Inahitaji Cheti?
                      </label>
                    </div>
                  </div>
                )}

                {(vendorProfile?.category === 'grocery' || vendorProfile?.category === 'restaurant' || vendorProfile?.category === 'ecommerce') && (
                  <div className="space-y-6 pt-2">
                    {/* Variations / Sizes */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Ukubwa / Sizes (e.g. Large, Small)</label>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] font-bold text-orange-600 hover:bg-orange-600/10"
                          onClick={() => setNewProduct({
                            ...newProduct, 
                            variations: [...(newProduct.variations || []), { name: '', price: 0 }]
                          })}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Ongeza Ukubwa
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {newProduct.variations?.map((v, idx) => (
                          <div key={`var-edit-${idx}`} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1">
                            <Input 
                              className="flex-1 bg-neutral-800 border-none h-10 rounded-xl text-sm"
                              placeholder="Jina (mfano: Kubwa)"
                              value={v.name}
                              onChange={e => {
                                const newVars = [...(newProduct.variations || [])];
                                newVars[idx].name = e.target.value;
                                setNewProduct({...newProduct, variations: newVars});
                              }}
                            />
                            <Input 
                              type="number"
                              className="w-24 bg-neutral-800 border-none h-10 rounded-xl text-sm"
                              placeholder="Bei (+)"
                              value={v.price}
                              onChange={e => {
                                const newVars = [...(newProduct.variations || [])];
                                newVars[idx].price = parseFloat(e.target.value);
                                setNewProduct({...newProduct, variations: newVars});
                              }}
                            />
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-10 w-10 text-red-500 hover:bg-red-500/10 rounded-xl"
                              onClick={() => {
                                const newVars = newProduct.variations?.filter((_, i) => i !== idx);
                                setNewProduct({...newProduct, variations: newVars});
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        {(!newProduct.variations || newProduct.variations.length === 0) && (
                          <p className="text-[10px] text-neutral-600 italic">Hakuna ukubwa uliowekwa. Bonyeza ongeza ikiwa bidhaa ina saizi tofauti.</p>
                        )}
                      </div>
                    </div>

                    {/* Add-ons / Vionjo */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Vionjo / Add-ons (e.g. Soda, Pilipili)</label>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] font-bold text-orange-600 hover:bg-orange-600/10"
                          onClick={() => setNewProduct({
                            ...newProduct, 
                            addOns: [...(newProduct.addOns || []), { name: '', price: 0 }]
                          })}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Ongeza Kionjo
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {newProduct.addOns?.map((a, idx) => (
                          <div key={`addon-edit-${idx}`} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1">
                            <Input 
                              className="flex-1 bg-neutral-800 border-none h-10 rounded-xl text-sm"
                              placeholder="Jina (mfano: Soda)"
                              value={a.name}
                              onChange={e => {
                                const newAddons = [...(newProduct.addOns || [])];
                                newAddons[idx].name = e.target.value;
                                setNewProduct({...newProduct, addOns: newAddons});
                              }}
                            />
                            <Input 
                              type="number"
                              className="w-24 bg-neutral-800 border-none h-10 rounded-xl text-sm"
                              placeholder="Bei"
                              value={a.price}
                              onChange={e => {
                                const newAddons = [...(newProduct.addOns || [])];
                                newAddons[idx].price = parseFloat(e.target.value);
                                setNewProduct({...newProduct, addOns: newAddons});
                              }}
                            />
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-10 w-10 text-red-500 hover:bg-red-500/10 rounded-xl"
                              onClick={() => {
                                const newAddons = newProduct.addOns?.filter((_, i) => i !== idx);
                                setNewProduct({...newProduct, addOns: newAddons});
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        {(!newProduct.addOns || newProduct.addOns.length === 0) && (
                          <p className="text-[10px] text-neutral-600 italic">Hakuna vionjo vilivyowekwa. Bonyeza ongeza ikiwa unataka kutoa chaguzi za ziada.</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-500 uppercase">Unit / Kipimo</label>
                      <Select 
                        value={newProduct.unit} 
                        onValueChange={val => setNewProduct({...newProduct, unit: val})}
                      >
                        <SelectTrigger className="bg-neutral-800 border-none h-12 rounded-xl">
                          <SelectValue placeholder="Select Unit" />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                          <SelectItem value="kg">Kilogram (Kg)</SelectItem>
                          <SelectItem value="pcs">Piece (Pcs)</SelectItem>
                          <SelectItem value="pack">Pack</SelectItem>
                          <SelectItem value="ltr">Litre (Ltr)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Description / Maelezo</label>
                  <Input 
                    required 
                    className="bg-neutral-800 border-none h-12 rounded-xl"
                    value={newProduct.description}
                    onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                    placeholder="Brief details about the product"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  {editingProduct && (
                    <Button 
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setIsAddProductOpen(false);
                        handleDeleteProduct(editingProduct.id!);
                      }}
                      className="h-14 px-6 text-red-500 hover:bg-red-500/10 rounded-2xl font-bold"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  )}
                  <Button 
                    type="submit" 
                    disabled={isUploading}
                    className="flex-1 h-14 bg-orange-600 hover:bg-orange-700 text-lg font-bold rounded-2xl shadow-lg shadow-orange-900/20"
                  >
                    {editingProduct ? 'Update Product' : 'Save Product'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl p-8 text-center"
            >
              <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Futa Bidhaa?</h3>
              <p className="text-neutral-400 text-sm mb-8">
                Je, una uhakika unataka kufuta bidhaa hii? Hatua hii haiwezi kurudishwa.
              </p>
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={confirmDeleteProduct}
                  className="w-full h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-red-900/20"
                >
                  Ndiyo, Futa
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="w-full h-14 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-2xl font-bold"
                >
                  Ghairi
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Order Confirmation Modal */}
      <AnimatePresence>
        {isDeleteOrderModalOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteOrderModalOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl p-8 text-center"
            >
              <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Futa Oda?</h3>
              <p className="text-neutral-400 text-sm mb-8">
                Je, una uhakika unataka kufuta oda hii? Hatua hii haiwezi kurudishwa.
              </p>
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={confirmDeleteOrder}
                  className="w-full h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-red-900/20"
                >
                  Ndiyo, Futa
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => setIsDeleteOrderModalOpen(false)}
                  className="w-full h-14 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-2xl font-bold"
                >
                  Ghairi
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Table Modal */}
      <AnimatePresence>
        {isAddTableOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddTableOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-[2rem] overflow-hidden shadow-2xl p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Plus className="w-5 h-5 text-orange-600" />
                  Add New Table
                </h3>
                <button onClick={() => setIsAddTableOpen(false)} className="text-neutral-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleAddTable} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Table Number</label>
                  <Input 
                    required
                    placeholder="e.g. 1" 
                    className="bg-neutral-800 border-none h-11 rounded-xl"
                    value={newTable.number}
                    onChange={e => setNewTable({...newTable, number: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Seating Capacity</label>
                  <Input 
                    type="number"
                    required
                    placeholder="e.g. 4" 
                    className="bg-neutral-800 border-none h-11 rounded-xl"
                    value={newTable.capacity}
                    onChange={e => setNewTable({...newTable, capacity: parseInt(e.target.value)})}
                  />
                </div>
                <Button 
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-700 h-11 rounded-xl font-bold mt-4"
                >
                  Create Table
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Builder Modal */}
      <AnimatePresence>
        {isQrBuilderOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsQrBuilderOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-5xl bg-[#0F0F11] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0 bg-black/20">
                <div>
                  <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                    Qr Builder {selectedTable && <span className="text-orange-600">— Table {selectedTable.number}</span>}
                  </h3>
                  <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">
                    {selectedTable ? `Design for ${selectedTable.number}` : 'Customize your digital experience'}
                  </p>
                </div>
                <button 
                  onClick={() => setIsQrBuilderOpen(false)} 
                  className="text-white bg-white/5 hover:bg-white/10 p-3 rounded-2xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                {/* Options Panel */}
                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar border-r border-white/5 bg-black/40">
                  
                  {/* QR Data Preview */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Target URL / Link ya Menu</label>
                    <div className="bg-neutral-900 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                       <LinkIcon className="w-4 h-4 text-orange-600 shrink-0" />
                       <p className="text-[10px] font-mono text-neutral-400 break-all">{qrOptions.data || 'Hakuna Link...'}</p>
                    </div>
                  </div>

                  {/* QR Block Style */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Qr Block Style / Aina ya Michoro</label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      {(['square', 'dots', 'rounded', 'extra-rounded', 'classy', 'classy-rounded'] as DotType[]).map((type) => (
                        <button
                          key={type}
                          onClick={() => setQrOptions({ ...qrOptions, dotsOptions: { ...qrOptions.dotsOptions, type } })}
                          className={`aspect-square rounded-2xl border transition-all flex flex-col items-center justify-center gap-2 ${
                            qrOptions.dotsOptions.type === type 
                              ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-950/20' 
                              : 'bg-neutral-900 border-white/5 text-neutral-500 hover:border-white/20'
                          }`}
                        >
                          <div className={`w-8 h-8 border-2 border-current rounded-sm flex flex-wrap p-1 gap-1 overflow-hidden opacity-80`}>
                             {Array.from({length: 4}).map((_, i) => (
                               <div key={i} className={`w-2 h-2 bg-current ${
                                 type === 'dots' ? 'rounded-full' : 
                                 type === 'rounded' ? 'rounded-sm' : 
                                 'rounded-none'
                               }`}></div>
                             ))}
                          </div>
                          <span className="text-[8px] font-black uppercase tracking-widest">{type.replace('-', ' ')}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Eye Style */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Eye Style / Aina ya Kona</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(['square', 'dot', 'extra-rounded'] as CornerSquareType[]).map((type) => (
                        <button
                          key={type}
                          onClick={() => setQrOptions({ 
                            ...qrOptions, 
                            cornersSquareOptions: { ...qrOptions.cornersSquareOptions, type },
                            cornersDotOptions: { ...qrOptions.cornersDotOptions, type: type === 'extra-rounded' ? 'dot' : type as any }
                          })}
                          className={`h-14 rounded-2xl border transition-all flex items-center justify-center gap-3 ${
                            qrOptions.cornersSquareOptions.type === type 
                              ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-950/20' 
                              : 'bg-neutral-900 border-white/5 text-neutral-500 hover:border-white/20'
                          }`}
                        >
                          <div className={`w-6 h-6 border-2 border-current flex items-center justify-center ${
                             type === 'dot' ? 'rounded-full' : 
                             type === 'extra-rounded' ? 'rounded-lg' : 
                             'rounded-none'
                          }`}>
                             <div className={`w-2 h-2 bg-current ${type === 'dot' ? 'rounded-full' : type === 'extra-rounded' ? 'rounded-sm' : 'rounded-none'}`}></div>
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-widest">{type}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Preset */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Color / Rangi</label>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                       {[
                         '#000000', '#71717A', '#E2E8F0', '#F97316', '#EAB308', 
                         '#22C55E', '#3B82F6', '#06B6D4', '#EF4444', '#EC4899'
                       ].map(color => (
                         <button
                           key={color}
                           onClick={() => setQrOptions({ 
                             ...qrOptions, 
                             dotsOptions: { ...qrOptions.dotsOptions, color },
                             cornersSquareOptions: { ...qrOptions.cornersSquareOptions, color },
                             cornersDotOptions: { ...qrOptions.cornersDotOptions, color }
                           })}
                           className={`aspect-square rounded-xl border-2 transition-all relative flex items-center justify-center ${
                             qrOptions.dotsOptions.color === color ? 'border-white scale-110 z-10' : 'border-transparent'
                           }`}
                           style={{ backgroundColor: color }}
                         >
                           {qrOptions.dotsOptions.color === color && <Check className={`w-3 h-3 ${color === '#E2E8F0' ? 'text-black' : 'text-white'}`} />}
                         </button>
                       ))}
                    </div>
                  </div>

                  {/* Background Color Preset */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Background Color / Rangi ya Nyuma</label>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                       {[
                         '#ffffff', '#000000', '#71717A', '#E2E8F0', '#F97316', '#EAB308', 
                         '#22C55E', '#3B82F6', '#06B6D4', '#EF4444', '#EC4899'
                       ].map(color => (
                         <button
                           key={color}
                           onClick={() => setQrOptions({ ...qrOptions, backgroundOptions: { color } })}
                           className={`aspect-square rounded-xl border-2 transition-all relative flex items-center justify-center ${
                             qrOptions.backgroundOptions.color === color ? 'border-orange-500 scale-110 z-10' : 'border-transparent'
                           }`}
                           style={{ backgroundColor: color }}
                         >
                           {color === '#ffffff' && <div className="absolute inset-0 border border-neutral-800 rounded-xl pointer-events-none"></div>}
                           {qrOptions.backgroundOptions.color === color && <Check className={`w-3 h-3 ${color === '#ffffff' || color === '#E2E8F0' ? 'text-black' : 'text-white'}`} />}
                         </button>
                       ))}
                    </div>
                  </div>

                  {/* QR Code Mode */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Qr Code Mode / Nembo ya Kati</label>
                    </div>
                    <Select 
                      value={qrOptions.image ? 'image' : 'none'}
                      onValueChange={(val) => {
                        if (val === 'image') {
                          setQrOptions((prev: any) => ({ 
                            ...prev, 
                            image: vendorProfile?.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${vendorProfile?.businessName || 'Vendor'}`,
                            imageOptions: { ...prev.imageOptions, hideBackgroundDots: true, imageSize: 0.35, margin: 5 }
                          }));
                        } else {
                          setQrOptions((prev: any) => ({ ...prev, image: '' }));
                        }
                      }}
                    >
                      <SelectTrigger className="bg-neutral-900 border-white/5 h-14 rounded-2xl text-white font-bold">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-white/10 text-white">
                        <SelectItem value="none">None (Plain QR)</SelectItem>
                        <SelectItem value="image">Business Logo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Print Customization */}
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                       <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Print Layout / Maelezo ya Print</label>
                       <button 
                         onClick={() => setPrintDetails({...printDetails, isPrintMode: !printDetails.isPrintMode})}
                         className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest transition-all ${
                           printDetails.isPrintMode ? 'bg-orange-600 text-white' : 'bg-neutral-800 text-neutral-400'
                         }`}
                       >
                         {printDetails.isPrintMode ? 'Layout Active' : 'Enable Layout'}
                       </button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest px-1">Title / Jina la Biashara</span>
                        <Input 
                          placeholder="e.g. KARIBU CHAKULA"
                          className="bg-neutral-900 border-white/5 h-11 rounded-xl text-white text-xs focus:ring-1 focus:ring-orange-600"
                          value={printDetails.header}
                          onChange={e => setPrintDetails({...printDetails, header: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest px-1">Sub-header / Maelezo</span>
                        <Input 
                          placeholder="e.g. MENU YA KIDIJITALI"
                          className="bg-neutral-900 border-white/5 h-11 rounded-xl text-white text-xs focus:ring-1 focus:ring-orange-600"
                          value={printDetails.subHeader}
                          onChange={e => setPrintDetails({...printDetails, subHeader: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest px-1">Footer / Maelekezo</span>
                        <Input 
                          placeholder="e.g. Scan to order"
                          className="bg-neutral-900 border-white/5 h-11 rounded-xl text-white text-xs focus:ring-1 focus:ring-orange-600"
                          value={printDetails.footer}
                          onChange={e => setPrintDetails({...printDetails, footer: e.target.value})}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest px-1">Phone / Simu</span>
                          <Input 
                            className="bg-neutral-900 border-white/5 h-11 rounded-xl text-white text-xs focus:ring-1 focus:ring-orange-600"
                            value={printDetails.phone}
                            onChange={e => setPrintDetails({...printDetails, phone: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest px-1">Location / Mahali</span>
                          <Input 
                            className="bg-neutral-900 border-white/5 h-11 rounded-xl text-white text-xs focus:ring-1 focus:ring-orange-600"
                            value={printDetails.address}
                            onChange={e => setPrintDetails({...printDetails, address: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview Panel */}
                <div className="lg:w-[450px] bg-[#141416] p-10 flex flex-col items-center justify-center gap-8 relative overflow-hidden">
                  {/* Print Layout Preview */}
                  <div id="printable-stand" className={`
                    relative transition-all duration-500 flex flex-col items-center
                    ${printDetails.isPrintMode 
                      ? 'bg-[#FCFAF2] p-10 rounded-[1.5rem] shadow-2xl w-full max-w-[340px] border border-neutral-200 text-black overflow-hidden' 
                      : ''
                    }
                  `}>
                    {printDetails.isPrintMode && (
                      <>
                        {/* Decorative Patterns */}
                        <div className="absolute top-0 left-0 w-24 h-24 border-t-4 border-l-4 border-orange-600/20 rounded-tl-3xl m-4"></div>
                        <div className="absolute bottom-0 right-0 w-24 h-24 border-b-4 border-r-4 border-orange-600/20 rounded-br-3xl m-4"></div>
                        
                        <div className="w-full text-center space-y-2 mb-8 relative z-10">
                          {vendorProfile?.logoUrl && (
                            <div className="w-12 h-12 mx-auto mb-4 rounded-xl shadow-lg border-2 border-orange-600/10 overflow-hidden">
                              <img src={vendorProfile.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                          )}
                          <h2 className="text-2xl font-black uppercase tracking-tight text-[#8B4513] leading-tight">{printDetails.header}</h2>
                          <div className="flex items-center justify-center gap-3">
                            <div className="h-px flex-1 bg-orange-600/20"></div>
                            <p className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em] whitespace-nowrap">{printDetails.subHeader}</p>
                            <div className="h-px flex-1 bg-orange-600/20"></div>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="relative group z-10">
                      {!printDetails.isPrintMode && (
                        <div className="absolute -inset-4 bg-orange-600/20 rounded-[3rem] blur-2xl group-hover:bg-orange-600/30 transition-all duration-500"></div>
                      )}
                      <div 
                        ref={qrRef} 
                        className={`relative transition-all duration-500 shadow-sm ${
                          printDetails.isPrintMode 
                            ? 'p-3 bg-white rounded-3xl border border-orange-600/10' 
                            : 'p-8 bg-white rounded-[2.5rem] shadow-2xl group-hover:scale-[1.02]'
                        }`}
                      ></div>
                    </div>

                    {printDetails.isPrintMode && (
                      <div className="w-full text-center mt-8 space-y-5 relative z-10">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black leading-tight uppercase tracking-widest text-[#8B4513]">{printDetails.footer.split('&')[0]}</p>
                          <p className="text-[9px] font-bold leading-tight uppercase text-neutral-600">{printDetails.footer.split('&')[1]?.trim()}</p>
                        </div>
                        
                        <div className="pt-4 border-t border-orange-600/10 flex flex-col items-center gap-2">
                          <div className="px-4 py-1.5 bg-orange-600 rounded-full">
                            <p className="text-[12px] font-black italic text-white tracking-widest uppercase">Table {selectedTable?.number || '01'}</p>
                          </div>
                          {(printDetails.phone || printDetails.address) && (
                            <div className="flex items-center gap-2 text-[7px] font-bold text-neutral-400 uppercase tracking-widest">
                               {printDetails.phone && <span>{printDetails.phone}</span>}
                               {printDetails.phone && printDetails.address && <span>•</span>}
                               {printDetails.address && <span className="max-w-[100px] truncate">{printDetails.address}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {!printDetails.isPrintMode && (
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-48 py-2 bg-neutral-900/80 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center gap-2">
                        <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest italic">Live Content Preview</span>
                      </div>
                    )}
                  </div>

                  <div className="w-full space-y-4 max-w-[280px]">
                    {printDetails.isPrintMode ? (
                      <Button 
                        onClick={handlePrint}
                        className="w-full h-16 bg-orange-600 text-white hover:bg-orange-700 rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-xl transition-all"
                      >
                        <Download className="w-4 h-4 mr-3" /> Print Stand Layout
                      </Button>
                    ) : (
                      <Button 
                        onClick={downloadQr}
                        className="w-full h-16 bg-white text-black hover:bg-neutral-200 rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-xl transition-all"
                      >
                        <Download className="w-4 h-4 mr-3" /> Download QR Only
                      </Button>
                    )}
                    <p className="text-center text-[9px] text-neutral-500 font-bold uppercase tracking-[0.15em] leading-relaxed">
                       {printDetails.isPrintMode 
                         ? 'This layout is optimized for A5/A6 acrylic menu holders.' 
                         : `Scan this code to directly access the menu for Table ${selectedTable?.number || ''}`
                       }
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-8 border-t border-white/5 flex items-center justify-between shrink-0 bg-black/20">
                 <div className="flex gap-4">
                    <div className="flex flex-col">
                       <span className="text-[10px] font-black text-neutral-500 uppercase">Format</span>
                       <span className="text-xs font-black text-white italic">PNG • 300x300</span>
                    </div>
                    <div className="w-px h-8 bg-white/10 mx-2"></div>
                    <div className="flex flex-col">
                       <span className="text-[10px] font-black text-neutral-500 uppercase">Data Path</span>
                       <span className="text-xs font-black text-orange-500 italic opacity-80">/vendor/{vendorProfile?.id?.slice(0,8)}...</span>
                    </div>
                 </div>
                 <Button 
                   onClick={() => setIsQrBuilderOpen(false)}
                   className="h-14 px-10 bg-orange-600 hover:bg-orange-700 rounded-2xl font-black uppercase tracking-widest text-[10px] text-white shadow-xl shadow-orange-950/20"
                 >
                   Save Changes
                 </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #262626;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #404040;
        }

        @media print {
          body * {
            visibility: hidden;
            display: none !important;
          }
          #printable-stand, #printable-stand * {
            visibility: visible !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
          }
          #printable-stand {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 100mm !important;
            height: 150mm !important;
            margin: 0 !important;
            padding: 40px !important;
            background: #FCFAF2 !important;
            z-index: 10000 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            border: none !important;
            box-shadow: none !important;
          }
          #printable-stand h2 {
            font-size: 28pt !important;
            margin-bottom: 5pt !important;
          }
          #printable-stand p {
            font-size: 10pt !important;
          }
          #printable-stand .bg-white {
            width: 350px !important;
            height: 350px !important;
            margin: 40px 0 !important;
            border: 2px solid #ea580c20 !important;
          }
          #printable-stand .bg-orange-600 {
             background-color: #ea580c !important;
             color: white !important;
             -webkit-print-color-adjust: exact;
          }
        }
      `}} />
    </div>
  );
}
