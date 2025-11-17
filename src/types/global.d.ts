// This file provides type declarations for the project

declare module '@/integrations/supabase/client' {
  import { SupabaseClient } from '@supabase/supabase-js';
  
  export const supabase: SupabaseClient;
  export const getServiceRoleClient: () => SupabaseClient;
}

// Add other global type declarations as needed
