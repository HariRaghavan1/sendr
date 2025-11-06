-- Drop all RLS policies from all tables
DROP POLICY IF EXISTS "Users can create their own sync logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Users can view their own sync logs" ON public.sync_logs;

DROP POLICY IF EXISTS "Users can create their own shopify products" ON public.shopify_products;
DROP POLICY IF EXISTS "Users can delete their own shopify products" ON public.shopify_products;
DROP POLICY IF EXISTS "Users can update their own shopify products" ON public.shopify_products;
DROP POLICY IF EXISTS "Users can view their own shopify products" ON public.shopify_products;

DROP POLICY IF EXISTS "Users can create their own cart recovery settings" ON public.cart_recovery_settings;
DROP POLICY IF EXISTS "Users can update their own cart recovery settings" ON public.cart_recovery_settings;
DROP POLICY IF EXISTS "Users can view their own cart recovery settings" ON public.cart_recovery_settings;

DROP POLICY IF EXISTS "Users can create their own products" ON public.products;
DROP POLICY IF EXISTS "Users can delete their own products" ON public.products;
DROP POLICY IF EXISTS "Users can update their own products" ON public.products;
DROP POLICY IF EXISTS "Users can view their own products" ON public.products;

DROP POLICY IF EXISTS "Users can create their own shopify stores" ON public.shopify_stores;
DROP POLICY IF EXISTS "Users can delete their own shopify stores" ON public.shopify_stores;
DROP POLICY IF EXISTS "Users can update their own shopify stores" ON public.shopify_stores;
DROP POLICY IF EXISTS "Users can view their own shopify stores" ON public.shopify_stores;

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Drop triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
DROP TRIGGER IF EXISTS update_shopify_stores_updated_at ON public.shopify_stores;
DROP TRIGGER IF EXISTS update_cart_recovery_settings_updated_at ON public.cart_recovery_settings;
DROP TRIGGER IF EXISTS update_shopify_products_updated_at ON public.shopify_products;

-- Drop functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Drop tables in correct order
DROP TABLE IF EXISTS public.sync_logs CASCADE;
DROP TABLE IF EXISTS public.shopify_products CASCADE;
DROP TABLE IF EXISTS public.cart_recovery_settings CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.shopify_stores CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop custom types if any
DROP TYPE IF EXISTS public.app_role CASCADE;