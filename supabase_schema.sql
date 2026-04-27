-- Supabase Schema for Papo Hapo Super App
-- Use this script in the Supabase SQL Editor

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uid TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    "displayName" TEXT,
    "fullName" TEXT, -- Added to handle different frontend naming
    "photoURL" TEXT,
    role TEXT NOT NULL DEFAULT 'customer',
    status TEXT DEFAULT 'active',
    "approvalStatus" TEXT DEFAULT 'pending',
    phone TEXT,
    "driverType" TEXT,
    "vehicleBrand" TEXT,
    "vehicleModel" TEXT,
    "licensePlate" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Vendors Table
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "businessName" TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    location JSONB,
    status TEXT DEFAULT 'pending', -- Ensure status exists
    rating DECIMAL DEFAULT 0,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    address TEXT,
    "deliveryRadius" DECIMAL,
    tin TEXT,
    "ownerUid" TEXT REFERENCES public.users(uid) ON DELETE CASCADE,
    "operatingHours" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "vendorId" UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL NOT NULL,
    category TEXT,
    "imageUrl" TEXT,
    "imageUrls" TEXT[],
    status TEXT DEFAULT 'active',
    unit TEXT,
    "stockLevel" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "customerId" TEXT,
    "vendorId" UUID REFERENCES public.vendors(id),
    items JSONB NOT NULL,
    "totalAmount" DECIMAL NOT NULL,
    status TEXT DEFAULT 'pending',
    "paymentStatus" TEXT DEFAULT 'pending',
    "paymentMethod" TEXT,
    "deliveryAddress" TEXT,
    location JSONB,
    "customerPhone" TEXT,
    "driverId" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create Rides Table (Taxi Services)
CREATE TABLE IF NOT EXISTS public.rides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "customerId" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhoto" TEXT,
    "driverId" TEXT,
    "driverName" TEXT,
    "driverPhoto" TEXT,
    "vehicleNumber" TEXT,
    pickup JSONB NOT NULL,
    destination JSONB NOT NULL,
    "pickupAddress" TEXT,
    "destinationAddress" TEXT,
    distance DECIMAL,
    duration DECIMAL,
    "estimatedFare" DECIMAL,
    status TEXT DEFAULT 'pending',
    "vehicleType" TEXT,
    "paymentMethod" TEXT,
    rating INTEGER,
    review TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create Drivers Table (Real-time tracking)
CREATE TABLE IF NOT EXISTS public.drivers (
    id TEXT PRIMARY KEY, -- User UID
    location JSONB NOT NULL,
    "vehicleType" TEXT,
    "isOnline" BOOLEAN DEFAULT false, -- Ensure isOnline exists with quotes
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create Banners Table
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT,
    sub TEXT,
    img TEXT,
    active BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create Coupons Table
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" DECIMAL NOT NULL,
    active BOOLEAN DEFAULT true,
    "vendorId" UUID REFERENCES public.vendors(id),
    "productId" UUID REFERENCES public.products(id),
    "validUntil" TIMESTAMPTZ,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Create Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "senderId" TEXT REFERENCES public.users(uid),
    "recipientId" TEXT,
    text TEXT,
    "imageUrl" TEXT,
    "isRead" BOOLEAN DEFAULT false,
    reactions JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" TEXT REFERENCES public.users(uid),
    title TEXT,
    body TEXT,
    type TEXT,
    "isRead" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 13. Dynamic Policies

-- Users
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
CREATE POLICY "Public profiles are viewable by everyone" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile" ON public.users FOR INSERT WITH CHECK (true); -- Broad for dev

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (true); -- Broad for dev

-- Vendors & Products
DROP POLICY IF EXISTS "Vendors are viewable by everyone" ON public.vendors;
CREATE POLICY "Vendors are viewable by everyone" ON public.vendors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage vendors" ON public.vendors;
CREATE POLICY "Authenticated users can manage vendors" ON public.vendors FOR ALL USING (true); -- Broad for dev

DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
CREATE POLICY "Products are viewable by everyone" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage products" ON public.products;
CREATE POLICY "Authenticated users can manage products" ON public.products FOR ALL USING (true); -- Broad for dev

-- Rides & Drivers (Taxi)
DROP POLICY IF EXISTS "Public rides viewable" ON public.rides;
CREATE POLICY "Public rides viewable" ON public.rides FOR SELECT USING (true);

DROP POLICY IF EXISTS "Customers can request rides" ON public.rides;
CREATE POLICY "Customers can request rides" ON public.rides FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Riders can update rides" ON public.rides;
CREATE POLICY "Riders can update rides" ON public.rides FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Drivers location public" ON public.drivers;
CREATE POLICY "Drivers location public" ON public.drivers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Drivers can update own location" ON public.drivers;
CREATE POLICY "Drivers can update own location" ON public.drivers FOR ALL USING (true);

-- Banners
DROP POLICY IF EXISTS "Banners are viewable by everyone" ON public.banners;
CREATE POLICY "Banners are viewable by everyone" ON public.banners FOR SELECT USING (true);

-- Orders
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
CREATE POLICY "Users can create orders" ON public.orders FOR INSERT WITH CHECK (true);

-- Messages
DROP POLICY IF EXISTS "Can view messages" ON public.messages;
CREATE POLICY "Can view messages" ON public.messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Can insert messages" ON public.messages;
CREATE POLICY "Can insert messages" ON public.messages FOR INSERT WITH CHECK (true);

-- Notifications
DROP POLICY IF EXISTS "Can view notifications" ON public.notifications;
CREATE POLICY "Can view notifications" ON public.notifications FOR SELECT USING (true);

DROP POLICY IF EXISTS "Can insert notifications" ON public.notifications;
CREATE POLICY "Can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- Test connection helper
CREATE TABLE IF NOT EXISTS public.test (id TEXT PRIMARY KEY);
INSERT INTO public.test (id) VALUES ('connection') ON CONFLICT DO NOTHING;
ALTER TABLE public.test ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Test allows select" ON public.test FOR SELECT USING (true);
