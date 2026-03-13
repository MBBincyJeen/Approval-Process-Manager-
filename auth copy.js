import { supabase } from './supabaseClient';

export async function signIn(email, password) {
  return await supabase.auth.signInWithPassword({ email, password });
}
