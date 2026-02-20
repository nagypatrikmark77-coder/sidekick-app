import { supabase } from './supabase';
import type { Habit, HabitLog, HabitStats } from '@/types/database';

// Re-export types for convenience
export type { Habit, HabitLog, HabitStats, HabitFrequency, HabitCategory } from '@/types/database';

// ── Habits CRUD ───────────────────────────────────────────────────────────────

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session;
}

export const habitsService = {
  async getHabits(includeArchived = false): Promise<Habit[]> {
    const session = await getSession();

    console.log('[habits-service] getHabits called');
    console.log('[habits-service] User ID:', session.user.id);
    console.log('[habits-service] Include archived:', includeArchived);

    let query = supabase
      .from('habits')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
      console.log('[habits-service] Filtering: is_archived = false');
    } else {
      console.log('[habits-service] Including archived habits');
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('[habits-service] Error fetching habits:', error);
      console.error('[habits-service] Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }

    console.log('[habits-service] Fetched habits:', data?.length || 0);
    console.log('[habits-service] Habits data:', data);
    return data || [];
  },

  async getHabit(id: string): Promise<Habit | null> {
    const session = await getSession();

    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  },

  async createHabit(habit: Omit<Habit, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Habit> {
    const session = await getSession();

    const { data, error } = await supabase
      .from('habits')
      .insert({ ...habit, user_id: session.user.id })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateHabit(id: string, updates: Partial<Omit<Habit, 'id' | 'user_id' | 'created_at'>>): Promise<Habit> {
    const session = await getSession();

    const { data, error } = await supabase
      .from('habits')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteHabit(id: string): Promise<void> {
    const session = await getSession();

    await supabase
      .from('habit_logs')
      .delete()
      .eq('habit_id', id)
      .eq('user_id', session.user.id);

    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) throw error;
  },

  async toggleArchive(id: string): Promise<Habit> {
    const habit = await this.getHabit(id);
    if (!habit) throw new Error('Habit not found');
    return this.updateHabit(id, { is_archived: !habit.is_archived });
  },
};

// ── Habit Logs ────────────────────────────────────────────────────────────────

export const habitLogsService = {
  async logCompletion(habitId: string, date: string, count: number = 1): Promise<HabitLog> {
    const session = await getSession();

    const { data: existing } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('habit_id', habitId)
      .eq('completed_at', date)
      .eq('user_id', session.user.id)
      .single();

    if (existing) {
      const { data, error } = await supabase
        .from('habit_logs')
        .update({ count })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('habit_logs')
        .insert({ habit_id: habitId, completed_at: date, count, user_id: session.user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  async uncomplete(habitId: string, date: string): Promise<void> {
    const session = await getSession();

    const { error } = await supabase
      .from('habit_logs')
      .delete()
      .eq('habit_id', habitId)
      .eq('completed_at', date)
      .eq('user_id', session.user.id);

    if (error) throw error;
  },

  async getHabitLogs(habitId: string, startDate?: string, endDate?: string): Promise<HabitLog[]> {
    const session = await getSession();

    let query = supabase
      .from('habit_logs')
      .select('*')
      .eq('habit_id', habitId)
      .eq('user_id', session.user.id)
      .order('completed_at', { ascending: false });

    if (startDate) query = query.gte('completed_at', startDate);
    if (endDate) query = query.lte('completed_at', endDate);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getLogForDate(habitId: string, date: string): Promise<HabitLog | null> {
    const session = await getSession();

    const { data, error } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('habit_id', habitId)
      .eq('completed_at', date)
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  },

  async getLogsForDateRange(habitId: string, startDate: string, endDate: string): Promise<HabitLog[]> {
    return this.getHabitLogs(habitId, startDate, endDate);
  },
};

// ── Stats ─────────────────────────────────────────────────────────────────────

export const habitsStatsService = {
  async getTodaysHabits(): Promise<Habit[]> {
    const habits = await habitsService.getHabits();
    const dayOfWeek = new Date().getDay();

    return habits.filter(habit => {
      if (habit.frequency === 'daily') return true;
      if (habit.frequency === 'weekly') return true;
      if (habit.frequency === 'custom') {
        return habit.custom_days?.includes(dayOfWeek) ?? false;
      }
      return false;
    });
  },

  shouldHabitBeDoneOnDate(habit: Habit, date: Date): boolean {
    if (habit.frequency === 'daily') return true;
    if (habit.frequency === 'weekly') return true;
    if (habit.frequency === 'custom') {
      return habit.custom_days?.includes(date.getDay()) ?? false;
    }
    return false;
  },

  async calculateStreak(habitId: string): Promise<number> {
    const habit = await habitsService.getHabit(habitId);
    if (!habit) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let currentDate = new Date(today);
    let streak = 0;

    while (streak <= 1000) {
      const dateStr = currentDate.toISOString().split('T')[0];

      if (!this.shouldHabitBeDoneOnDate(habit, currentDate)) {
        currentDate.setDate(currentDate.getDate() - 1);
        continue;
      }

      const log = await habitLogsService.getLogForDate(habitId, dateStr);
      if (log && log.count >= habit.target_count) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  },

  async calculateLongestStreak(habitId: string): Promise<number> {
    const logs = await habitLogsService.getHabitLogs(habitId);
    const habit = await habitsService.getHabit(habitId);
    if (!habit || logs.length === 0) return 0;

    const sortedLogs = logs.sort((a, b) => a.completed_at.localeCompare(b.completed_at));

    let longestStreak = 0;
    let currentStreak = 0;
    let lastDate: Date | null = null;

    for (const log of sortedLogs) {
      const logDate = new Date(log.completed_at);
      if (log.count >= habit.target_count) {
        if (lastDate) {
          const daysDiff = Math.floor((logDate.getTime() - lastDate.getTime()) / 86400000);
          currentStreak = daysDiff === 1 ? currentStreak + 1 : 1;
        } else {
          currentStreak = 1;
        }
        longestStreak = Math.max(longestStreak, currentStreak);
        lastDate = logDate;
      } else {
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 0;
        lastDate = null;
      }
    }

    return Math.max(longestStreak, currentStreak);
  },

  async calculateWeeklyCompletionRate(habitId: string): Promise<number> {
    const habit = await habitsService.getHabit(habitId);
    if (!habit) return 0;

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const logs = await habitLogsService.getLogsForDateRange(habitId, weekStartStr, weekEndStr);

    let expectedDays = 0;
    let completedDays = 0;

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);

      if (this.shouldHabitBeDoneOnDate(habit, date)) {
        expectedDays++;
        const dateStr = date.toISOString().split('T')[0];
        const log = logs.find(l => l.completed_at === dateStr);
        if (log && log.count >= habit.target_count) {
          completedDays++;
        }
      }
    }

    return expectedDays > 0 ? (completedDays / expectedDays) * 100 : 0;
  },

  async getDailyProgress(): Promise<{ completed: number; total: number }> {
    const todaysHabits = await this.getTodaysHabits();
    const today = new Date().toISOString().split('T')[0];

    let completed = 0;
    for (const habit of todaysHabits) {
      const log = await habitLogsService.getLogForDate(habit.id, today);
      if (log && log.count >= habit.target_count) completed++;
    }

    return { completed, total: todaysHabits.length };
  },

  async getOverallStreak(): Promise<number> {
    const habits = await habitsService.getHabits();
    if (habits.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let currentDate = new Date(today);
    let streak = 0;

    while (streak <= 1000) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const todaysHabits = habits.filter(h => this.shouldHabitBeDoneOnDate(h, currentDate));

      if (todaysHabits.length === 0) {
        currentDate.setDate(currentDate.getDate() - 1);
        continue;
      }

      let allDone = true;
      for (const habit of todaysHabits) {
        const log = await habitLogsService.getLogForDate(habit.id, dateStr);
        if (!log || log.count < habit.target_count) {
          allDone = false;
          break;
        }
      }

      if (allDone) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  },

  async getWeeklyStats(): Promise<{
    totalHabits: number;
    completedHabits: number;
    bestStreak: number;
    mostConsistent: { habit: Habit; rate: number } | null;
    leastConsistent: { habit: Habit; rate: number } | null;
  }> {
    const habits = await habitsService.getHabits();
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);

    let totalCompletions = 0;
    const habitRates: { habit: Habit; rate: number }[] = [];

    for (const habit of habits) {
      const rate = await this.calculateWeeklyCompletionRate(habit.id);
      habitRates.push({ habit, rate });

      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        if (this.shouldHabitBeDoneOnDate(habit, date)) {
          const dateStr = date.toISOString().split('T')[0];
          const log = await habitLogsService.getLogForDate(habit.id, dateStr);
          if (log && log.count >= habit.target_count) totalCompletions++;
        }
      }
    }

    const bestStreak = await this.getOverallStreak();
    const mostConsistent = habitRates.length > 0
      ? habitRates.reduce((max, curr) => curr.rate > max.rate ? curr : max)
      : null;
    const leastConsistent = habitRates.length > 0
      ? habitRates.reduce((min, curr) => curr.rate < min.rate ? curr : min)
      : null;

    return {
      totalHabits: habits.length,
      completedHabits: totalCompletions,
      bestStreak,
      mostConsistent,
      leastConsistent,
    };
  },
};
