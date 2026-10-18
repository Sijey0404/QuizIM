import { createClient } from '@supabase/supabase-js';

export type AdminProfile = {
  id: string;
  full_name: string;
  role: 'admin';
};

export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL ?? '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
};

export const isSupabaseConfigured = Boolean(supabaseConfig.url && supabaseConfig.anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;

export async function getAdminProfile(userId: string): Promise<AdminProfile> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set the project URL and anon key.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.role !== 'admin') {
    throw new Error('This Supabase account does not have administrator access.');
  }

  return data as AdminProfile;
}

export async function signInAdmin(email: string, password: string): Promise<AdminProfile> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set the project URL and anon key.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  try {
    return await getAdminProfile(data.user.id);
  } catch (profileError) {
    await supabase.auth.signOut();
    throw profileError;
  }
}