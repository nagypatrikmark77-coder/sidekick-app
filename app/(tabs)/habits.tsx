import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
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
import { CATEGORY_LABELS, type EnergyLevel } from '@/types/database';
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

// ── AI Tips stub ──────────────────────────────────────────────────────────────
// TODO: Replace with actual OpenAI API call later
// Example request shape: POST /api/habit-tip { habit_name, habit_category, streak }
function getHabitTips(): string[] {
  const allTips = [
    'Tedd ki a futocipot az ajto ele estenkent.',
    'Allits 10 perces minimumot — utana szabadon abbahagyhatod.',
    'Kapcsold ossze a szokast egy meglevo rutinnal (pl. kave utan = olvasas).',
    'Hasznalj vizualis emlekeztetot: post-it a tukoron.',
    'Kezdj kicsiben: 2 perc is szamit!',
    'Jutalmazd magad egy kis dologgal a teljesites utan.',
    'Kovess nyomon minden napot — a sorozat motivalni fog.',
    'Ha kihagytad, ne add fel: holnap ujra kezdheted.',
  ];
  // Return 3 random tips
  const shuffled = [...allTips].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

// ── Energy sort order ─────────────────────────────────────────────────────────
const ENERGY_ORDER: Record<EnergyLevel, number> = { low: 0, medium: 1, high: 2 };

// ── Circular Progress ─────────────────────────────────────────────────────────
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
        <Text style={styles.circleProgressText}>{Math.round(progress)}%</Text>
      </View>
    </View>
  );
}

// ── Habit Card ────────────────────────────────────────────────────────────────
function HabitCard({
  habit,
  completed,
  skipped,
  onToggle,
  onMenuPress,
}: {
  habit: Habit;
  completed: boolean;
  skipped: boolean;
  onToggle: (habit: Habit) => void;
  onMenuPress: (habit: Habit) => void;
}) {
  const [weeklyProgress, setWeeklyProgress] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [progress, habitStreak] = await Promise.all([
          habitsStatsService.calculateWeeklyCompletionRate(habit.id),
          habitsStatsService.calculateStreak(habit.id),
        ]);
        setWeeklyProgress(progress);
        setStreak(habitStreak);
      } catch (error) {
        console.error('Error loading habit card data:', error);
      }
    };
    load();
  }, [habit.id, completed]);

  const cardBg = completed
    ? { backgroundColor: Colors.success + '15' }
    : skipped
    ? { opacity: 0.6 }
    : {};

  return (
    <TouchableOpacity
      style={[
        styles.habitCard,
        { borderLeftColor: habit.color, borderLeftWidth: 4 },
        cardBg,
      ]}
      onPress={() => {
        if (!skipped) onToggle(habit);
      }}
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

        <View style={styles.habitActions}>
          {/* Status indicator */}
          {completed ? (
            <View style={[styles.statusBadge, { backgroundColor: Colors.success }]}>
              <Feather name="check" size={16} color={Colors.textWhite} />
            </View>
          ) : skipped ? (
            <View style={[styles.statusBadge, { backgroundColor: Colors.border }]}>
              <Feather name="skip-forward" size={14} color={Colors.textMuted} />
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: Colors.border }]}>
              <Feather name="circle" size={16} color={Colors.textMuted} />
            </View>
          )}

          {/* 3-dot menu */}
          <TouchableOpacity
            style={styles.menuButton}
            onPress={(e) => {
              e.stopPropagation?.();
              onMenuPress(habit);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="more-vertical" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.habitFooter}>
        <View style={styles.habitMeta}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {CATEGORY_LABELS[habit.category] || habit.category}
            </Text>
          </View>
          {skipped && (
            <View style={[styles.categoryBadge, { backgroundColor: Colors.warning + '30' }]}>
              <Text style={[styles.categoryText, { color: Colors.warning }]}>Kihagyva</Text>
            </View>
          )}
          {streak > 0 && !skipped && (
            <StreakBadge streak={streak} size="small" />
          )}
        </View>
        {!skipped && (
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${weeklyProgress}%`, backgroundColor: habit.color },
                ]}
              />
            </View>
            <Text style={styles.progressBarText}>{Math.round(weeklyProgress)}%</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
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

  // Completion status map: habitId -> boolean
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>({});

  // TODO: Later persist skip to habit_logs with a 'skipped' flag in Supabase
  const [skippedToday, setSkippedToday] = useState<Set<string>>(new Set());
  const lastDateRef = useRef<string>(new Date().toISOString().split('T')[0]);

  // Optimization toggle
  const [optimizedOrder, setOptimizedOrder] = useState(false);

  // 3-dot menu
  const [menuHabit, setMenuHabit] = useState<Habit | null>(null);

  // Streak data for bottom section
  const [habitStreaks, setHabitStreaks] = useState<Record<string, number>>({});

  // AI Tips
  const [showTips, setShowTips] = useState(false);
  const [tips, setTips] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    if (!user) return;

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

      // Load completion status for today's habits
      const today = new Date().toISOString().split('T')[0];
      const completions: Record<string, boolean> = {};
      const streaks: Record<string, number> = {};

      await Promise.all(
        todays.map(async (habit) => {
          const [log, habitStreak] = await Promise.all([
            habitLogsService.getLogForDate(habit.id, today),
            habitsStatsService.calculateStreak(habit.id),
          ]);
          completions[habit.id] = log ? log.count >= habit.target_count : false;
          streaks[habit.id] = habitStreak;
        })
      );

      setCompletionMap(completions);
      setHabitStreaks(streaks);
    } catch (error: any) {
      console.error('[habits.tsx] Error loading data:', error);
      Alert.alert('Hiba', 'Nem sikerult betolteni az adatokat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        // Reset skipped habits if the date changed
        const today = new Date().toISOString().split('T')[0];
        if (today !== lastDateRef.current) {
          setSkippedToday(new Set());
          lastDateRef.current = today;
        }
        loadData();
      }
    }, [user, loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleToggleCompletion = async (habit: Habit) => {
    if (completingHabit) return;

    setCompletingHabit(habit.id);

    // Optimistic update
    const wasCompleted = completionMap[habit.id] || false;
    setCompletionMap(prev => ({ ...prev, [habit.id]: !wasCompleted }));

    try {
      const today = new Date().toISOString().split('T')[0];

      if (wasCompleted) {
        await habitLogsService.uncomplete(habit.id, today);
      } else {
        await habitLogsService.logCompletion(habit.id, today, habit.target_count);
      }

      // Reload progress data
      const [progress, streak] = await Promise.all([
        habitsStatsService.getDailyProgress(),
        habitsStatsService.getOverallStreak(),
      ]);
      setDailyProgress(progress);
      setOverallStreak(streak);

      // Update streak for this habit
      const newStreak = await habitsStatsService.calculateStreak(habit.id);
      setHabitStreaks(prev => ({ ...prev, [habit.id]: newStreak }));
    } catch (error) {
      console.error('Error toggling completion:', error);
      // Revert optimistic update
      setCompletionMap(prev => ({ ...prev, [habit.id]: wasCompleted }));
      Alert.alert('Hiba', 'Nem sikerult frissiteni a szokast.');
    } finally {
      setCompletingHabit(null);
    }
  };

  const handleSkip = (habitId: string) => {
    setSkippedToday(prev => {
      const next = new Set(prev);
      next.add(habitId);
      return next;
    });
    setMenuHabit(null);
  };

  const handleDelete = (habit: Habit) => {
    setMenuHabit(null);
    Alert.alert(
      'Szokás törlése',
      'Biztosan törölni szeretnéd? Ez a művelet nem visszavonható.',
      [
        { text: 'Mégse', style: 'cancel' },
        {
          text: 'Törlés',
          style: 'destructive',
          onPress: async () => {
            try {
              await habitsService.deleteHabit(habit.id);
              await loadData();
            } catch (error) {
              Alert.alert('Hiba', 'Nem sikerült törölni a szokást.');
            }
          },
        },
      ]
    );
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

  // Sort today's habits: incomplete first, then skipped, then completed
  // If optimized order is ON, sort incomplete by energy level (low -> high)
  const getSortedHabits = () => {
    const incomplete: Habit[] = [];
    const skipped: Habit[] = [];
    const completed: Habit[] = [];

    for (const h of todaysHabits) {
      if (skippedToday.has(h.id)) {
        skipped.push(h);
      } else if (completionMap[h.id]) {
        completed.push(h);
      } else {
        incomplete.push(h);
      }
    }

    if (optimizedOrder) {
      incomplete.sort((a, b) => {
        const aOrder = ENERGY_ORDER[a.energy_level || 'medium'];
        const bOrder = ENERGY_ORDER[b.energy_level || 'medium'];
        return aOrder - bOrder;
      });
    }

    return { incomplete, skipped, completed };
  };

  const { incomplete, skipped, completed } = getSortedHabits();
  const allSorted = [...incomplete, ...skipped, ...completed];

  const progressPercent = dailyProgress.total > 0
    ? (dailyProgress.completed / dailyProgress.total) * 100
    : 0;

  const remaining = Math.max(0, dailyProgress.total - dailyProgress.completed);
  const allDone = dailyProgress.total > 0 && remaining === 0;

  // Active habits for streak section (non-archived)
  const activeHabits = habits.filter(h => !h.is_archived);

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

        {/* ── Progress Block ──────────────────────────────────────────── */}
        <View style={styles.progressSection}>
          <CircularProgress progress={progressPercent} size={100} />
          <View style={styles.progressInfo}>
            <Text style={styles.progressLabel}>Mai haladás</Text>
            <Text style={styles.progressCount}>
              {dailyProgress.completed} / {dailyProgress.total} teljesítve
            </Text>
            {allDone ? (
              <Text style={styles.allDoneText}>Kész a nap! 🎉</Text>
            ) : dailyProgress.total > 0 ? (
              <Text style={styles.remainingText}>
                Még {remaining} hátra
              </Text>
            ) : null}
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
            {/* ── Optimization Toggle ──────────────────────────────────── */}
            {todaysHabits.length > 1 && (
              <TouchableOpacity
                style={styles.optimizeToggle}
                onPress={() => setOptimizedOrder(!optimizedOrder)}
                activeOpacity={0.7}
              >
                <Feather
                  name="sliders"
                  size={16}
                  color={optimizedOrder ? Colors.primary : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.optimizeToggleText,
                    optimizedOrder && { color: Colors.primary },
                  ]}
                >
                  Optimalizált sorrend
                </Text>
                <View
                  style={[
                    styles.toggleDot,
                    optimizedOrder && styles.toggleDotActive,
                  ]}
                />
              </TouchableOpacity>
            )}

            {/* ── Today's Habits ────────────────────────────────────────── */}
            {allSorted.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Mai szokások</Text>
                {allSorted.map(habit => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    completed={completionMap[habit.id] || false}
                    skipped={skippedToday.has(habit.id)}
                    onToggle={handleToggleCompletion}
                    onMenuPress={setMenuHabit}
                  />
                ))}
              </>
            )}

            {/* ── Archived ──────────────────────────────────────────────── */}
            {archivedHabits.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Archivált</Text>
                {archivedHabits.map(habit => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    completed={completionMap[habit.id] || false}
                    skipped={false}
                    onToggle={handleToggleCompletion}
                    onMenuPress={setMenuHabit}
                  />
                ))}
              </>
            )}

            {/* ── Streak Tracker ────────────────────────────────────────── */}
            {activeHabits.length > 0 && (
              <View style={styles.streakSection}>
                <Text style={styles.sectionTitle}>Sorozatok</Text>
                <View style={styles.streakCard}>
                  {activeHabits.map(habit => (
                    <View key={habit.id} style={styles.streakRow}>
                      <Text style={styles.streakHabitIcon}>{habit.icon}</Text>
                      <Text style={styles.streakHabitName} numberOfLines={1}>
                        {habit.name}
                      </Text>
                      <View style={styles.streakBadgeContainer}>
                        {(habitStreaks[habit.id] || 0) > 0 ? (
                          <StreakBadge streak={habitStreaks[habit.id]} size="small" />
                        ) : (
                          <Text style={styles.noStreakText}>—</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── AI Tips ───────────────────────────────────────────────── */}
            <View style={styles.aiSection}>
              <View style={styles.aiCard}>
                <View style={styles.aiHeader}>
                  <Feather name="cpu" size={18} color={Colors.purple} />
                  <Text style={styles.aiTitle}>AI tipp a végrehajtáshoz</Text>
                </View>
                {showTips && tips.length > 0 ? (
                  <View style={styles.tipsList}>
                    {tips.map((tip, idx) => (
                      <View key={idx} style={styles.tipRow}>
                        <Text style={styles.tipBullet}>•</Text>
                        <Text style={styles.tipText}>{tip}</Text>
                      </View>
                    ))}
                    <TouchableOpacity
                      style={styles.tipRefreshBtn}
                      onPress={() => setTips(getHabitTips())}
                    >
                      <Feather name="refresh-cw" size={14} color={Colors.primary} />
                      <Text style={styles.tipRefreshText}>Új tippek</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.tipButton}
                    onPress={() => {
                      setTips(getHabitTips());
                      setShowTips(true);
                    }}
                  >
                    <Feather name="zap" size={16} color={Colors.primary} />
                    <Text style={styles.tipButtonText}>Kérek tippet</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* ── 3-Dot Menu Modal ──────────────────────────────────────────── */}
      <Modal
        visible={menuHabit !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuHabit(null)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuHabit(null)}
        >
          <View style={styles.menuContent}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuHabitName}>
                {menuHabit?.icon} {menuHabit?.name}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                const id = menuHabit?.id;
                setMenuHabit(null);
                if (id) router.push(`/habits/create?id=${id}`);
              }}
            >
              <Feather name="edit-2" size={18} color={Colors.textMuted} />
              <Text style={styles.menuItemText}>Szerkesztés</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                const id = menuHabit?.id;
                setMenuHabit(null);
                if (id) router.push(`/habits/${id}`);
              }}
            >
              <Feather name="bar-chart-2" size={18} color={Colors.textMuted} />
              <Text style={styles.menuItemText}>Részletek</Text>
            </TouchableOpacity>

            {menuHabit && !skippedToday.has(menuHabit.id) && !completionMap[menuHabit.id] && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  if (menuHabit) handleSkip(menuHabit.id);
                }}
              >
                <Feather name="skip-forward" size={18} color={Colors.warning} />
                <Text style={[styles.menuItemText, { color: Colors.warning }]}>
                  Ma kihagyom
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={() => {
                if (menuHabit) handleDelete(menuHabit);
              }}
            >
              <Feather name="trash-2" size={18} color={Colors.error} />
              <Text style={[styles.menuItemText, { color: Colors.error }]}>Törlés</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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

  // ── Progress Section ──────────────────────────────────────────────
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  circleProgressText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  progressInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  progressLabel: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
  },
  progressCount: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  remainingText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  allDoneText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.success,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  streakText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },

  // ── Optimization Toggle ───────────────────────────────────────────
  optimizeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  optimizeToggleText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
  },
  toggleDot: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleDotActive: {
    backgroundColor: Colors.primary,
  },

  // ── Section Title ─────────────────────────────────────────────────
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },

  // ── Habit Card ────────────────────────────────────────────────────
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
  habitActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButton: {
    padding: Spacing.xs,
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
  progressBarText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    minWidth: 36,
    textAlign: 'right',
  },

  // ── Streak Section ────────────────────────────────────────────────
  streakSection: {
    marginTop: Spacing.lg,
  },
  streakCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  streakHabitIcon: {
    fontSize: FontSize.xxl,
  },
  streakHabitName: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textWhite,
  },
  streakBadgeContainer: {
    minWidth: 50,
    alignItems: 'flex-end',
  },
  noStreakText: {
    fontSize: FontSize.lg,
    color: Colors.textMuted,
  },

  // ── AI Tips ───────────────────────────────────────────────────────
  aiSection: {
    marginTop: Spacing.xxl,
  },
  aiCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.purple + '40',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  aiTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  tipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary + '15',
  },
  tipButtonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  tipsList: {
    gap: Spacing.md,
  },
  tipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tipBullet: {
    fontSize: FontSize.lg,
    color: Colors.purple,
    lineHeight: 22,
  },
  tipText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textMuted,
    lineHeight: 22,
  },
  tipRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  tipRefreshText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },

  // ── Menu Modal ────────────────────────────────────────────────────
  menuOverlay: {
    flex: 1,
    backgroundColor: Colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  menuContent: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    maxWidth: 320,
    overflow: 'hidden',
  },
  menuHeader: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuHabitName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: FontSize.lg,
    color: Colors.textWhite,
    fontWeight: FontWeight.medium,
  },
});
