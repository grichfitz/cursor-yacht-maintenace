import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function isProbablyJson(raw: string) {
  const s = raw.trim();
  // Supabase auth storage should always be JSON (object/array/null), never plain text.
  return s.startsWith("{") || s.startsWith("[") || s === "null";
}

const safeAuthStorage: Storage = {
  get length() {
    return window.localStorage.length;
  },
  clear() {
    window.localStorage.clear();
  },
  key(index: number) {
    return window.localStorage.key(index);
  },
  getItem(key: string) {
    const v = window.localStorage.getItem(key);
    if (v == null) return null;

    // Hardening: if an extension or legacy code wrote plain text into the Supabase auth slot,
    // gotrue will crash at JSON.parse(). Treat it as "no session" and delete the bad value.
    if (key.startsWith("sb-") && key.endsWith("-auth-token") && !isProbablyJson(v)) {
      window.localStorage.removeItem(key);
      return null;
    }

    return v;
  },
  setItem(key: string, value: string) {
    window.localStorage.setItem(key, value);
  },
  removeItem(key: string) {
    window.localStorage.removeItem(key);
  },
};

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loud in dev so we don't get confusing 403s.
  throw new Error(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Vite environment (e.g. .env.local)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: safeAuthStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
