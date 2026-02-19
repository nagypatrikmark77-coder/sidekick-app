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
import { CATEGORY_LABELS } from '@/types/database';
import { StreakBadge } from '@/components/StreakBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAuth } from '@/contexts/AuthContext';
import {
  Colors,
  Spacing,
  Radius,
  FontSize,
  FontWeight,
  HEADER_PADDING_TOP,
} from '@/constants/theme';

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
          stroke={Colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={Colors.success}
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
      const archived = allHabits.filter(h => h.is_archived);

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
            <Feather name="check" size={20} color={Colors.textWhite} />
          ) : (
            <Feather name="circle" size={20} color={Colors.textMuted} />
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

  const progressPercent = dailyProgress.total > 0
    ? (dailyProgress.completed / dailyProgress.total) * 100
    : 0;

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Szokáskövetés</Text>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.push('/habits/create')}
        >
          <Feather name="plus" size={24} color={Colors.textWhite} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
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
          <EmptyState
            icon="target"
            title="Még nincsenek szokásaid"
            subtitle="Hozz létre egy új szokást a + gombbal"
            actionLabel="Első szokás létrehozása"
            onAction={() => router.push('/habits/create')}
          />
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: HEADER_PADDING_TOP,
    paddingBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.xl,
    paddingBottom: 100,
  },
  dateContainer: {
    marginBottom: Spacing.xxl,
  },
  dateText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'capitalize',
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  progressText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  progressInfo: {
    flex: 1,
    gap: Spacing.sm,
  },
  progressLabel: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
  },
  progressCount: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  streakText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  habitCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  habitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  habitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.md,
  },
  habitIcon: {
    fontSize: FontSize.hero,
  },
  habitText: {
    flex: 1,
  },
  habitName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    marginBottom: Spacing.xs,
  },
  habitDescription: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  checkButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkButtonCompleted: {
    backgroundColor: Colors.success,
  },
  habitFooter: {
    gap: Spacing.sm,
  },
  habitMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  categoryBadge: {
    backgroundColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  categoryText: {
    fontSize: FontSize.sm,
    color: Colors.textWhite,
    fontWeight: FontWeight.semibold,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
