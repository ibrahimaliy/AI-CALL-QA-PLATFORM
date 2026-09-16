import { createClient, SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let serverClient: SupabaseClient<any> | null = null;

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
    !url.includes("your-project") &&
    key &&
    !key.includes("your-") &&
    key.length > 20
  );
}

export function assertProductionStatelessness(): void {
  const isVercel = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
  const isProduction = process.env.NODE_ENV === "production";

  if ((isVercel || isProduction) && !isSupabaseConfigured()) {
    throw new Error(
      "FATAL: Production Vercel deployment requires Supabase PostgreSQL and Supabase Storage. " +
      "Local .data filesystem persistence is strictly forbidden in production. " +
      "Please configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your Vercel Project Settings."
    );
  }
}

export function getSupabaseServerClient() {
  if (serverClient) return serverClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!url || !key || url.includes("your-project")) {
    assertProductionStatelessness();
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serverClient = createClient<any>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serverClient;
}
