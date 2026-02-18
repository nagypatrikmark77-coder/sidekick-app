import { supabase } from './supabase';

export type HabitFrequency = 'daily' | 'weekly' | 'custom';
export type HabitCategory = 'munka' | 'egészség' | 'tanulás' | 'sport' | 'egyéb';

export interface Habit {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  frequency: HabitFrequency;
  custom_days: number[] | null; // 0=Sunday, 1=Monday, ..., 6=Saturday
  category: HabitCategory;
  target_count: number; // How many times per day
  archived: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  date: string; // YYYY-MM-DD format
  count: number; // How many times completed on this date
  user_id: string;
  created_at: string;
}

export interface HabitStats {
  currentStreak: number;
  longestStreak: number;
  weeklyCompletionRate: number;
  totalCompletions: number;
}

// Habits CRUD
export const habitsService = {
  // Get all habits for current user
  async getHabits(includeArchived = false): Promise<Habit[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    let query = supabase
      .from('habits')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (!includeArchived) {
      query = query.eq('archived', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Get single habit
  async getHabit(id: string): Promise<Habit | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

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

  // Create habit
  async createHabit(habit: Omit<Habit, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Habit> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('habits')
      .insert({
        ...habit,
        user_id: session.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update habit
  async updateHabit(id: string, updates: Partial<Omit<Habit, 'id' | 'user_id' | 'created_at'>>): Promise<Habit> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('habits')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete habit
  async deleteHabit(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Delete all logs first
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

  // Archive/Unarchive habit
  async toggleArchive(id: string): Promise<Habit> {
    const habit = await this.getHabit(id);
    if (!habit) throw new Error('Habit not found');

    return this.updateHabit(id, { archived: !habit.archived });
  },
};

// Habit Logs
export const habitLogsService = {
  // Log completion for a date
  async logCompletion(habitId: string, date: string, count: number = 1): Promise<HabitLog> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Check if log already exists
    const { data: existing } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('habit_id', habitId)
      .eq('date', date)
      .eq('user_id', session.user.id)
      .single();

    if (existing) {
      // Update existing log
      const { data, error } = await supabase
        .from('habit_logs')
        .update({ count })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Create new log
      const { data, error } = await supabase
        .from('habit_logs')
        .insert({
          habit_id: habitId,
          date,
          count,
          user_id: session.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  // Uncomplete (remove or set count to 0)
  async uncomplete(habitId: string, date: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('habit_logs')
      .delete()
      .eq('habit_id', habitId)
      .eq('date', date)
      .eq('user_id', session.user.id);

    if (error) throw error;
  },

  // Get logs for a habit
  async getHabitLogs(habitId: string, startDate?: string, endDate?: string): Promise<HabitLog[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    let query = supabase
      .from('habit_logs')
      .select('*')
      .eq('habit_id', habitId)
      .eq('user_id', session.user.id)
      .order('date', { ascending: false });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Get log for specific date
  async getLogForDate(habitId: string, date: string): Promise<HabitLog | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('habit_id', habitId)
      .eq('date', date)
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  },

  // Get logs for date range
  async getLogsForDateRange(habitId: string, startDate: string, endDate: string): Promise<HabitLog[]> {
    return this.getHabitLogs(habitId, startDate, endDate);
  },
};

// Stats and calculations
export const habitsStatsService = {
  // Get today's habits (filtered by frequency)
  async getTodaysHabits(): Promise<Habit[]> {
    const habits = await habitsService.getHabits();
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

    return habits.filter(habit => {
      if (habit.frequency === 'daily') return true;
      if (habit.frequency === 'weekly') {
        // Weekly habits are done once per week, check if done this week
        return true; // Show all weekly habits, let user decide
      }
      if (habit.frequency === 'custom') {
        return habit.custom_days?.includes(dayOfWeek) ?? false;
      }
      return false;
    });
  },

  // Calculate current streak for a habit
  async calculateStreak(habitId: string): Promise<number> {
    const habit = await habitsService.getHabit(habitId);
    if (!habit) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let currentDate = new Date(today);
    let streak = 0;

    while (true) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const log = await habitLogsService.getLogForDate(habitId, dateStr);

      // Check if habit should be done on this day
      const shouldBeDone = this.shouldHabitBeDoneOnDate(habit, currentDate);

      if (shouldBeDone) {
        if (log && log.count >= habit.target_count) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      } else {
        // If habit shouldn't be done today, skip but don't break streak
        currentDate.setDate(currentDate.getDate() - 1);
        continue;
      }

      // Prevent infinite loop
      if (streak > 1000) break;
    }

    return streak;
  },

  // Calculate longest streak
  async calculateLongestStreak(habitId: string): Promise<number> {
    const logs = await habitLogsService.getHabitLogs(habitId);
    const habit = await habitsService.getHabit(habitId);
    if (!habit || logs.length === 0) return 0;

    // Sort logs by date
    const sortedLogs = logs.sort((a, b) => a.date.localeCompare(b.date));

    let longestStreak = 0;
    let currentStreak = 0;
    let lastDate: Date | null = null;

    for (const log of sortedLogs) {
      const logDate = new Date(log.date);
      if (log.count >= habit.target_count) {
        if (lastDate) {
          const daysDiff = Math.floor((logDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff === 1) {
            currentStreak++;
          } else {
            longestStreak = Math.max(longestStreak, currentStreak);
            currentStreak = 1;
          }
        } else {
          currentStreak = 1;
        }
        lastDate = logDate;
      } else {
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 0;
        lastDate = null;
      }
    }

    return Math.max(longestStreak, currentStreak);
  },

  // Calculate weekly completion rate
  async calculateWeeklyCompletionRate(habitId: string): Promise<number> {
    const habit = await habitsService.getHabit(habitId);
    if (!habit) return 0;

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartStr = weekStart.toISOString().split('T')[0];
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
        const log = logs.find(l => l.date === dateStr);
        if (log && log.count >= habit.target_count) {
          completedDays++;
        }
      }
    }

    return expectedDays > 0 ? (completedDays / expectedDays) * 100 : 0;
  },

  // Helper: Check if habit should be done on a specific date
  shouldHabitBeDoneOnDate(habit: Habit, date: Date): boolean {
    if (habit.frequency === 'daily') return true;
    if (habit.frequency === 'weekly') {
      // Weekly habits can be done any day of the week
      return true;
    }
    if (habit.frequency === 'custom') {
      const dayOfWeek = date.getDay();
      return habit.custom_days?.includes(dayOfWeek) ?? false;
    }
    return false;
  },

  // Get overall daily progress (how many habits completed today)
  async getDailyProgress(): Promise<{ completed: number; total: number }> {
    const todaysHabits = await this.getTodaysHabits();
    const today = new Date().toISOString().split('T')[0];

    let completed = 0;
    for (const habit of todaysHabits) {
      const log = await habitLogsService.getLogForDate(habit.id, today);
      if (log && log.count >= habit.target_count) {
        completed++;
      }
    }

    return { completed, total: todaysHabits.length };
  },

  // Get overall streak (consecutive days with all habits done)
  async getOverallStreak(): Promise<number> {
    const habits = await habitsService.getHabits();
    if (habits.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let currentDate = new Date(today);
    let streak = 0;

    while (true) {
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

      if (streak > 1000) break;
    }

    return streak;
  },

  // Get weekly stats
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

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = today.toISOString().split('T')[0];

    let totalCompletions = 0;
    let totalExpected = 0;
    const habitRates: { habit: Habit; rate: number }[] = [];

    for (const habit of habits) {
      const rate = await this.calculateWeeklyCompletionRate(habit.id);
      habitRates.push({ habit, rate });

      // Count expected and completed days
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        if (this.shouldHabitBeDoneOnDate(habit, date)) {
          totalExpected++;
          const dateStr = date.toISOString().split('T')[0];
          const log = await habitLogsService.getLogForDate(habit.id, dateStr);
          if (log && log.count >= habit.target_count) {
            totalCompletions++;
          }
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
