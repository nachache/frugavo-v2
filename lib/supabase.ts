import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client. Uses the service role key, which bypasses RLS.
// NEVER import this file from a client component — it would leak the service
// role key into the bundle.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  // We don't throw at import time so build-time prerendering still works in
  // environments where envs aren't set; we throw lazily in the API route.
  // eslint-disable-next-line no-console
  console.warn(
    "[frugavo] Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
  );
}

export const supabaseAdmin =
  url && serviceKey
    ? createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
