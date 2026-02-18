import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  habitsService,
  habitsStatsService,
  habitLogsService,
  type Habit,
} from '@/lib/habits-service';
import { StreakBadge } from '@/components/StreakBadge';
import { useAuth } from '@/contexts/AuthContext';

const COLORS = {
  background: '#0A0A0F',
  card: '#1A1A2E',
  border: '#2A2A4A',
  primaryBlue: '#3B82F6',
  textWhite: '#FFFFFF',
  textMuted: '#9CA3AF',
  success: '#22C55E',
  warning: '#F59E0B',
};

const CATEGORY_LABELS: Record<string, string> = {
  munka: 'Munka',
  egészség: 'Egészség',
  tanulás: 'Tanulás',
  sport: 'Sport',
  egyéb: 'Egyéb',
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Naponta',
  weekly: 'Hetente',
  custom: 'Egyéni',
};

function CalendarHeatmap({ habitId, habit }: { habitId: string; habit: Habit }) {
  const [logs, setLogs] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, [habitId]);

  const loadLogs = async () => {
    try {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 29); // Last 30 days

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = today.toISOString().split('T')[0];

      const habitLogs = await habitLogsService.getLogsForDateRange(habitId, startDateStr, endDateStr);

      const logMap: Record<string, number> = {};
      habitLogs.forEach(log => {
        logMap[log.date] = log.count;
      });

      setLogs(logMap);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDays = () => {
    const days = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      days.push(date);
    }
    return days;
  };

  const days = getDays();

  return (
    <View style={styles.heatmapContainer}>
      <Text style={styles.heatmapTitle}>Utolsó 30 nap</Text>
      <View style={styles.heatmapGrid}>
        {days.map((date, index) => {
          const dateStr = date.toISOString().split('T')[0];
          const count = logs[dateStr] || 0;
          const isCompleted = count >= habit.target_count;

          return (
            <View
              key={index}
              style={[
                styles.heatmapDay,
                isCompleted && { backgroundColor: COLORS.success },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function HabitDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [weeklyRate, setWeeklyRate] = useState(0);
  const [totalCompletions, setTotalCompletions] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && user) {
      loadHabit();
    }
  }, [id, user]);

  const loadHabit = async () => {
    try {
      const habitData = await habitsService.getHabit(id);
      if (!habitData) {
        Alert.alert('Hiba', 'A szokás nem található.');
        router.back();
        return;
      }

      setHabit(habitData);

      const [streak, longest, rate, logs] = await Promise.all([
        habitsStatsService.calculateStreak(id),
        habitsStatsService.calculateLongestStreak(id),
        habitsStatsService.calculateWeeklyCompletionRate(id),
        habitLogsService.getHabitLogs(id),
      ]);

      setCurrentStreak(streak);
      setLongestStreak(longest);
      setWeeklyRate(rate);
      setTotalCompletions(logs.reduce((sum, log) => sum + log.count, 0));
    } catch (error) {
      console.error('Error loading habit:', error);
      Alert.alert('Hiba', 'Nem sikerült betölteni a szokást.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Szokás törlése',
      'Biztosan törölni szeretnéd ezt a szokást? Ez a művelet nem visszavonható.',
      [
        { text: 'Mégse', style: 'cancel' },
        {
          text: 'Törlés',
          style: 'destructive',
          onPress: async () => {
            try {
              await habitsService.deleteHabit(id);
              router.back();
            } catch (error) {
              Alert.alert('Hiba', 'Nem sikerült törölni a szokást.');
            }
          },
        },
      ]
    );
  };

  if (loading || !habit) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Feather name="arrow-left" size={24} color={COLORS.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Betöltés...</Text>
          <View style={styles.headerButton} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Feather name="arrow-left" size={24} color={COLORS.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Szokás részletei</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push(`/habits/create?id=${id}`)}
            style={styles.headerButton}
          >
            <Feather name="edit-2" size={20} color={COLORS.primaryBlue} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
            <Feather name="trash-2" size={20} color={COLORS.warning} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.habitHeader}>
          <Text style={styles.habitIcon}>{habit.icon}</Text>
          <View style={styles.habitInfo}>
            <Text style={styles.habitName}>{habit.name}</Text>
            {habit.description && (
              <Text style={styles.habitDescription}>{habit.description}</Text>
            )}
            <View style={styles.habitMeta}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>
                  {CATEGORY_LABELS[habit.category] || habit.category}
                </Text>
              </View>
              <Text style={styles.frequencyText}>
                {FREQUENCY_LABELS[habit.frequency]}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Jelenlegi sorozat</Text>
            <View style={styles.statValue}>
              <StreakBadge streak={currentStreak} size="large" />
              <Text style={styles.statNumber}>{currentStreak} nap</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Leghosszabb sorozat</Text>
            <View style={styles.statValue}>
              <StreakBadge streak={longestStreak} size="large" />
              <Text style={styles.statNumber}>{longestStreak} nap</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Heti teljesítmény</Text>
            <Text style={styles.statPercentage}>{Math.round(weeklyRate)}%</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Összes teljesítés</Text>
            <Text style={styles.statNumber}>{totalCompletions}</Text>
          </View>
        </View>

        <CalendarHeatmap habitId={id} habit={habit} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textWhite,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  habitHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 16,
  },
  habitIcon: {
    fontSize: 48,
  },
  habitInfo: {
    flex: 1,
  },
  habitName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textWhite,
    marginBottom: 8,
  },
  habitDescription: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginBottom: 12,
    lineHeight: 22,
  },
  habitMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryBadge: {
    backgroundColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 12,
    color: COLORS.textWhite,
    fontWeight: '600',
  },
  frequencyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginBottom: 8,
  },
  statValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textWhite,
  },
  statPercentage: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.success,
  },
  heatmapContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  heatmapTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textWhite,
    marginBottom: 16,
  },
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  heatmapDay: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
});
