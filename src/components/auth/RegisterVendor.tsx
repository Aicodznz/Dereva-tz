import React, { useState, useEffect } from 'react';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  User, Store, Mail, Phone, Lock, Loader2, MapPin, 
  Globe, Info, FileText, CheckCircle2, ChevronRight, 
  ChevronLeft, Camera, Image as ImageIcon, Box,
  Wifi, Car, Waves, Utensils, Beer, Dumbbell, Users,
  Plane, Wind, Shirt, Bell, Umbrella, Star
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '../../AuthContext';
import { useLanguage } from '../../LanguageContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

const AMENITIES_OPTIONS = [
  { id: 'wifi', label: 'Free WiFi', icon: Wifi },
  { id: 'parking', label: 'Parking', icon: Car },
  { id: 'pool', label: 'Swimming Pool', icon: Waves },
  { id: 'restaurant', label: 'Restaurant', icon: Utensils },
  { id: 'bar', label: 'Bar', icon: Beer },
  { id: 'gym', label: 'Gym', icon: Dumbbell },
  { id: 'conference', label: 'Conference Hall', icon: Users },
  { id: 'shuttle', label: 'Airport Pickup', icon: Plane },
  { id: 'ac', label: 'Air Conditioning', icon: Wind },
  { id: 'laundry', label: 'Laundry Service', icon: Shirt },
  { id: 'room_service', label: 'Room Service', icon: Bell },
  { id: 'security', label: 'Security 24/7', icon: Lock },
  { id: 'beach', label: 'Beach Access', icon: Umbrella },
];

export default function RegisterVendor() {
  const { t } = useLanguage();
  const { signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const [formData, setFormData] = useState({
    // Standard Vendor Fields
    ownerName: '',
    businessName: '',
    category: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreed: false,

    // Hotel Specific Fields
    hotelCategory: 'Hotel',
    hotelDescription: '',
    hotelLogoUrl: '',
    bannerUrl: '',
    galleryPhotos: [] as string[],
    whatsAppNumber: '',
    website: '',
    country: 'Tanzania',
    city: '',
    fullAddress: '',
    location: { lat: -6.7924, lng: 39.2083 }, // Default Dar
    amenities: [] as string[],
    openingHours: 'Open 24 Hours',
    numberOfRooms: 0,
    roomPricing: {
      single: 0,
      double: 0,
      vip: 0
    },
    ownerFirstName: '',
    ownerLastName: '',
    ownerPhone: '',
    ownerWhatsApp: '',
    nationalId: '',
    tinNumber: '',
    licenseUrl: '',
    taxCertUrl: '',
    verificationDocs: [] as string[],
    confirmCorrect: false,
    agreeTerms: false,
    agreeVerification: false,
  });

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    setFormData(prev => ({ ...prev, category: val }));
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const toggleAmenity = (id: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(id) 
        ? prev.amenities.filter(a => a !== id) 
        : [...prev.amenities, id]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedCategory === 'hotel') {
      if (step < 6) {
        nextStep();
        return;
      }
    }

    // Final Validations
    if (!formData.agreed && selectedCategory !== 'hotel') {
      toast.error("Please agree to the terms and conditions");
      return;
    }

    if (selectedCategory === 'hotel' && (!formData.confirmCorrect || !formData.agreeTerms)) {
      toast.error("Please confirm information and agree to terms");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error(t('passwords_dont_match'));
      return;
    }

    setLoading(true);
    try {
      const extraData: any = {
        fullName: selectedCategory === 'hotel' ? `${formData.ownerFirstName} ${formData.ownerLastName}` : formData.ownerName,
        businessName: formData.businessName,
        category: formData.category,
        phoneNumber: (selectedCategory === 'hotel' && formData.ownerPhone) ? formData.ownerPhone : formData.phone,
        status: 'pending',
        tin: formData.tinNumber,
        address: formData.fullAddress,
        description: formData.hotelDescription,
      };

      if (selectedCategory === 'hotel') {
        extraData.hotelCategory = formData.hotelCategory;
        extraData.description = formData.hotelDescription;
        extraData.logoUrl = formData.hotelLogoUrl;
        extraData.bannerUrl = formData.bannerUrl;
        extraData.galleryPhotos = formData.galleryPhotos;
        extraData.socialLinks = {
          whatsapp: formData.whatsAppNumber,
          website: formData.website
        };
        extraData.country = formData.country;
        extraData.city = formData.city;
        extraData.address = formData.fullAddress;
        extraData.location = formData.location;
        extraData.amenities = formData.amenities;
        extraData.operatingHours = formData.openingHours;
        extraData.numberOfRooms = formData.numberOfRooms;
        extraData.roomPricing = formData.roomPricing;
        extraData.ownerInfo = {
          firstName: formData.ownerFirstName,
          lastName: formData.ownerLastName,
          phone: formData.ownerPhone || formData.phone,
          whatsapp: formData.ownerWhatsApp,
          email: formData.email,
          nationalId: formData.nationalId
        };
        extraData.businessDocs = {
          tinNumber: formData.tinNumber,
          licenseUrl: formData.licenseUrl,
          taxCertUrl: formData.taxCertUrl,
          verificationDocs: formData.verificationDocs
        };
        extraData.hotelStatus = 'Available';
      }

      await signUp(formData.email.trim(), formData.password, 'vendor', extraData);
      
      toast.success(t('registration_submitted'));
      navigate('/');
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || t('signup_failed'));
    } finally {
      setLoading(false);
    }
  };

  const renderHotelForm = () => {
    switch(step) {
      case 1:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <h3 className="text-sm font-black uppercase text-orange-600 tracking-widest bg-orange-50 p-3 rounded-xl">SECTION 1: Hotel Info</h3>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400">Hotel Name *</label>
              <Input required value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} placeholder="Hotel Name" className="h-12 bg-neutral-50 border-none rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400">Hotel Category *</label>
              <Select value={formData.hotelCategory} onValueChange={(val: any) => setFormData({...formData, hotelCategory: val})}>
                <SelectTrigger className="h-12 bg-neutral-50 border-none rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Hotel', 'Lodge', 'Guest House', 'Resort', 'Apartment', 'Hostel', 'Villa'].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400">Description *</label>
              <Textarea required value={formData.hotelDescription} onChange={e => setFormData({...formData, hotelDescription: e.target.value})} placeholder="Describe your hotel and services..." className="bg-neutral-50 border-none rounded-xl min-h-[100px]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-neutral-400">Logo (URL/Upload)</label>
                 <Input value={formData.hotelLogoUrl} onChange={e => setFormData({...formData, hotelLogoUrl: e.target.value})} placeholder="Logo URL" className="h-12 bg-neutral-50 border-none rounded-xl" />
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-neutral-400">Banner (URL/Upload)</label>
                 <Input value={formData.bannerUrl} onChange={e => setFormData({...formData, bannerUrl: e.target.value})} placeholder="Banner URL" className="h-12 bg-neutral-50 border-none rounded-xl" />
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-neutral-400">Phone *</label>
                 <Input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="Phone" className="h-12 bg-neutral-50 border-none rounded-xl" />
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-neutral-400">WhatsApp</label>
                 <Input value={formData.whatsAppNumber} onChange={e => setFormData({...formData, whatsAppNumber: e.target.value})} placeholder="WhatsApp" className="h-12 bg-neutral-50 border-none rounded-xl" />
               </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400">Location on Map *</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                   <MapPin className="absolute left-3 top-3.5 w-5 h-5 text-neutral-400" />
                   <Input readOnly value={`${formData.location.lat.toFixed(4)}, ${formData.location.lng.toFixed(4)}`} className="pl-10 h-12 bg-neutral-50 border-none rounded-xl w-full" />
                </div>
                <Button 
                  type="button" 
                  onClick={() => {
                    if (!navigator.geolocation) {
                      toast.error("Geolocation not supported");
                      return;
                    }
                    navigator.geolocation.getCurrentPosition((pos) => {
                      setFormData(prev => ({ ...prev, location: { lat: pos.coords.latitude, lng: pos.coords.longitude }}));
                      toast.success("Mahali pamepatikana!");
                    }, (err) => {
                      toast.error("Imeshindwa kupata mahali: " + err.message);
                    });
                  }}
                  className="h-12 px-6 bg-orange-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px]"
                >
                  <MapPin className="w-4 h-4 mr-2" /> Mark
                </Button>
              </div>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <h3 className="text-sm font-black uppercase text-orange-600 tracking-widest bg-orange-50 p-3 rounded-xl flex items-center gap-2">
              <Star className="w-4 h-4" /> SECTION 2: Services
            </h3>
            
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-neutral-400">Amenities / Huduma</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {AMENITIES_OPTIONS.map(amenity => (
                  <button
                    key={amenity.id}
                    type="button"
                    onClick={() => toggleAmenity(amenity.id)}
                    className={`flex items-center gap-2 p-3 rounded-xl text-[10px] font-bold uppercase transition-all border ${
                      formData.amenities.includes(amenity.id)
                        ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-200'
                        : 'bg-neutral-50 text-neutral-500 border-transparent'
                    }`}
                  >
                    <amenity.icon className="w-3.5 h-3.5" />
                    {amenity.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-neutral-400">Rooms Count</label>
                <Input type="number" value={formData.numberOfRooms || 0} onChange={e => setFormData({...formData, numberOfRooms: parseInt(e.target.value) || 0})} className="h-12 bg-neutral-50 border-none rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-neutral-400">Opening Hours</label>
                <Input value={formData.openingHours} onChange={e => setFormData({...formData, openingHours: e.target.value})} className="h-12 bg-neutral-50 border-none rounded-xl" />
              </div>
            </div>

            <div className="space-y-4 bg-neutral-50 p-4 rounded-2xl">
              <label className="text-[10px] font-black uppercase text-neutral-400">Pricing (TZS)</label>
              <div className="grid grid-cols-3 gap-3">
                 <div className="space-y-1">
                   <span className="text-[8px] font-bold text-neutral-500 uppercase">Single</span>
                    <Input type="number" value={formData.roomPricing.single || 0} onChange={e => setFormData({...formData, roomPricing: {...formData.roomPricing, single: parseInt(e.target.value) || 0}})} className="h-10 border-none bg-white rounded-lg" />
                 </div>
                 <div className="space-y-1">
                   <span className="text-[8px] font-bold text-neutral-500 uppercase">Double</span>
                   <Input type="number" value={formData.roomPricing.double || 0} onChange={e => setFormData({...formData, roomPricing: {...formData.roomPricing, double: parseInt(e.target.value) || 0}})} className="h-10 border-none bg-white rounded-lg" />
                 </div>
                 <div className="space-y-1">
                   <span className="text-[8px] font-bold text-neutral-500 uppercase">VIP</span>
                   <Input type="number" value={formData.roomPricing.vip || 0} onChange={e => setFormData({...formData, roomPricing: {...formData.roomPricing, vip: parseInt(e.target.value) || 0}})} className="h-10 border-none bg-white rounded-lg" />
                 </div>
              </div>
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
             <h3 className="text-sm font-black uppercase text-orange-600 tracking-widest bg-orange-50 p-3 rounded-xl flex items-center gap-2">
              <User className="w-4 h-4" /> SECTION 3: Owner
            </h3>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-neutral-400">First Name *</label>
                 <Input required value={formData.ownerFirstName} onChange={e => setFormData({...formData, ownerFirstName: e.target.value})} className="h-12 bg-neutral-50 border-none rounded-xl" />
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-neutral-400">Last Name *</label>
                 <Input required value={formData.ownerLastName} onChange={e => setFormData({...formData, ownerLastName: e.target.value})} className="h-12 bg-neutral-50 border-none rounded-xl" />
               </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400">Owner Phone *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3.5 w-5 h-5 text-neutral-400" />
                <Input required type="tel" value={formData.ownerPhone} onChange={e => setFormData({...formData, ownerPhone: e.target.value})} className="pl-10 h-12 bg-neutral-50 border-none rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400">Owner WhatsApp</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3.5 w-5 h-5 text-neutral-400" />
                <Input value={formData.ownerWhatsApp} onChange={e => setFormData({...formData, ownerWhatsApp: e.target.value})} placeholder="Owner WhatsApp" className="pl-10 h-12 bg-neutral-50 border-none rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400">National ID (NIDA)</label>
              <Input value={formData.nationalId} onChange={e => setFormData({...formData, nationalId: e.target.value})} placeholder="NIDA Number" className="h-12 bg-neutral-50 border-none rounded-xl" />
            </div>
          </motion.div>
        );
      case 4:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
             <h3 className="text-sm font-black uppercase text-orange-600 tracking-widest bg-orange-50 p-3 rounded-xl flex items-center gap-2">
              <FileText className="w-4 h-4" /> SECTION 4: Documents
            </h3>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400">TIN Number *</label>
              <Input required value={formData.tinNumber} onChange={e => setFormData({...formData, tinNumber: e.target.value})} className="h-12 bg-neutral-50 border-none rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400">Business License (URL) *</label>
              <Input required value={formData.licenseUrl} onChange={e => setFormData({...formData, licenseUrl: e.target.value})} placeholder="Link to license doc" className="h-12 bg-neutral-50 border-none rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400">Tax Certificate (Optiona URL)</label>
              <Input value={formData.taxCertUrl} onChange={e => setFormData({...formData, taxCertUrl: e.target.value})} className="h-12 bg-neutral-50 border-none rounded-xl" />
            </div>
          </motion.div>
        );
      case 5:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
             <h3 className="text-sm font-black uppercase text-orange-600 tracking-widest bg-orange-50 p-3 rounded-xl flex items-center gap-2">
              <Lock className="w-4 h-4" /> SECTION 5: Security
            </h3>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
              <Input type="email" required placeholder="Account Email" className="pl-10 h-12 bg-neutral-50 border-none rounded-xl" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
              <Input type="password" required placeholder="Password" className="pl-10 h-12 bg-neutral-50 border-none rounded-xl" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
              <Input type="password" required placeholder="Confirm Password" className="pl-10 h-12 bg-neutral-50 border-none rounded-xl" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
            </div>
            <div className="bg-orange-50 p-4 rounded-2xl">
              <p className="text-[10px] text-orange-800 leading-relaxed">
                Rules: Min 8 chars, Number required, Special char required.
              </p>
            </div>
          </motion.div>
        );
      case 6:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
             <h3 className="text-sm font-black uppercase text-orange-600 tracking-widest bg-orange-50 p-3 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> SECTION 6: Agreements
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3 bg-neutral-50 p-4 rounded-2xl border-l-4 border-orange-500">
                <Checkbox id="confirm-correct" checked={formData.confirmCorrect} onCheckedChange={(val) => setFormData({...formData, confirmCorrect: !!val})} />
                <label htmlFor="confirm-correct" className="text-xs font-bold uppercase text-neutral-700 leading-tight">
                  I confirm that all information provided is correct.
                </label>
              </div>
              <div className="flex items-start space-x-3 bg-neutral-50 p-4 rounded-2xl border-l-4 border-orange-500">
                <Checkbox id="agree-terms" checked={formData.agreeTerms} onCheckedChange={(val) => setFormData({...formData, agreeTerms: !!val})} />
                <label htmlFor="agree-terms" className="text-xs font-bold uppercase text-neutral-700 leading-tight">
                  I agree to the Terms & Conditions.
                </label>
              </div>
              <div className="flex items-start space-x-3 bg-neutral-50 p-4 rounded-2xl border-l-4 border-orange-500">
                <Checkbox id="agree-verify" checked={formData.agreeVerification} onCheckedChange={(val) => setFormData({...formData, agreeVerification: !!val})} />
                <label htmlFor="agree-verify" className="text-xs font-bold uppercase text-neutral-700 leading-tight">
                  I agree to hotel verification by admin.
                </label>
              </div>
            </div>
          </motion.div>
        );
      default: return null;
    }
  };

  return (
    <AuthLayout 
      title={selectedCategory === 'hotel' ? "Hotel Registration" : "Become a Vendor"} 
      subtitle={selectedCategory === 'hotel' ? `Step ${step} of 6` : "Kuwa Muuzaji"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-neutral-400">Aina ya Biashara / Business Category *</label>
          <Select required onValueChange={handleCategoryChange}>
            <SelectTrigger className="h-12 bg-neutral-50 border-none rounded-xl">
              <SelectValue placeholder="Chagua aina ya biashara" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hotel">Hotels & Accommodation (Special Form)</SelectItem>
              <SelectItem value="restaurant">Restaurant / Chakula na Vinywaji</SelectItem>
              <SelectItem value="grocery">Grocery / Soko na Mahitaji</SelectItem>
              <SelectItem value="pharmacy">Pharmacy / Dawa na Afya</SelectItem>
              <SelectItem value="ecommerce">eCommerce / Maduka na Bidhaa</SelectItem>
              <SelectItem value="salon">Salon / Kinyozi na Urembo</SelectItem>
              <SelectItem value="bus_ticket">Bus Ticket / Tiketi za Mabasi</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedCategory && selectedCategory !== 'hotel' && (
          <>
            <div className="bg-orange-50 p-4 rounded-2xl border-l-4 border-orange-500 mb-4">
              <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Usajili wa {selectedCategory.toUpperCase()}</p>
              <p className="text-[9px] text-neutral-500 mt-1 uppercase font-bold">Jaza taarifa zako za msingi kuanza kuuza.</p>
            </div>

            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
              <Input required placeholder="Jina la Mmiliki / Owner Full Name" className="pl-10 h-12 bg-neutral-50 border-none rounded-xl" value={formData.ownerName} onChange={e => setFormData({...formData, ownerName: e.target.value})} />
            </div>

            <div className="relative">
              <Store className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
              <Input required placeholder="Jina la Biashara / Business Name" className="pl-10 h-12 bg-neutral-50 border-none rounded-xl" value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} />
            </div>

            <div className="relative">
              <FileText className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
              <Input required placeholder="TIN Number (Namba ya kodi)" className="pl-10 h-12 bg-neutral-50 border-none rounded-xl" value={formData.tinNumber} onChange={e => setFormData({...formData, tinNumber: e.target.value})} />
            </div>

            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
              <Input required placeholder="Mahali (Mtaa/Eneo) / Physical Address" className="pl-10 h-12 bg-neutral-50 border-none rounded-xl" value={formData.fullAddress} onChange={e => setFormData({...formData, fullAddress: e.target.value})} />
            </div>

            <div className="relative">
              <Info className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
              <Textarea placeholder="Elezea Huduma Zako / Short Business Description" className="pl-10 min-h-[80px] bg-neutral-50 border-none rounded-xl" value={formData.hotelDescription} onChange={e => setFormData({...formData, hotelDescription: e.target.value})} />
            </div>
          </>
        )}
        
        {selectedCategory === 'hotel' ? renderHotelForm() : (
          <>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
              <Input type="email" required placeholder="Business Email" className="pl-10 h-12 bg-neutral-50 border-none rounded-xl" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>

            <div className="relative">
              <Phone className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
              <Input type="tel" required placeholder="Business Phone Number" className="pl-10 h-12 bg-neutral-50 border-none rounded-xl" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
              <Input type="password" required placeholder="Password" className="pl-10 h-12 bg-neutral-50 border-none rounded-xl" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
              <Input type="password" required placeholder="Confirm Password" className="pl-10 h-12 bg-neutral-50 border-none rounded-xl" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
            </div>

            <div className="flex items-start space-x-3 py-2">
              <Checkbox id="terms" className="mt-1" onCheckedChange={(checked) => setFormData({...formData, agreed: checked as boolean})} />
              <label htmlFor="terms" className="text-xs text-neutral-500 leading-tight">
                I agree to the <Link to="#" className="text-orange-600 font-medium">Terms</Link> and <Link to="#" className="text-orange-600 font-medium">Privacy</Link>.
              </label>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-4">
          {selectedCategory === 'hotel' && step > 1 && (
            <Button type="button" variant="outline" onClick={prevStep} className="h-12 px-6 rounded-xl border-neutral-200">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          <Button 
            type="submit" 
            disabled={loading}
            className="flex-1 h-12 bg-orange-600 hover:bg-orange-700 rounded-xl text-lg font-bold shadow-xl shadow-orange-200"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
              selectedCategory === 'hotel' ? (step === 6 ? "🚀 SEND REQUEST" : "PROCEED / ENDELEA") : "CREATE ACCOUNT"
            )}
          </Button>
        </div>

        <p className="text-center text-sm text-neutral-600 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-orange-600 font-bold hover:underline">
            Sign in / Ingia
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

