import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'sw';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    'my_orders': 'My Orders',
    'edit_profile': 'Edit Profile',
    'chat': 'Chat',
    'address': 'Address',
    'change_password': 'Change Password',
    'change_language': 'Change Language',
    'sign_out': 'Sign Out',
    'active_orders': 'Active Orders',
    'previous_orders': 'Previous Orders',
    'order_id': 'Order ID',
    'total': 'Total',
    'see_details': 'See Details',
    'back_to_home': 'Back to Home',
    'back_to_orders': 'Back to Orders',
    'order_details': 'Order Details',
    'order_type': 'Order Type',
    'delivery_time': 'Delivery Time',
    'takeaway_time': 'Takeaway Time',
    'subtotal': 'Subtotal',
    'discount': 'Discount',
    'delivery_charge': 'Delivery Charge',
    'print_invoice': 'Print Invoice',
    'pay_now': 'Pay Now',
    'status': 'Status',
    'method': 'Method',
    'payment_info': 'Payment Info',
    'delivery_address': 'Delivery Address',
    'save': 'Save',
    'cancel': 'Cancel',
    'email': 'Email',
    'phone': 'Phone Number',
    'joined': 'Joined',
    'personal_info': 'Personal Information',
    'edit': 'Edit',
    'welcome_back': 'Welcome Back!',
    'sign_in_subtitle': 'Sign in to your account',
    'or': 'OR',
    'continue_with_google': 'Continue with Google',
    'dont_have_account': "Don't have an account?",
    'sign_up': 'Sign up',
    'password': 'Password',
    'forgot_password': 'Forgot Password?',
    'sign_in': 'Sign In',
    'new_password': 'New Password',
    'confirm_password': 'Confirm Password',
    'update_password': 'Update Password',
    'chat_placeholder': 'Type a message...',
    'send': 'Send',
    'food': 'Food',
    'grocery': 'Grocery',
    'pharmacy': 'Pharmacy',
    'ecommerce': 'eCommerce',
    'taxi': 'Taxi',
    'parcel': 'Parcel',
    'salons': 'Salons',
    'hotels': 'Hotels',
    'welcome': 'Welcome',
    'businesses': 'Businesses',
    'products': 'Products',
    'search_placeholder': 'Search for food, grocery, or services...',
  },
  sw: {
    'my_orders': 'Oda Zangu',
    'edit_profile': 'Hariri Wasifu',
    'chat': 'Mazungumzo',
    'address': 'Anwani',
    'change_password': 'Badili Nenosiri',
    'change_language': 'Badili Lugha',
    'sign_out': 'Ondoka',
    'active_orders': 'Oda Zinazoendelea',
    'previous_orders': 'Oda Zilizopita',
    'order_id': 'Namba ya Oda',
    'total': 'Jumla',
    'see_details': 'Angalia Zaidi',
    'back_to_home': 'Rudi Nyumbani',
    'back_to_orders': 'Rudi kwenye Oda',
    'order_details': 'Maelezo ya Oda',
    'order_type': 'Aina ya Oda',
    'delivery_time': 'Muda wa Kufikishiwa',
    'takeaway_time': 'Muda wa Kuchukua',
    'subtotal': 'Jumla Ndogo',
    'discount': 'Punguzo',
    'delivery_charge': 'Gharama ya Usafiri',
    'print_invoice': 'Chapa Stakabadhi',
    'pay_now': 'Lipa Sasa',
    'status': 'Hali',
    'method': 'Njia',
    'payment_info': 'Taarifa za Malipo',
    'delivery_address': 'Anwani ya Kufikishiwa',
    'save': 'Hifadhi',
    'cancel': 'Ghairi',
    'email': 'Barua Pepe',
    'phone': 'Namba ya Simu',
    'joined': 'Umejiunga',
    'personal_info': 'Taarifa Binafsi',
    'edit': 'Hariri',
    'welcome_back': 'Karibu Tena!',
    'sign_in_subtitle': 'Ingia kwenye akaunti yako',
    'or': 'AU',
    'continue_with_google': 'Endelea na Google',
    'dont_have_account': 'Hauna akaunti?',
    'sign_up': 'Jisajili',
    'password': 'Nenosiri',
    'forgot_password': 'Umesahau nenosiri?',
    'sign_in': 'Ingia',
    'new_password': 'Nenosiri Jipya',
    'confirm_password': 'Thibitisha Nenosiri',
    'update_password': 'Badili Nenosiri',
    'chat_placeholder': 'Andika ujumbe...',
    'send': 'Tuma',
    'food': 'Chakula',
    'grocery': 'Sokoni',
    'pharmacy': 'Duka la Dawa',
    'ecommerce': 'Maduka',
    'taxi': 'Teksi',
    'parcel': 'Vifurushi',
    'salons': 'Saluni',
    'hotels': 'Hoteli',
    'welcome': 'Karibu',
    'businesses': 'Biashara',
    'products': 'Bidhaa',
    'search_placeholder': 'Tafuta chakula, bidhaa, au huduma...',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return (saved as Language) || 'sw';
  });

  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  const t = (key: string) => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
