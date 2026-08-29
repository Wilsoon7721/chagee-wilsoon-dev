import 'server-only';

import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabasePrivilegedKey = process.env.SUPABASE_PRIVILEGED_KEY;

if (!supabaseUrl || !supabaseAnonKey) throw new Error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');

export function createBrowserSupabaseClient() {
  return createBrowserClient<Database, 'chagee'>(supabaseUrl, supabaseAnonKey, {
    db: { schema: 'chagee' }
  });
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database, 'chagee'>(supabaseUrl, supabaseAnonKey, {
    db: { schema: 'chagee' },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {}
      }
    }
  });
}

export function createPrivilegedSupabaseClient() {
  if (!supabasePrivilegedKey) throw new Error('Missing SUPABASE_PRIVILEGED_KEY - privileged client unavailable. ' + 'Add it to .env.local (server-only, never NEXT_PUBLIC_*).');

  return createClient<Database, 'chagee'>(supabaseUrl, supabasePrivilegedKey, {
    db: { schema: 'chagee' },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export const BUCKET_NAME = process.env.NEXT_PUBLIC_BUCKET_NAME ?? 'chagee-study';
