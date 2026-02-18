import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
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

function CircularProgress({ progress, size = 80 }: { progress: number; size?: number }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.success}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.progressText}>{Math.round(progress)}%</Text>
      </View>
    </View>
  );
}

export default function Habits() {
  const router = useRouter();
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todaysHabits, setTodaysHabits] = useState<Habit[]>([]);
  const [archivedHabits, setArchivedHabits] = useState<Habit[]>([]);
  const [dailyProgress, setDailyProgress] = useState({ completed: 0, total: 0 });
  const [overallStreak, setOverallStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completingHabit, setCompletingHabit] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [allHabits, progress, streak] = await Promise.all([
        habitsService.getHabits(true),
        habitsStatsService.getDailyProgress(),
        habitsStatsService.getOverallStreak(),
      ]);

      const todays = await habitsStatsService.getTodaysHabits();
      const archived = allHabits.filter(h => h.archived);

      setHabits(allHabits);
      setTodaysHabits(todays);
      setArchivedHabits(archived);
      setDailyProgress(progress);
      setOverallStreak(streak);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Hiba', 'Nem sikerült betölteni az adatokat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleToggleCompletion = async (habit: Habit) => {
    if (completingHabit) return;

    setCompletingHabit(habit.id);
    try {
      const today = new Date().toISOString().split('T')[0];
      const existingLog = await habitLogsService.getLogForDate(habit.id, today);

      if (existingLog && existingLog.count >= habit.target_count) {
        // Uncomplete
        await habitLogsService.uncomplete(habit.id, today);
      } else {
        // Complete
        await habitLogsService.logCompletion(habit.id, today, habit.target_count);
      }

      await loadData();
    } catch (error) {
      console.error('Error toggling completion:', error);
      Alert.alert('Hiba', 'Nem sikerült frissíteni a szokást.');
    } finally {
      setCompletingHabit(null);
    }
  };


  const formatDate = () => {
    const today = new Date();
    return today.toLocaleDateString('hu-HU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

function HabitCard({
  habit,
  onToggle,
  onPress,
  completing,
}: {
  habit: Habit;
  onToggle: (habit: Habit) => void;
  onPress: (habit: Habit) => void;
  completing: string | null;
}) {
  const [completed, setCompleted] = useState(false);
  const [count, setCount] = useState(0);
  const [weeklyProgress, setWeeklyProgress] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHabitData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [log, progress, habitStreak] = await Promise.all([
          habitLogsService.getLogForDate(habit.id, today),
          habitsStatsService.calculateWeeklyCompletionRate(habit.id),
          habitsStatsService.calculateStreak(habit.id),
        ]);
        setCompleted(log ? log.count >= habit.target_count : false);
        setCount(log?.count || 0);
        setWeeklyProgress(progress);
        setStreak(habitStreak);
      } catch (error) {
        console.error('Error loading habit data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadHabitData();
  }, [habit.id, habit.target_count]);

  return (
    <TouchableOpacity
      style={[styles.habitCard, { borderLeftColor: habit.color, borderLeftWidth: 4 }]}
      onPress={() => onPress(habit)}
      activeOpacity={0.7}
    >
      <View style={styles.habitHeader}>
        <View style={styles.habitInfo}>
          <Text style={styles.habitIcon}>{habit.icon}</Text>
          <View style={styles.habitText}>
            <Text style={styles.habitName}>{habit.name}</Text>
            {habit.description && (
              <Text style={styles.habitDescription} numberOfLines={1}>
                {habit.description}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.checkButton,
            completed && styles.checkButtonCompleted,
          ]}
          onPress={() => onToggle(habit)}
          disabled={completing === habit.id}
          activeOpacity={0.7}
        >
          {completed ? (
            <Feather name="check" size={20} color={COLORS.textWhite} />
          ) : (
            <Feather name="circle" size={20} color={COLORS.textMuted} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.habitFooter}>
        <View style={styles.habitMeta}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {CATEGORY_LABELS[habit.category] || habit.category}
            </Text>
          </View>
          {!loading && streak > 0 && (
            <StreakBadge streak={streak} size="small" />
          )}
        </View>
        {!loading && (
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${weeklyProgress}%`, backgroundColor: habit.color },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{Math.round(weeklyProgress)}%</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather name="target" size={64} color={COLORS.textMuted} />
      <Text style={styles.emptyTitle}>Még nincsenek szokásaid</Text>
      <Text style={styles.emptyText}>
        Hozz létre egy új szokást a + gombbal
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => router.push('/habits/create')}
      >
        <Text style={styles.emptyButtonText}>Első szokás létrehozása</Text>
      </TouchableOpacity>
    </View>
  );

  const progressPercent = dailyProgress.total > 0
    ? (dailyProgress.completed / dailyProgress.total) * 100
    : 0;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Szokáskövetés</Text>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/habits/create')}
          >
            <Feather name="plus" size={24} color={COLORS.textWhite} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Betöltés...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Szokáskövetés</Text>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.push('/habits/create')}
        >
          <Feather name="plus" size={24} color={COLORS.textWhite} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primaryBlue}
          />
        }
      >
        <View style={styles.dateContainer}>
          <Text style={styles.dateText}>{formatDate()}</Text>
        </View>

        <View style={styles.progressSection}>
          <CircularProgress progress={progressPercent} size={100} />
          <View style={styles.progressInfo}>
            <Text style={styles.progressLabel}>Mai haladás</Text>
            <Text style={styles.progressCount}>
              {dailyProgress.completed} / {dailyProgress.total}
            </Text>
            {overallStreak > 0 && (
              <View style={styles.streakContainer}>
                <StreakBadge streak={overallStreak} size="medium" />
                <Text style={styles.streakText}>napos sorozat</Text>
              </View>
            )}
          </View>
        </View>

        {habits.length === 0 ? (
          renderEmpty()
        ) : (
          <>
            {todaysHabits.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Mai szokások</Text>
                {todaysHabits.map(habit => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    onToggle={handleToggleCompletion}
                    onPress={(h) => router.push(`/habits/${h.id}`)}
                    completing={completingHabit}
                  />
                ))}
              </>
            )}

            {archivedHabits.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Archivált</Text>
                {archivedHabits.map(habit => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    onToggle={handleToggleCompletion}
                    onPress={(h) => router.push(`/habits/${h.id}`)}
                    completing={completingHabit}
                  />
                ))}
              </>
            )}
          </>
        )}
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
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.textWhite,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  dateContainer: {
    marginBottom: 24,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'capitalize',
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 20,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textWhite,
  },
  progressInfo: {
    flex: 1,
    gap: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  progressCount: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textWhite,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textWhite,
    marginTop: 24,
    marginBottom: 12,
  },
  habitCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  habitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  habitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  habitIcon: {
    fontSize: 32,
  },
  habitText: {
    flex: 1,
  },
  habitName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textWhite,
    marginBottom: 4,
  },
  habitDescription: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  checkButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkButtonCompleted: {
    backgroundColor: COLORS.success,
  },
  habitFooter: {
    gap: 8,
  },
  habitMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 12,
    color: COLORS.textWhite,
    fontWeight: '600',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textWhite,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: COLORS.primaryBlue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: COLORS.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 16,
  },
});
