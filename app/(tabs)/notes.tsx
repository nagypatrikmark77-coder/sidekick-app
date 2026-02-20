import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Animated,
  Modal,
  Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { notesService, projectsService, type Note, type Project } from '@/lib/notes-service';
import { useAuth } from '@/contexts/AuthContext';
import {
  Colors,
  PriorityColors,
  Spacing,
  Radius,
  FontSize,
  FontWeight,
  HEADER_PADDING_TOP,
  CardShadow,
} from '@/constants/theme';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { type Priority, type NoteCategory, CATEGORY_LABELS } from '@/types/database';

const SCREEN_BG = '#0A0A0F';
const CARD_BG = '#1A1A2E';
const BORDER_COLOR = '#2A2A4A';
const PRIORITY_STRIPE: Record<string, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#22C55E',
};

const TAG_PASTEL_COLORS = [
  '#6366F1', '#8B5CF6', '#A855F7', '#EC4899',
  '#F43F5E', '#3B82F6', '#06B6D4', '#14B8A6',
];

type SectionData = {
  title: string;
  data: Note[];
};

export default function Notes() {
  const router = useRouter();
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchAnim = useRef(new Animated.Value(0)).current;

  // Filter
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<NoteCategory | 'all'>('all');
  const [filterProject, setFilterProject] = useState<string | 'all'>('all');
  const [filterHasDueDate, setFilterHasDueDate] = useState(false);

  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  const loadData = useCallback(async () => {
    if (!user) {
      console.log('[notes.tsx] loadData skipped: no user');
      return;
    }

    console.log('[notes.tsx] loadData starting...');
    setLoading(true);
    try {
      console.log('[notes.tsx] Fetching notes and projects...');
      const [notesData, projectsData] = await Promise.all([
        notesService.getNotes(),
        projectsService.getProjects(),
      ]);
      
      console.log('[notes.tsx] Fetched notes:', notesData.length);
      console.log('[notes.tsx] Notes data:', notesData);
      console.log('[notes.tsx] Fetched projects:', projectsData.length);
      
      setNotes(notesData);
      setProjects(projectsData);
      
      console.log('[notes.tsx] Data loaded successfully');
    } catch (error: any) {
      console.error('[notes.tsx] Error loading data:', error);
      console.error('[notes.tsx] Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
      });
      Alert.alert('Hiba', 'Nem sikerült betölteni az adatokat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      console.log('[notes.tsx] useEffect: user available, loading data');
      loadData();
    } else {
      console.log('[notes.tsx] useEffect: no user');
    }
  }, [user, loadData]);

  // Refresh when screen comes into focus (e.g., after creating/editing a note)
  useFocusEffect(
    useCallback(() => {
      if (user) {
        console.log('[notes.tsx] useFocusEffect: screen focused, loading data');
        loadData();
      } else {
        console.log('[notes.tsx] useFocusEffect: no user');
      }
    }, [user, loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Toggle search bar
  const toggleSearch = () => {
    if (searchVisible) {
      Animated.timing(searchAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        setSearchVisible(false);
        setSearchQuery('');
      });
    } else {
      setSearchVisible(true);
      Animated.timing(searchAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  };

  // Filter + search logic
  const filteredNotes = useMemo(() => {
    let result = notes;

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        n =>
          n.title?.toLowerCase().includes(q) ||
          n.content?.toLowerCase().includes(q)
      );
    }

    // Priority filter
    if (filterPriority !== 'all') {
      result = result.filter(n => n.priority === filterPriority);
    }

    // Category filter
    if (filterCategory !== 'all') {
      result = result.filter(n => n.category === filterCategory);
    }

    // Project filter
    if (filterProject !== 'all') {
      result = result.filter(n => n.project_id === filterProject);
    }

    // Has due date filter
    if (filterHasDueDate) {
      result = result.filter(n => n.due_date !== null);
    }

    return result;
  }, [notes, searchQuery, filterPriority, filterCategory, filterProject, filterHasDueDate]);

  // Group notes into sections
  const sections = useMemo((): SectionData[] => {
    const pinned = filteredNotes.filter(n => n.is_pinned);
    const unpinned = filteredNotes.filter(n => !n.is_pinned);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayNotes: Note[] = [];
    const yesterdayNotes: Note[] = [];
    const olderNotes: Note[] = [];

    for (const note of unpinned) {
      const noteDate = new Date(note.updated_at);
      const noteDay = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate());

      if (noteDay.getTime() >= today.getTime()) {
        todayNotes.push(note);
      } else if (noteDay.getTime() >= yesterday.getTime()) {
        yesterdayNotes.push(note);
      } else {
        olderNotes.push(note);
      }
    }

    const result: SectionData[] = [];
    if (pinned.length > 0) result.push({ title: 'Rogzitett', data: pinned });
    if (todayNotes.length > 0) result.push({ title: 'Ma', data: todayNotes });
    if (yesterdayNotes.length > 0) result.push({ title: 'Tegnap', data: yesterdayNotes });
    if (olderNotes.length > 0) result.push({ title: 'Korabban', data: olderNotes });

    return result;
  }, [filteredNotes]);

  const handleDelete = async (noteId: string) => {
    Alert.alert(
      'Jegyzet torlese',
      'Biztosan torolni szeretned ezt a jegyzetet?',
      [
        { text: 'Megse', style: 'cancel' },
        {
          text: 'Torles',
          style: 'destructive',
          onPress: async () => {
            try {
              await notesService.deleteNote(noteId);
              loadData();
            } catch (error) {
              Alert.alert('Hiba', 'Nem sikerult torolni a jegyzetet.');
            }
          },
        },
      ]
    );
  };

  const handlePin = async (noteId: string) => {
    try {
      await notesService.togglePin(noteId);
      loadData();
    } catch (error) {
      Alert.alert('Hiba', 'Nem sikerult rogziteni/visszavonni a jegyzetet.');
    }
  };

  const getProjectForNote = (projectId: string | null) => {
    if (!projectId) return null;
    return projects.find(p => p.id === projectId) || null;
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'most';
    if (diffMins < 60) return `${diffMins} perce`;
    if (diffHours < 24) return `${diffHours} oraja`;

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const noteDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (noteDay.getTime() >= today.getTime()) return 'ma';
    if (noteDay.getTime() >= yesterday.getTime()) return 'tegnap';

    return date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
  };

  const isDueDateOverdue = (dueDateStr: string | null) => {
    if (!dueDateStr) return false;
    const dueDate = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  const formatDueDate = (dueDateStr: string | null) => {
    if (!dueDateStr) return null;
    const date = new Date(dueDateStr);
    return date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
  };

  const getTagColor = (tag: string) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return TAG_PASTEL_COLORS[Math.abs(hash) % TAG_PASTEL_COLORS.length];
  };

  const renderSwipeActions = (noteId: string) => {
    return (
      <TouchableOpacity
        style={styles.swipeDeleteAction}
        onPress={() => handleDelete(noteId)}
      >
        <Feather name="trash-2" size={22} color="#FFFFFF" />
        <Text style={styles.swipeDeleteText}>Torles</Text>
      </TouchableOpacity>
    );
  };

  const renderNoteCard = (item: Note) => {
    const project = getProjectForNote(item.project_id);
    const overdue = isDueDateOverdue(item.due_date);
    const dueFormatted = formatDueDate(item.due_date);

    return (
      <Swipeable
        ref={ref => {
          if (ref) swipeableRefs.current.set(item.id, ref);
        }}
        renderRightActions={() => renderSwipeActions(item.id)}
        overshootRight={false}
        rightThreshold={80}
      >
        <TouchableOpacity
          style={styles.noteCard}
          onPress={() => router.push(`/notes/${item.id}`)}
          onLongPress={() => handlePin(item.id)}
          activeOpacity={0.7}
        >
          {/* Priority stripe */}
          <View
            style={[
              styles.priorityStripe,
              { backgroundColor: PRIORITY_STRIPE[item.priority] || Colors.textMuted },
            ]}
          />

          <View style={styles.noteCardContent}>
            {/* Title row */}
            <View style={styles.noteTitleRow}>
              {item.is_pinned && (
                <Feather
                  name="map-pin"
                  size={12}
                  color={Colors.primary}
                  style={styles.pinIcon}
                />
              )}
              <Text style={styles.noteTitle} numberOfLines={1}>
                {item.title || 'Cim nelkuli jegyzet'}
              </Text>
            </View>

            {/* Content preview */}
            {item.content ? (
              <Text style={styles.notePreview} numberOfLines={2}>
                {item.content}
              </Text>
            ) : null}

            {/* Bottom row */}
            <View style={styles.noteBottom}>
              <View style={styles.noteBadges}>
                {project && (
                  <View style={[styles.badge, { backgroundColor: project.color + '30' }]}>
                    <View style={[styles.badgeDot, { backgroundColor: project.color }]} />
                    <Text style={[styles.badgeText, { color: project.color }]}>
                      {project.name}
                    </Text>
                  </View>
                )}
                {item.category && item.category !== 'egyéb' && (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>
                      {CATEGORY_LABELS[item.category] || item.category}
                    </Text>
                  </View>
                )}
                {item.tags && item.tags.length > 0 && item.tags.slice(0, 2).map((tag, idx) => (
                  <View key={idx} style={[styles.tagPill, { backgroundColor: getTagColor(tag) + '25' }]}>
                    <Text style={[styles.tagPillText, { color: getTagColor(tag) }]}>{tag}</Text>
                  </View>
                ))}
                {item.tags && item.tags.length > 2 && (
                  <Text style={styles.tagMore}>+{item.tags.length - 2}</Text>
                )}
              </View>

              <View style={styles.noteRight}>
                {dueFormatted && (
                  <View style={styles.dueDateBadge}>
                    <Feather
                      name="calendar"
                      size={10}
                      color={overdue ? '#EF4444' : Colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.dueDateText,
                        overdue && { color: '#EF4444' },
                      ]}
                    >
                      {dueFormatted}
                    </Text>
                  </View>
                )}
                <Text style={styles.timestamp}>
                  {getRelativeTime(item.updated_at)}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      {title === 'Rogzitett' && (
        <Feather name="map-pin" size={12} color={Colors.primary} style={{ marginRight: 6 }} />
      )}
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  // Flatten sections for FlatList
  const flatData = useMemo(() => {
    const result: ({ type: 'header'; title: string } | { type: 'note'; note: Note })[] = [];
    for (const section of sections) {
      result.push({ type: 'header', title: section.title });
      for (const note of section.data) {
        result.push({ type: 'note', note });
      }
    }
    return result;
  }, [sections]);

  const hasActiveFilters =
    filterPriority !== 'all' ||
    filterCategory !== 'all' ||
    filterProject !== 'all' ||
    filterHasDueDate;

  const clearFilters = () => {
    setFilterPriority('all');
    setFilterCategory('all');
    setFilterProject('all');
    setFilterHasDueDate(false);
  };

  const searchBarHeight = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 56],
  });

  const searchBarOpacity = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Jegyzetek</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.iconButton, searchVisible && styles.iconButtonActive]}
            onPress={toggleSearch}
          >
            <Feather name="search" size={20} color={searchVisible ? '#FFFFFF' : Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, hasActiveFilters && styles.iconButtonActive]}
            onPress={() => setFilterVisible(true)}
          >
            <Feather name="sliders" size={20} color={hasActiveFilters ? '#FFFFFF' : Colors.textMuted} />
            {hasActiveFilters && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      {searchVisible && (
        <Animated.View style={[styles.searchBarContainer, { height: searchBarHeight, opacity: searchBarOpacity }]}>
          <View style={styles.searchBar}>
            <Feather name="search" size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Kereses a jegyzetekben..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}

      {/* Active filters indicator */}
      {hasActiveFilters && (
        <View style={styles.activeFiltersBar}>
          <Text style={styles.activeFiltersText}>Szurok aktiv</Text>
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearFiltersText}>Torles</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notes list */}
      {loading ? (
        <LoadingScreen />
      ) : (
        <FlatList
          data={flatData}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return renderSectionHeader(item.title);
            }
            return renderNoteCard(item.note);
          }}
          keyExtractor={(item, index) =>
            item.type === 'header' ? `header-${item.title}` : `note-${item.note.id}`
          }
          contentContainerStyle={[
            styles.listContent,
            flatData.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Feather name="book-open" size={48} color={Colors.primary} />
                <View style={styles.emptySparkle}>
                  <Feather name="zap" size={16} color={Colors.warning} />
                </View>
              </View>
              <Text style={styles.emptyTitle}>Kezdj el jegyzetelni!</Text>
              <Text style={styles.emptySubtitle}>
                A Sidekick segit rendszerezni a gondolataidat
              </Text>
              <View style={styles.emptyArrow}>
                <Feather name="arrow-down-right" size={24} color={Colors.textMuted} />
              </View>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/notes/create')}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Filter Modal */}
      <Modal
        visible={filterVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterVisible(false)}
      >
        <TouchableOpacity
          style={styles.filterOverlay}
          activeOpacity={1}
          onPress={() => setFilterVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.filterSheet}>
            <View style={styles.filterHandle} />
            <Text style={styles.filterTitle}>Szurok</Text>

            {/* Priority filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Prioritas</Text>
              <View style={styles.filterOptions}>
                {(['all', 'high', 'medium', 'low'] as const).map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.filterChip,
                      filterPriority === p && styles.filterChipActive,
                    ]}
                    onPress={() => setFilterPriority(p)}
                  >
                    {p !== 'all' && (
                      <View
                        style={[
                          styles.filterChipDot,
                          { backgroundColor: PRIORITY_STRIPE[p] },
                        ]}
                      />
                    )}
                    <Text
                      style={[
                        styles.filterChipText,
                        filterPriority === p && styles.filterChipTextActive,
                      ]}
                    >
                      {p === 'all' ? 'Mind' : p === 'high' ? 'Magas' : p === 'medium' ? 'Kozepes' : 'Alacsony'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Category filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Kategoria</Text>
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    filterCategory === 'all' && styles.filterChipActive,
                  ]}
                  onPress={() => setFilterCategory('all')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filterCategory === 'all' && styles.filterChipTextActive,
                    ]}
                  >
                    Mind
                  </Text>
                </TouchableOpacity>
                {(['munka', 'tanulás', 'személyes', 'ötlet', 'feladat', 'egyéb'] as NoteCategory[]).map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.filterChip,
                      filterCategory === c && styles.filterChipActive,
                    ]}
                    onPress={() => setFilterCategory(c)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        filterCategory === c && styles.filterChipTextActive,
                      ]}
                    >
                      {CATEGORY_LABELS[c] || c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Project filter */}
            {projects.length > 0 && (
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Projekt</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      filterProject === 'all' && styles.filterChipActive,
                    ]}
                    onPress={() => setFilterProject('all')}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        filterProject === 'all' && styles.filterChipTextActive,
                      ]}
                    >
                      Mind
                    </Text>
                  </TouchableOpacity>
                  {projects.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.filterChip,
                        filterProject === p.id && styles.filterChipActive,
                      ]}
                      onPress={() => setFilterProject(p.id)}
                    >
                      <View style={[styles.filterChipDot, { backgroundColor: p.color }]} />
                      <Text
                        style={[
                          styles.filterChipText,
                          filterProject === p.id && styles.filterChipTextActive,
                        ]}
                      >
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Has due date filter */}
            <View style={styles.filterSection}>
              <TouchableOpacity
                style={[styles.filterChip, filterHasDueDate && styles.filterChipActive]}
                onPress={() => setFilterHasDueDate(!filterHasDueDate)}
              >
                <Feather
                  name="calendar"
                  size={14}
                  color={filterHasDueDate ? '#FFFFFF' : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    filterHasDueDate && styles.filterChipTextActive,
                  ]}
                >
                  Van hatarido
                </Text>
              </TouchableOpacity>
            </View>

            {/* Actions */}
            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.filterClearBtn} onPress={clearFilters}>
                <Text style={styles.filterClearText}>Torles</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => setFilterVisible(false)}
              >
                <Text style={styles.filterApplyText}>Alkalmaz</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: HEADER_PADDING_TOP,
    paddingBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  iconButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },

  // Search bar
  searchBarContainer: {
    paddingHorizontal: Spacing.xl,
    overflow: 'hidden',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: '#FFFFFF',
    padding: 0,
  },

  // Active filters bar
  activeFiltersBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  activeFiltersText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  clearFiltersText: {
    fontSize: FontSize.sm,
    color: '#EF4444',
    fontWeight: FontWeight.semibold,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  listContentEmpty: {
    flex: 1,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionHeaderText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Note card
  noteCard: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginBottom: 10,
    overflow: 'hidden',
  },
  priorityStripe: {
    width: 3,
  },
  noteCardContent: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  noteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinIcon: {
    marginRight: 6,
  },
  noteTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    flex: 1,
  },
  notePreview: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  noteBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  noteBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    flex: 1,
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    gap: 4,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: BORDER_COLOR,
  },
  categoryBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  tagPillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  tagMore: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  noteRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  dueDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dueDateText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  timestamp: {
    fontSize: 10,
    color: Colors.textMuted,
  },

  // Swipe delete
  swipeDeleteAction: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: Radius.lg,
    marginBottom: 10,
    marginLeft: 8,
  },
  swipeDeleteText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: 4,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyIconContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 20,
    marginBottom: Spacing.xl,
  },
  emptySparkle: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  emptyTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  emptyArrow: {
    transform: [{ rotate: '45deg' }],
    opacity: 0.4,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    ...CardShadow,
  },

  // Filter modal
  filterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    backgroundColor: SCREEN_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  filterHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER_COLOR,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  filterTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    marginBottom: Spacing.xl,
  },
  filterSection: {
    marginBottom: Spacing.xl,
  },
  filterLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterChipText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  filterClearBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  filterClearText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
  },
  filterApplyBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  filterApplyText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
});
