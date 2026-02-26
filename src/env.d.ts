/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    supabase: import('@supabase/supabase-js').SupabaseClient;
    user: import('@supabase/supabase-js').User | null;
    profile: {
      id: string;
      email: string;
      full_name: string | null;
      institution: string | null;
      role: string;
      is_approved: boolean;
      created_at: string;
      updated_at: string;
    } | null;
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
