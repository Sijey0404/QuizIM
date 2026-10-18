export type AppMode = 'demo' | 'supabase';

export const appMode = (import.meta.env.VITE_APP_MODE ?? 'demo') as AppMode;

export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL ?? '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
};

export const isSupabaseConfigured = Boolean(supabaseConfig.url && supabaseConfig.anonKey);

export function getAdminCredentials() {
  return {
    email: import.meta.env.VITE_ADMIN_EMAIL ?? 'admin@college.edu',
    password: import.meta.env.VITE_ADMIN_PASSWORD ?? 'admin123',
  };
}

export function createSupabaseClient() {
  if (!isSupabaseConfigured) {
    return {
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      from: () => ({
        select: () => ({ data: [], error: null }),
        insert: () => ({ data: [], error: null }),
        update: () => ({ data: [], error: null }),
        delete: () => ({ data: [], error: null }),
      }),
    };
  }

  return {
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    from: () => ({
      select: () => ({ data: [], error: null }),
      insert: () => ({ data: [], error: null }),
      update: () => ({ data: [], error: null }),
      delete: () => ({ data: [], error: null }),
    }),
  };
}
