import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from './types';
import { toast } from 'sonner';

interface CartItem extends Product {
  quantity: number;
  selectedSeats?: string[];
  departureDate?: string;
}

interface CartContextType {
  cartItems: CartItem[];
  addItem: (product: Product & { 
    quantity?: number, 
    variation?: string, 
    addons?: string[],
    orderType?: string,
    tableNumber?: string | null,
    arrivalTime?: string | null,
    selectedSeats?: string[],
    departureDate?: string
  }) => void;
  removeItem: (productId: string, variation?: string, addons?: string[]) => void;
  clearCart: () => void;
  cartCount: number;
  totalAmount: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load cart from local storage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('papohapo_cart');
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to load cart', e);
      }
    }
  }, []);

  // Save cart to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem('papohapo_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addItem = (product: any) => {
    const amountToAdd = product.quantity || 1;
    
    // Dispatch custom window event for nice micro-interactions
    try {
      window.dispatchEvent(new CustomEvent('cart-item-added', { detail: { ...product, quantity: amountToAdd } }));
    } catch (e) {
      console.warn('Failed to dispatch cart-item-added event', e);
    }

    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => 
        item.id === product.id && 
        (item as any).variation === product.variation && 
        JSON.stringify((item as any).addons) === JSON.stringify(product.addons)
      );
      const isReadded = !!existingItem;
      const quantity = isReadded ? existingItem.quantity + amountToAdd : amountToAdd;

      toast.success(
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-neutral-100">
            <img 
              src={product.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'} 
              alt="" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <p className="font-black text-xs uppercase tracking-tight line-clamp-1">
              {isReadded ? 'Imeongezeka' : 'Imeongezwa'}: {product.name}
            </p>
            <p className="text-[10px] text-neutral-400 font-bold uppercase">Idadi: {quantity}</p>
          </div>
        </div>,
        {
          duration: 3000,
          style: {
            borderRadius: '1.5rem',
            padding: '1rem',
          }
        }
      );

      if (existingItem) {
        return prevItems.map(item =>
          item.id === product.id && 
          (item as any).variation === product.variation && 
          JSON.stringify((item as any).addons) === JSON.stringify(product.addons)
            ? { ...item, quantity: item.quantity + amountToAdd } 
            : item
        );
      }
      return [...prevItems, { ...product, quantity: amountToAdd }];
    });
  };

  const removeItem = (productId: string, variation?: string, addons?: string[]) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => 
        item.id === productId && 
        (item as any).variation === variation && 
        JSON.stringify((item as any).addons) === JSON.stringify(addons)
      );
      if (existingItem && existingItem.quantity > 1) {
        return prevItems.map(item =>
          item.id === productId && 
          (item as any).variation === variation && 
          JSON.stringify((item as any).addons) === JSON.stringify(addons)
            ? { ...item, quantity: item.quantity - 1 } 
            : item
        );
      }
      return prevItems.filter(item => !(
        item.id === productId && 
        (item as any).variation === variation && 
        JSON.stringify((item as any).addons) === JSON.stringify(addons)
      ));
    });
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem('papohapo_cart');
  };

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const totalAmount = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{ 
      cartItems, addItem, removeItem, clearCart, cartCount, totalAmount, 
      isCartOpen, setIsCartOpen 
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
