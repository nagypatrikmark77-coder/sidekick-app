import { supabase } from './supabase';
import { N8N_WEBHOOK_URL, WEBHOOK_TIMEOUT_MS } from '@/constants/api';
import type { ChatMessage, ChatRole } from '@/types/database';

export type { ChatMessage, ChatRole } from '@/types/database';

// TODO: Add agent selector UI (chat, thought_interpreter, assistant)
export type AgentType = 'chat' | 'thought_interpreter' | 'assistant';

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session;
}

export const chatService = {
  async getMessages(limit = 50): Promise<ChatMessage[]> {
    const session = await getSession();

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true })
      .limit(limit);

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

  async sendToWebhook(message: string, agent: AgentType = 'chat'): Promise<string> {
    const session = await getSession();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session.user.id,
          message,
          agent,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.output) {
        return 'Nem kaptam választ. Próbáld újra.';
      }

      return data.output;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        return 'A válasz túl sokáig tartott. Próbáld újra.';
      }

      if (error.message?.includes('Network') || error.message?.includes('fetch')) {
        return 'Hiba történt a kapcsolódásban. Ellenőrizd az internetkapcsolatod.';
      }

      return 'Hiba történt a kapcsolódásban. Ellenőrizd az internetkapcsolatod.';
    }
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
