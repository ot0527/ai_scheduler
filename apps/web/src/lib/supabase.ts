import { createClient } from "@supabase/supabase-js";
import type { Database } from "@ai-scheduler/core";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を .env に設定してください",
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
