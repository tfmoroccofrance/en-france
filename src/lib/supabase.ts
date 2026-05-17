import { createClient } from "@supabase/supabase-js";
import type { SupabaseCategoryRow, SupabasePostRow } from "@/types/post";

type Database = {
  public: {
    Tables: {
      posts: {
        Row: SupabasePostRow;
        Insert: never;
        Update: never;
      };
      categories: {
        Row: SupabaseCategoryRow;
        Insert: never;
        Update: never;
      };
    };
  };
};

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseKey =
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? import.meta.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY."
  );
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;
