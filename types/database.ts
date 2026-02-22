// ── Shared database types for all Supabase tables ─────────────────────────────

// ── Notes ─────────────────────────────────────────────────────────────────────
export type Priority = 'low' | 'medium' | 'high';
export type NoteCategory = 'munka' | 'tanulás' | 'személyes' | 'ötlet' | 'feladat' | 'egyéb';

export interface Note {
  id: string;
  title: string;
  content: string;
  priority: Priority;
  category: NoteCategory;
  tags: string[];
  project_id: string | null;
  due_date: string | null;
  is_pinned: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface NoteAttachment {
  id: string;
  note_id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

// ── Projects ──────────────────────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  color: string;
  category?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

// ── Habits ────────────────────────────────────────────────────────────────────
export type HabitFrequency = 'daily' | 'weekly' | 'custom';
export type HabitCategory = 'munka' | 'egészség' | 'tanulás' | 'sport' | 'egyéb';
// TODO: energy_level will be a Supabase DB column later
export type EnergyLevel = 'low' | 'medium' | 'high';

export interface Habit {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  frequency: HabitFrequency;
  custom_days: number[] | null;
  category: HabitCategory;
  target_count: number;
  is_archived: boolean;
  energy_level?: EnergyLevel; // TODO: add as DB column later
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  completed_at: string;
  count: number;
  user_id: string;
  created_at: string;
}

export interface HabitStats {
  currentStreak: number;
  longestStreak: number;
  weeklyCompletionRate: number;
  totalCompletions: number;
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export type ChatRole = 'user' | 'assistant';

export type AgentType = 'chat' | 'assistant' | 'thought_interpreter';

export interface ChatMessage {
  id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  agent: AgentType;
  created_at: string;
}

// ── Profiles ──────────────────────────────────────────────────────────────────
export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

// ── Subscriptions ─────────────────────────────────────────────────────────────
export type SubscriptionStatus = 'active' | 'trial' | 'expired' | 'cancelled';

export interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

// ── Hungarian labels ──────────────────────────────────────────────────────────
export const CATEGORY_LABELS: Record<string, string> = {
  munka: 'Munka',
  egészség: 'Egészség',
  tanulás: 'Tanulás',
  sport: 'Sport',
  egyéb: 'Egyéb',
  suli: 'Suli',
  személyes: 'Személyes',
  ötlet: 'Ötlet',
  feladat: 'Feladat',
};

export const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Naponta',
  weekly: 'Hetente',
  custom: 'Egyéni',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Alacsony',
  medium: 'Közepes',
  high: 'Magas',
};

export const ENERGY_LABELS: Record<EnergyLevel, string> = {
  low: 'Alacsony',
  medium: 'Közepes',
  high: 'Magas',
};
