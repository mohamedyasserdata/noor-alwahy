import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getPublicSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

export function createPublicClient() {
  const env = getPublicSupabaseEnv();

  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
