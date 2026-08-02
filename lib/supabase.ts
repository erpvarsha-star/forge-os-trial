/**
 * Forge OS — Supabase client (React Native / Expo app).
 *
 * Auth: Supabase Auth phone OTP (Section 5). Session is persisted with
 * AsyncStorage so employees stay logged in between app opens.
 *
 * Requires in .env (see .env.example):
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 */

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project credentials.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Sends a one-time password to `phone` (E.164, e.g. +91XXXXXXXXXX). */
export async function requestOtp(phone: string) {
  return supabase.auth.signInWithOtp({ phone });
}

/** Verifies the OTP code the employee received by SMS. */
export async function verifyOtp(phone: string, token: string) {
  return supabase.auth.verifyOtp({ phone, token, type: 'sms' });
}

export async function signOut() {
  return supabase.auth.signOut();
}

/** Fetches the `employees` row linked to the currently authenticated user. */
export async function getCurrentEmployee() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { data: null, error: new Error('Not authenticated') };

  return supabase.from('employees').select('*').eq('auth_user_id', user.id).single();
}
