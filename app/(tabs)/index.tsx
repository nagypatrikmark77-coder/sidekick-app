import { StreakBadge } from '@/components/StreakBadge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import {
  Colors,
  FontSize,
  FontWeight,
  HEADER_PADDING_TOP,
  PriorityColors,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { habitLogsService, habitsStatsService, type Habit } from '@/lib/habits-service';
import { notesService, projectsService, type Note, type Project } from '@/lib/notes-service';
import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

// ── Helper: Time-based greeting ──────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Jó reggelt';
  if (hour < 18) return 'Jó napot';
  return 'Jó estét';
}

// ── Helper: Hungarian date formatting ────────────────────────────────────────

const HU_DAYS = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
const HU_MONTHS = [
  'január', 'február', 'március', 'április', 'május', 'június',
  'július', 'augusztus', 'szeptember', 'október', 'november', 'december',
];

function formatHungarianDate(): string {
  const d = new Date();
  return `${d.getFullYear()}. ${HU_MONTHS[d.getMonth()]} ${d.getDate()}., ${HU_DAYS[d.getDay()]}`;
}

// ── Helper: Relative time ────────────────────────────────────────────────────

function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (mins < 1) return 'Épp most';
  if (mins < 60) return `${mins} perce`;
  if (hours < 24) return `${hours} órája`;
  if (days === 1) return 'Tegnap';
  if (days < 7) return `${days} napja`;
  return new Date(dateString).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
}

// ── Helper: Due date label ───────────────────────────────────────────────────

function getDueDateLabel(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Ma';
  if (date.toDateString() === tomorrow.toDateString()) return 'Holnap';
  return date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
}

// ── Helper: Group upcoming notes by date category ────────────────────────────

type DateGroup = 'Ma' | 'Holnap' | 'Ezen a héten';

function groupUpcomingNotes(notes: Note[]): { group: DateGroup; notes: Note[] }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  const groups: Record<DateGroup, Note[]> = {
    'Ma': [],
    'Holnap': [],
    'Ezen a héten': [],
  };

  for (const note of notes) {
    if (!note.due_date) continue;
    const due = new Date(note.due_date);
    due.setHours(0, 0, 0, 0);

    if (due.getTime() === today.getTime()) groups['Ma'].push(note);
    else if (due.getTime() === tomorrow.getTime()) groups['Holnap'].push(note);
    else groups['Ezen a héten'].push(note);
  }

  return (['Ma', 'Holnap', 'Ezen a héten'] as DateGroup[])
    .filter(g => groups[g].length > 0)
    .map(g => ({ group: g, notes: groups[g] }));
}

// ── Sub-components ───────────────────────────────────────────────────────────

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
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const check = async () => {
      const today = new Date().toISOString().split('T')[0];
      const log = await habitLogsService.getLogForDate(habit.id, today);
      setCompleted(log ? log.count >= habit.target_count : false);
      setLoading(false);
    };
    check();
  }, [habit.id, habit.target_count]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    onToggle(habit);
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.quickHabitItem}
        onPress={handlePress}
        disabled={completing === habit.id || loading}
      >
        <View style={[styles.quickHabitCheck, completed && styles.quickHabitCheckCompleted]}>
          {completed && <Feather name="check" size={14} color={Colors.textWhite} />}
        </View>
        <Text style={[styles.quickHabitText, completed && styles.quickHabitTextCompleted]} numberOfLines={1}>
          {habit.icon} {habit.name}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ProjectCard({
  project,
  noteCount,
  onPress,
}: {
  project: Project;
  noteCount: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.projectCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.projectCardStripe, { backgroundColor: project.color }]} />
      <View style={styles.projectCardBody}>
        <Text style={styles.projectName} numberOfLines={1}>{project.name}</Text>
        <Text style={styles.projectCount}>{noteCount} jegyzet</Text>
        <Text style={styles.projectDate}>
          {new Date(project.updated_at).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [dailyProgress, setDailyProgress] = useState({ completed: 0, total: 0 });
  const [overallStreak, setOverallStreak] = useState(0);
  const [uncompletedHabits, setUncompletedHabits] = useState<Habit[]>([]);
  const [upcomingNotes, setUpcomingNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectNoteCounts, setProjectNoteCounts] = useState<Record<string, number>>({});
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completingHabit, setCompletingHabit] = useState<string | null>(null);
  const [thoughtText, setThoughtText] = useState('');
  const [thoughtFocused, setThoughtFocused] = useState(false);
  const [savingThought, setSavingThought] = useState(false);
  const [thoughtSaved, setThoughtSaved] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Load profile
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

      // Get uncompleted habits (up to 3)
      const today = new Date().toISOString().split('T')[0];
      const uncompleted: Habit[] = [];
      for (const habit of habits) {
        const log = await habitLogsService.getLogForDate(habit.id, today);
        if (!log || log.count < habit.target_count) {
          uncompleted.push(habit);
          if (uncompleted.length >= 3) break;
        }
      }
      setUncompletedHabits(uncompleted);

      // Load all notes
      const allNotes = await notesService.getNotes();
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const nextWeek = new Date(todayDate);
      nextWeek.setDate(todayDate.getDate() + 7);

      // Upcoming notes (next 7 days)
      const upcoming = allNotes
        .filter(note => {
          if (!note.due_date) return false;
          const dueDate = new Date(note.due_date);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate >= todayDate && dueDate <= nextWeek;
        })
        .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
        .slice(0, 5);
      setUpcomingNotes(upcoming);

      // Projects + note counts
      const projectsData = await projectsService.getProjects();
      setProjects(projectsData);

      const counts: Record<string, number> = {};
      for (const p of projectsData) {
        try {
          counts[p.id] = await projectsService.getProjectNoteCount(p.id);
        } catch {
          counts[p.id] = 0;
        }
      }
      setProjectNoteCounts(counts);

      // Recent notes
      const recent = [...allNotes]
        .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
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
    if (user) loadData();
  }, [user, loadData]);

  // Refresh when screen comes into focus (e.g., after creating/editing a note)
  useFocusEffect(
    useCallback(() => {
      if (user) loadData();
    }, [user, loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleSaveThought = async (actionType: 'gondolat' | 'feladat') => {
    if (!thoughtText.trim()) return;

    setSavingThought(true);
    try {
      // Use 'egyéb' category since 'gondolat' and 'feladat' aren't in the type definition
      // The title will indicate the type: "Gondolat" or "Feladat"
      const title = actionType === 'feladat' 
        ? `Feladat: ${thoughtText.trim().split('\n')[0] || 'Feladat'}`
        : thoughtText.trim().split('\n')[0] || 'Gondolat';
      
      await notesService.createNote({
        title,
        content: thoughtText.trim(),
        priority: actionType === 'feladat' ? 'medium' : 'low',
        category: 'egyéb',
        tags: actionType === 'feladat' ? ['feladat'] : [],
        project_id: null,
        due_date: null,
        is_pinned: false,
      });
      setThoughtText('');
      setThoughtSaved(true);
      setTimeout(() => {
        setThoughtSaved(false);
        setSavingThought(false);
      }, 1500);
      loadData();
    } catch (error) {
      console.error('Error saving thought:', error);
      setSavingThought(false);
    }
  };

  const handleChatWithThought = () => {
    if (!thoughtText.trim()) {
      router.push('/(tabs)/chat');
      return;
    }
    // Navigate to chat - the chat screen could read from a shared state or we just navigate
    router.push('/(tabs)/chat');
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

  const groupedUpcoming = groupUpcomingNotes(upcomingNotes);

  const progressPercent = dailyProgress.total > 0
    ? (dailyProgress.completed / dailyProgress.total) * 100
    : 0;

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>
              {getGreeting()}{userName ? `, ${userName}` : ''}
            </Text>
            <Text style={styles.dateText}>{formatHungarianDate()}</Text>
            <Text style={styles.motivationText}>Tedd produktívvá a napodat!</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.7}>
            {userAvatar ? (
              <Image source={{ uri: userAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Feather name="user" size={22} color={Colors.textMuted} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Gondolatértelmező ── */}
        <View style={styles.heroCard}>
          <View style={[styles.heroCardBorder, { backgroundColor: '#3B82F6' }]} />
          <View style={styles.heroCardContent}>
            <View style={styles.heroCardHeader}>
              <Text style={styles.heroCardEmoji}>💡</Text>
              <Text style={styles.heroCardTitle}>Mi jár a fejedben?</Text>
            </View>
            <Text style={styles.heroCardSubtitle}>
              Írd le a gondolataidat, és a Sidekick segít rendszerezni
            </Text>
            <TextInput
              style={[
                styles.heroCardInput,
                thoughtFocused && styles.heroCardInputFocused,
              ]}
              placeholder="Gondolatok, ötletek, tervek..."
              placeholderTextColor={Colors.textMuted}
              value={thoughtText}
              onChangeText={setThoughtText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              onFocus={() => setThoughtFocused(true)}
              onBlur={() => setThoughtFocused(false)}
              editable={!savingThought}
            />
            <View style={styles.heroCardActions}>
              <TouchableOpacity
                style={[
                  styles.heroCardActionButton,
                  (!thoughtText.trim() || savingThought) && styles.heroCardActionButtonDisabled,
                ]}
                onPress={() => handleSaveThought('gondolat')}
                disabled={!thoughtText.trim() || savingThought}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.heroCardActionText,
                  (!thoughtText.trim() || savingThought) && styles.heroCardActionTextDisabled,
                ]}>
                  📝 Jegyzetként mentés
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.heroCardActionButton,
                  savingThought && styles.heroCardActionButtonDisabled,
                ]}
                onPress={handleChatWithThought}
                disabled={savingThought}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.heroCardActionText,
                  savingThought && styles.heroCardActionTextDisabled,
                ]}>
                  💬 Megbeszélem az AI-jal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.heroCardActionButton,
                  (!thoughtText.trim() || savingThought) && styles.heroCardActionButtonDisabled,
                ]}
                onPress={() => handleSaveThought('feladat')}
                disabled={!thoughtText.trim() || savingThought}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.heroCardActionText,
                  (!thoughtText.trim() || savingThought) && styles.heroCardActionTextDisabled,
                ]}>
                  ✅ Feladatnak jelölés
                </Text>
              </TouchableOpacity>
            </View>
            {thoughtSaved && (
              <View style={styles.heroCardSuccess}>
                <Feather name="check" size={16} color={Colors.success} />
                <Text style={styles.heroCardSuccessText}>Mentve!</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Quick Access Cards ── */}
        <View style={styles.quickCardsRow}>
          {/* LEFT CARD - Legutóbbi jegyzet */}
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => {
              if (recentNotes.length > 0) {
                router.push(`/notes/${recentNotes[0].id}`);
              } else {
                router.push('/(tabs)/notes');
              }
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.quickCardBorder, { backgroundColor: '#3B82F6' }]} />
            <View style={styles.quickCardContent}>
              <View style={styles.quickCardHeader}>
                <Feather name="file-text" size={16} color={Colors.primary} />
                <Text style={styles.quickCardLabel}>Jegyzet</Text>
              </View>
              {recentNotes.length > 0 ? (
                <>
                  <Text style={styles.quickCardTitle} numberOfLines={1}>
                    {recentNotes[0].title || 'Cím nélküli jegyzet'}
                  </Text>
                  {recentNotes[0].content && (
                    <Text style={styles.quickCardText} numberOfLines={2}>
                      {recentNotes[0].content}
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.quickCardEmpty}>Még nincs jegyzeted</Text>
              )}
              <View style={styles.quickCardArrow}>
                <Feather name="arrow-right" size={16} color={Colors.primary} />
              </View>
            </View>
          </TouchableOpacity>

          {/* RIGHT CARD - Mai nap */}
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push('/(tabs)/chat')}
            activeOpacity={0.8}
          >
            <View style={[styles.quickCardBorder, { backgroundColor: '#8B5CF6' }]} />
            <View style={styles.quickCardContent}>
              <View style={styles.quickCardHeader}>
                <Feather name="calendar" size={16} color="#8B5CF6" />
                <Text style={styles.quickCardLabel}>Naptár</Text>
              </View>
              <View style={styles.quickCardDateContent}>
                <Text style={styles.quickCardDayNumber}>
                  {new Date().getDate()}
                </Text>
                <Text style={styles.quickCardMonth}>
                  {HU_MONTHS[new Date().getMonth()]}
                </Text>
                <Text style={styles.quickCardDayName}>
                  {HU_DAYS[new Date().getDay()]}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Mai szokások ── */}
        <View style={styles.habitsCard}>
          <TouchableOpacity
            style={styles.habitsHeader}
            onPress={() => router.push('/(tabs)/habits')}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionTitle}>Mai szokások</Text>
            <Feather name="chevron-right" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.habitsContent}>
            <CircularProgress progress={progressPercent} size={90} />
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
          {dailyProgress.total === 0 ? (
            <Text style={styles.emptyHabitsText}>Adj hozzá szokásokat a Szokások fülön</Text>
          ) : uncompletedHabits.length > 0 ? (
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
          ) : null}
        </View>

        {/* ── Közelgő határidők ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Közelgő határidők</Text>
          {groupedUpcoming.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="calendar" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Nincs közelgő határidő</Text>
            </View>
          ) : (
            <>
              {groupedUpcoming.map(({ group, notes }) => (
                <View key={group}>
                  <Text style={styles.dateGroupLabel}>{group}</Text>
                  {notes.map(note => (
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
                          {note.project_id && (
                            <View style={styles.projectBadge}>
                              <Text style={styles.projectBadgeText}>
                                {projects.find(p => p.id === note.project_id)?.name}
                              </Text>
                            </View>
                          )}
                          <Text style={styles.noteItemDate}>
                            {getDueDateLabel(note.due_date)}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
              {upcomingNotes.length >= 5 && (
                <TouchableOpacity
                  style={styles.viewAllLink}
                  onPress={() => router.push('/(tabs)/notes')}
                >
                  <Text style={styles.viewAllText}>Összes megtekintése</Text>
                  <Feather name="arrow-right" size={14} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* ── Projektek ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Projektek</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.projectsScroll}
            contentContainerStyle={styles.projectsScrollContent}
          >
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                noteCount={projectNoteCounts[project.id] || 0}
                onPress={() => router.push('/(tabs)/notes')}
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

        {/* ── Napi összefoglaló (coming soon) ── */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryIcon}>💡</Text>
            <Text style={styles.summaryTitle}>Napi összefoglaló</Text>
          </View>
          <Text style={styles.summaryText}>
            Hamarosan az AI asszisztensed személyre szabott összefoglalót készít a napodról.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

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

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
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
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textTransform: 'capitalize',
    marginBottom: Spacing.xs,
  },
  motivationText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.card,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Habits
  habitsCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  habitsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  habitsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
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
  emptyHabitsText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  quickHabits: {
    gap: Spacing.sm,
    paddingTop: Spacing.lg,
    marginTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  quickHabitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
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
  quickHabitTextCompleted: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },

  // Quick cards row
  quickCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.xl,
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A4A',
    minHeight: 140,
    overflow: 'hidden',
    position: 'relative',
  },
  quickCardBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  quickCardContent: {
    padding: Spacing.lg,
    flex: 1,
  },
  quickCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  quickCardLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  quickCardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    marginBottom: Spacing.xs,
  },
  quickCardText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 18,
    flex: 1,
  },
  quickCardEmpty: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontStyle: 'italic',
    flex: 1,
  },
  quickCardArrow: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
  },
  quickCardDateContent: {
    flex: 1,
    justifyContent: 'center',
  },
  quickCardDayNumber: {
    fontSize: 32,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    marginBottom: Spacing.xs,
  },
  quickCardMonth: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
    textTransform: 'capitalize',
  },
  quickCardDayName: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textTransform: 'capitalize',
  },

  // Sections
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    marginBottom: Spacing.md,
  },
  dateGroupLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },

  // Empty states
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.xxxl,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },

  // Note items (upcoming)
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
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  priorityDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  projectBadge: {
    backgroundColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  projectBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.textWhite,
    fontWeight: FontWeight.medium,
  },

  // View all link
  viewAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  viewAllText: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },

  // Projects
  projectsScroll: {
    marginHorizontal: -Spacing.xl,
  },
  projectsScrollContent: {
    paddingHorizontal: Spacing.xl,
  },
  projectCard: {
    width: 150,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  projectCardStripe: {
    height: 4,
  },
  projectCardBody: {
    padding: Spacing.lg,
  },
  projectName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    marginBottom: Spacing.xs,
  },
  projectCount: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  projectDate: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  projectCardAdd: {
    width: 150,
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

  // Recent notes
  // Hero card (Gondolatértelmező)
  heroCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#2A2A4A',
    marginBottom: Spacing.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  heroCardBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  heroCardContent: {
    padding: Spacing.lg,
  },
  heroCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  heroCardEmoji: {
    fontSize: 24,
  },
  heroCardTitle: {
    fontSize: 20,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  heroCardSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  heroCardInput: {
    backgroundColor: '#0A0A0F',
    borderRadius: 10,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textWhite,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#2A2A4A',
    marginBottom: Spacing.md,
  },
  heroCardInputFocused: {
    borderColor: '#3B82F6',
  },
  heroCardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  heroCardActionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: 'transparent',
  },
  heroCardActionButtonDisabled: {
    opacity: 0.5,
  },
  heroCardActionText: {
    fontSize: FontSize.sm,
    color: '#3B82F6',
    fontWeight: FontWeight.medium,
  },
  heroCardActionTextDisabled: {
    color: Colors.textMuted,
  },
  heroCardSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  heroCardSuccessText: {
    fontSize: FontSize.sm,
    color: Colors.success,
    fontWeight: FontWeight.medium,
  },

  // Daily summary (coming soon)
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  summaryIcon: {
    fontSize: 20,
  },
  summaryTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  summaryText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 22,
  },
});
