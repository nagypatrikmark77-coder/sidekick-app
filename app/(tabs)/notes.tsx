import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
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
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

export default function Notes() {
  const router = useRouter();
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [notesData, projectsData] = await Promise.all([
        notesService.getNotes(selectedProject === 'all' ? undefined : selectedProject),
        projectsService.getProjects(),
      ]);
      setNotes(notesData);
      setProjects(projectsData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Hiba', 'Nem sikerült betölteni az adatokat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleDelete = async (noteId: string) => {
    Alert.alert(
      'Jegyzet törlése',
      'Biztosan törölni szeretnéd ezt a jegyzetet?',
      [
        { text: 'Mégse', style: 'cancel' },
        {
          text: 'Törlés',
          style: 'destructive',
          onPress: async () => {
            try {
              await notesService.deleteNote(noteId);
              loadData();
            } catch (error) {
              Alert.alert('Hiba', 'Nem sikerült törölni a jegyzetet.');
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
      Alert.alert('Hiba', 'Nem sikerült rögzíteni/visszavonni a jegyzetet.');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return PriorityColors.high;
      case 'medium':
        return PriorityColors.medium;
      case 'low':
        return PriorityColors.low;
      default:
        return Colors.textMuted;
    }
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return null;
    const project = projects.find(p => p.id === projectId);
    return project?.name || null;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
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

  const renderNote = ({ item }: { item: Note }) => {
    const projectName = getProjectName(item.project_id);
    const dueDate = formatDate(item.due_date);

    return (
      <TouchableOpacity
        style={[styles.noteCard, item.pinned && styles.noteCardPinned]}
        onPress={() => router.push(`/notes/${item.id}`)}
        onLongPress={() => handlePin(item.id)}
        activeOpacity={0.7}
      >
        {item.pinned && (
          <View style={styles.pinnedBadge}>
            <Feather name="bookmark" size={12} color={Colors.primary} />
          </View>
        )}
        <View style={styles.noteHeader}>
          <Text style={styles.noteTitle} numberOfLines={1}>
            {item.title || 'Cím nélküli jegyzet'}
          </Text>
          <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(item.priority) }]} />
        </View>
        {item.content && (
          <Text style={styles.notePreview} numberOfLines={2}>
            {item.content}
          </Text>
        )}
        <View style={styles.noteFooter}>
          <View style={styles.noteMeta}>
            {projectName && (
              <View style={styles.projectBadge}>
                <Text style={styles.projectBadgeText}>{projectName}</Text>
              </View>
            )}
            {dueDate && (
              <View style={styles.dateBadge}>
                <Feather name="calendar" size={12} color={Colors.textMuted} />
                <Text style={styles.dateBadgeText}>{dueDate}</Text>
              </View>
            )}
          </View>
          {item.tags && item.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {item.tags.slice(0, 3).map((tag, index) => (
                <View key={index} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
              {item.tags.length > 3 && (
                <Text style={styles.tagMore}>+{item.tags.length - 3}</Text>
              )}
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.id)}
          activeOpacity={0.7}
        >
          <Feather name="trash-2" size={18} color={PriorityColors.high} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Jegyzetek</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/projects/manage')}
          >
            <Feather name="filter" size={20} color={Colors.textWhite} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/notes/create')}
          >
            <Feather name="plus" size={24} color={Colors.textWhite} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[
            styles.filterTab,
            selectedProject === 'all' && styles.filterTabActive,
          ]}
          onPress={() => setSelectedProject('all')}
        >
          <Text
            style={[
              styles.filterTabText,
              selectedProject === 'all' && styles.filterTabTextActive,
            ]}
          >
            Mind
          </Text>
        </TouchableOpacity>
        {projects.map(project => (
          <TouchableOpacity
            key={project.id}
            style={[
              styles.filterTab,
              selectedProject === project.id && styles.filterTabActive,
            ]}
            onPress={() => setSelectedProject(project.id)}
          >
            <View
              style={[styles.projectDot, { backgroundColor: project.color }]}
            />
            <Text
              style={[
                styles.filterTabText,
                selectedProject === project.id && styles.filterTabTextActive,
              ]}
            >
              {project.name}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[
            styles.filterTab,
            selectedProject === null && styles.filterTabActive,
          ]}
          onPress={() => setSelectedProject(null)}
        >
          <Text
            style={[
              styles.filterTabText,
              selectedProject === null && styles.filterTabTextActive,
            ]}
          >
            Projekt nélkül
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {loading ? (
        <LoadingScreen />
      ) : (
        <FlatList
          data={notes}
          renderItem={renderNote}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              icon="file-text"
              title="Még nincsenek jegyzeteid"
              subtitle="Hozz létre egy új jegyzetet a + gombbal"
              actionLabel="Első jegyzet létrehozása"
              onAction={() => router.push('/notes/create')}
            />
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

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/notes/create')}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={28} color={Colors.textWhite} />
      </TouchableOpacity>
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
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    maxHeight: 50,
    marginBottom: Spacing.sm,
  },
  filterContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Radius.sm,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterTabText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
  },
  filterTabTextActive: {
    color: Colors.textWhite,
  },
  projectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  listContent: {
    padding: Spacing.xl,
    paddingBottom: 100,
  },
  noteCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  noteCardPinned: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  pinnedBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  noteTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    flex: 1,
    marginRight: Spacing.sm,
  },
  priorityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  notePreview: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  noteFooter: {
    gap: Spacing.sm,
  },
  noteMeta: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  projectBadge: {
    backgroundColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  projectBadgeText: {
    fontSize: FontSize.sm,
    color: Colors.textWhite,
    fontWeight: FontWeight.semibold,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  dateBadgeText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: Radius.sm,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  tagChip: {
    backgroundColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  tagText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  tagMore: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  deleteButton: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md,
    padding: Spacing.sm,
  },
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...CardShadow,
  },
});
