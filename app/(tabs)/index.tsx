import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { Image } from 'expo-image';
import { supabase } from '@/lib/supabase';
import { habitsService, habitsStatsService, habitLogsService, type Habit } from '@/lib/habits-service';
import { notesService, projectsService, type Note, type Project } from '@/lib/notes-service';
import { StreakBadge } from '@/components/StreakBadge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAuth } from '@/contexts/AuthContext';
import {
  Colors,
  PriorityColors,
  Spacing,
  Radius,
  FontSize,
  FontWeight,
  HEADER_PADDING_TOP,
} from '@/constants/theme';

function QuickHabitItem({
  habit,
  onToggle,
  completing,
}: {
  habit: Habit;
  onToggle: (habit: Habit) => void;
  completing: string | null;
}) {
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkCompletion = async () => {
      const today = new Date().toISOString().split('T')[0];
      const log = await habitLogsService.getLogForDate(habit.id, today);
      setCompleted(log ? log.count >= habit.target_count : false);
      setLoading(false);
    };
    checkCompletion();
  }, [habit.id, habit.target_count]);

  return (
    <TouchableOpacity
      style={styles.quickHabitItem}
      onPress={() => onToggle(habit)}
      disabled={completing === habit.id || loading}
    >
      <View style={[styles.quickHabitCheck, completed && styles.quickHabitCheckCompleted]}>
        {completed && (
          <Feather name="check" size={14} color={Colors.textWhite} />
        )}
      </View>
      <Text style={styles.quickHabitText} numberOfLines={1}>
        {habit.icon} {habit.name}
      </Text>
    </TouchableOpacity>
  );
}

function ProjectCard({
  project,
  onPress,
}: {
  project: Project;
  onPress: () => void;
}) {
  const [noteCount, setNoteCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCount = async () => {
      try {
        const notes = await notesService.getNotes(project.id);
        setNoteCount(notes.length);
      } catch (error) {
        console.error('Error loading note count:', error);
      } finally {
        setLoading(false);
      }
    };
    loadCount();
  }, [project.id]);

  return (
    <TouchableOpacity
      style={[styles.projectCard, { borderLeftColor: project.color, borderLeftWidth: 4 }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.projectName}>{project.name}</Text>
      <Text style={styles.projectCount}>
        {loading ? '...' : `${noteCount} jegyzet`}
      </Text>
    </TouchableOpacity>
  );
}

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

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [dailyProgress, setDailyProgress] = useState({ completed: 0, total: 0 });
  const [overallStreak, setOverallStreak] = useState(0);
  const [todaysHabits, setTodaysHabits] = useState<Habit[]>([]);
  const [uncompletedHabits, setUncompletedHabits] = useState<Habit[]>([]);
  const [upcomingNotes, setUpcomingNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);
  const [completingHabit, setCompletingHabit] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Load user profile
      const { data: profile } = await supabase
        .from('PROFILES')
        .select('name, avatar_url')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        setUserName(profile.name);
        setUserAvatar(profile.avatar_url);
      }

      // Load habits data
      const [progress, streak, habits] = await Promise.all([
        habitsStatsService.getDailyProgress(),
        habitsStatsService.getOverallStreak(),
        habitsStatsService.getTodaysHabits(),
      ]);

      setDailyProgress(progress);
      setOverallStreak(streak);
      setTodaysHabits(habits);

      // Get uncompleted habits
      const today = new Date().toISOString().split('T')[0];
      const uncompleted: Habit[] = [];
      for (const habit of habits.slice(0, 3)) {
        const log = await habitLogsService.getLogForDate(habit.id, today);
        if (!log || log.count < habit.target_count) {
          uncompleted.push(habit);
        }
      }
      setUncompletedHabits(uncompleted);

      // Load upcoming notes (next 7 days)
      const allNotes = await notesService.getNotes();
      const todayDate = new Date();
      const nextWeek = new Date(todayDate);
      nextWeek.setDate(todayDate.getDate() + 7);

      const upcoming = allNotes
        .filter(note => {
          if (!note.due_date) return false;
          const dueDate = new Date(note.due_date);
          return dueDate >= todayDate && dueDate <= nextWeek;
        })
        .sort((a, b) => {
          const dateA = new Date(a.due_date!).getTime();
          const dateB = new Date(b.due_date!).getTime();
          return dateA - dateB;
        })
        .slice(0, 5);

      setUpcomingNotes(upcoming);

      // Load projects
      const projectsData = await projectsService.getProjects();
      setProjects(projectsData);

      // Load recent notes
      const recent = allNotes
        .sort((a, b) => {
          const dateA = new Date(a.updated_at || a.created_at).getTime();
          const dateB = new Date(b.updated_at || b.created_at).getTime();
          return dateB - dateA;
        })
        .slice(0, 5);

      setRecentNotes(recent);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
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

  const handleQuickNote = async () => {
    if (!quickNoteText.trim()) return;

    setCreatingNote(true);
    try {
      await notesService.createNote({
        title: quickNoteText.trim(),
        content: '',
        priority: 'low',
        category: 'egyéb', // Using 'egyéb' as it's the closest to "gyors" in available categories
        tags: [],
        project_id: null,
        due_date: null,
        pinned: false,
      });
      setQuickNoteText('');
      loadData();
    } catch (error) {
      console.error('Error creating quick note:', error);
    } finally {
      setCreatingNote(false);
    }
  };

  const handleToggleHabit = async (habit: Habit) => {
    if (completingHabit) return;

    setCompletingHabit(habit.id);
    try {
      const today = new Date().toISOString().split('T')[0];
      const existingLog = await habitLogsService.getLogForDate(habit.id, today);

      if (existingLog && existingLog.count >= habit.target_count) {
        await habitLogsService.uncomplete(habit.id, today);
      } else {
        await habitLogsService.logCompletion(habit.id, today, habit.target_count);
      }

      await loadData();
    } catch (error) {
      console.error('Error toggling habit:', error);
    } finally {
      setCompletingHabit(null);
    }
  };

  const formatDate = () => {
    const today = new Date();
    const days = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
    const months = [
      'január', 'február', 'március', 'április', 'május', 'június',
      'július', 'augusztus', 'szeptember', 'október', 'november', 'december',
    ];

    const dayName = days[today.getDay()];
    const monthName = months[today.getMonth()];
    const day = today.getDate();
    const year = today.getFullYear();

    return `${year}. ${monthName} ${day}., ${dayName}`;
  };

  const formatNoteDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Ma';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Holnap';
    } else {
      return date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Épp most';
    if (diffMins < 60) return `${diffMins} perce`;
    if (diffHours < 24) return `${diffHours} órája`;
    if (diffDays === 1) return 'Tegnap';
    if (diffDays < 7) return `${diffDays} napja`;
    return date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
  };

  const isSundayOrMonday = () => {
    const today = new Date();
    const day = today.getDay();
    return day === 0 || day === 1; // Sunday or Monday
  };

  const progressPercent = dailyProgress.total > 0
    ? (dailyProgress.completed / dailyProgress.total) * 100
    : 0;

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>
              Szia{userName ? `, ${userName}` : ''}!
            </Text>
            <Text style={styles.dateText}>{formatDate()}</Text>
          </View>
          {userAvatar && (
            <Image source={{ uri: userAvatar }} style={styles.avatar} />
          )}
        </View>

        {/* Daily Habits Summary */}
        <TouchableOpacity
          style={styles.habitsCard}
          onPress={() => router.push('/(tabs)/habits')}
          activeOpacity={0.7}
        >
          <View style={styles.habitsHeader}>
            <Text style={styles.cardTitle}>Mai szokások</Text>
            <Feather name="chevron-right" size={20} color={Colors.textMuted} />
          </View>
          <View style={styles.habitsContent}>
            <CircularProgress progress={progressPercent} size={100} />
            <View style={styles.habitsInfo}>
              <Text style={styles.habitsCount}>
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
          {uncompletedHabits.length > 0 && (
            <View style={styles.quickHabits}>
              {uncompletedHabits.map(habit => (
                <QuickHabitItem
                  key={habit.id}
                  habit={habit}
                  onToggle={handleToggleHabit}
                  completing={completingHabit}
                />
              ))}
            </View>
          )}
        </TouchableOpacity>

        {/* Quick Task Input */}
        <View style={styles.quickNoteCard}>
          <TextInput
            style={styles.quickNoteInput}
            placeholder="Gyors jegyzet..."
            placeholderTextColor={Colors.textMuted}
            value={quickNoteText}
            onChangeText={setQuickNoteText}
            onSubmitEditing={handleQuickNote}
            returnKeyType="done"
            editable={!creatingNote}
          />
          {quickNoteText.trim() && (
            <TouchableOpacity
              onPress={handleQuickNote}
              disabled={creatingNote}
              style={styles.quickNoteButton}
            >
              {creatingNote ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Feather name="plus" size={20} color={Colors.primary} />
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Weekly Review Teaser */}
        {isSundayOrMonday() && (
          <TouchableOpacity
            style={styles.reviewCard}
            onPress={() => router.push('/habits/weekly-review')}
            activeOpacity={0.7}
          >
            <View style={styles.reviewContent}>
              <Text style={styles.reviewTitle}>Heti áttekintés elérhető!</Text>
              <Text style={styles.reviewText}>Nézd meg a heti teljesítményed</Text>
            </View>
            <Feather name="arrow-right" size={20} color={Colors.primary} />
          </TouchableOpacity>
        )}

        {/* Upcoming Due Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Közelgő határidők</Text>
          {upcomingNotes.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>Nincs közelgő határidő</Text>
            </View>
          ) : (
            upcomingNotes.map(note => (
              <TouchableOpacity
                key={note.id}
                style={styles.noteItem}
                onPress={() => router.push(`/notes/${note.id}`)}
                activeOpacity={0.7}
              >
                <View style={[styles.priorityDot, { backgroundColor: PriorityColors[note.priority] }]} />
                <View style={styles.noteItemContent}>
                  <Text style={styles.noteItemTitle} numberOfLines={1}>
                    {note.title || 'Cím nélküli jegyzet'}
                  </Text>
                  <View style={styles.noteItemMeta}>
                    <Text style={styles.noteItemDate}>
                      {formatNoteDate(note.due_date)}
                    </Text>
                    {note.project_id && (
                      <>
                        <Text style={styles.noteItemSeparator}>•</Text>
                        <Text style={styles.noteItemProject}>
                          {projects.find(p => p.id === note.project_id)?.name}
                        </Text>
                      </>
                    )}
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Projects Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Projektek</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectsScroll}>
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onPress={() => router.push(`/(tabs)/notes`)}
              />
            ))}
            <TouchableOpacity
              style={styles.projectCardAdd}
              onPress={() => router.push('/projects/manage')}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={24} color={Colors.primary} />
              <Text style={styles.projectCardAddText}>Új projekt</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Recent Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legutóbbi jegyzetek</Text>
          {recentNotes.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>Még nincsenek jegyzeteid</Text>
            </View>
          ) : (
            recentNotes.map(note => (
              <TouchableOpacity
                key={note.id}
                style={styles.recentNoteCard}
                onPress={() => router.push(`/notes/${note.id}`)}
                activeOpacity={0.7}
              >
                <Text style={styles.recentNoteTitle} numberOfLines={1}>
                  {note.title || 'Cím nélküli jegyzet'}
                </Text>
                {note.content && (
                  <Text style={styles.recentNotePreview} numberOfLines={2}>
                    {note.content}
                  </Text>
                )}
                <Text style={styles.recentNoteTime}>
                  {formatRelativeTime(note.updated_at || note.created_at)}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.xl,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    paddingTop: HEADER_PADDING_TOP,
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    marginBottom: Spacing.xs,
  },
  dateText: {
    fontSize: FontSize.lg,
    color: Colors.textMuted,
    textTransform: 'capitalize',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.card,
  },
  habitsCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  habitsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  cardTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  habitsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  habitsInfo: {
    flex: 1,
    gap: Spacing.sm,
  },
  habitsCount: {
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
  progressText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  quickHabits: {
    gap: Spacing.sm,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  quickHabitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  quickHabitCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickHabitCheckCompleted: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  quickHabitText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textWhite,
  },
  quickNoteCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  quickNoteInput: {
    flex: 1,
    fontSize: FontSize.lg,
    color: Colors.textWhite,
  },
  quickNoteButton: {
    padding: Spacing.sm,
  },
  reviewCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewContent: {
    flex: 1,
  },
  reviewTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    marginBottom: Spacing.xs,
  },
  reviewText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    marginBottom: Spacing.md,
  },
  emptySection: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  priorityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  noteItemContent: {
    flex: 1,
  },
  noteItemTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textWhite,
    marginBottom: Spacing.xs,
  },
  noteItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  noteItemDate: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  noteItemSeparator: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  noteItemProject: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  projectsScroll: {
    marginHorizontal: -Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  projectCard: {
    width: 140,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  projectName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    marginBottom: Spacing.sm,
  },
  projectCount: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  projectCardAdd: {
    width: 140,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginRight: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  projectCardAddText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  recentNoteCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recentNoteTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    marginBottom: Spacing.sm,
  },
  recentNotePreview: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  recentNoteTime: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
});
