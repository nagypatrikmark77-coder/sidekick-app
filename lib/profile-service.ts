import { supabase } from './supabase';
import type { Profile, Subscription } from '@/types/database';

export type { Profile, Subscription } from '@/types/database';

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session;
}

export const profileService = {
  async getProfile(): Promise<Profile | null> {
    const session = await getSession();

    const { data, error } = await supabase
      .from('PROFILES')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  },

  async updateProfile(updates: Partial<Omit<Profile, 'id' | 'created_at'>>): Promise<Profile> {
    const session = await getSession();

    const { data, error } = await supabase
      .from('PROFILES')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', session.user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getSubscription(): Promise<Subscription | null> {
    const session = await getSession();

    const { data, error } = await supabase
      .from('SUBSCRIBTIONS')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  },

  async sendPasswordReset(): Promise<void> {
    const session = await getSession();
    const email = session.user.email;
    if (!email) throw new Error('No email found');

    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  async deleteAccount(): Promise<void> {
    const session = await getSession();

    const { error } = await supabase.rpc('delete_user_account');
    if (error) throw error;

    await supabase.auth.signOut();
  },
};
