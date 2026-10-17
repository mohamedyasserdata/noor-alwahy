import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getPublicSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

const serviceRoleKeySchema = z.string().trim().min(1);

export function createAdminClient() {
  const env = getPublicSupabaseEnv();
  const serviceRoleKey = serviceRoleKeySchema.parse(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
