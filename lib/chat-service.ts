import { supabase } from './supabase';
import type { ChatMessage, ChatRole } from '@/types/database';

export type { ChatMessage, ChatRole } from '@/types/database';

const WEBHOOK_URL = 'https://YOUR-N8N-URL/webhook/sidekick-chat';

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session;
}

export const chatService = {
  async getMessages(): Promise<ChatMessage[]> {
    const session = await getSession();

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async saveMessage(role: ChatRole, content: string): Promise<ChatMessage> {
    const session = await getSession();

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: session.user.id,
        role,
        content,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async sendToWebhook(message: string): Promise<string> {
    const session = await getSession();

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        userId: session.user.id,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook error: ${response.status}`);
    }

    const data = await response.json();
    return data.reply || data.message || data.response || 'Nem kaptam választ.';
  },

  async clearConversation(): Promise<void> {
    const session = await getSession();

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', session.user.id);

    if (error) throw error;
  },
};
