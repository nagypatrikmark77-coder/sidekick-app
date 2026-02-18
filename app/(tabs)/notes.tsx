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

const COLORS = {
  background: '#0A0A0F',
  card: '#1A1A2E',
  border: '#2A2A4A',
  primaryBlue: '#3B82F6',
  textWhite: '#FFFFFF',
  textMuted: '#9CA3AF',
  priorityHigh: '#EF4444',
  priorityMedium: '#F59E0B',
  priorityLow: '#22C55E',
};

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
        return COLORS.priorityHigh;
      case 'medium':
        return COLORS.priorityMedium;
      case 'low':
        return COLORS.priorityLow;
      default:
        return COLORS.textMuted;
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
            <Feather name="pin" size={12} color={COLORS.primaryBlue} />
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
                <Feather name="calendar" size={12} color={COLORS.textMuted} />
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
          <Feather name="trash-2" size={18} color={COLORS.priorityHigh} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather name="file-text" size={64} color={COLORS.textMuted} />
      <Text style={styles.emptyTitle}>Még nincsenek jegyzeteid</Text>
      <Text style={styles.emptyText}>
        Hozz létre egy új jegyzetet a + gombbal
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => router.push('/notes/create')}
      >
        <Text style={styles.emptyButtonText}>Első jegyzet létrehozása</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Jegyzetek</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/projects/manage')}
          >
            <Feather name="filter" size={20} color={COLORS.textWhite} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/notes/create')}
          >
            <Feather name="plus" size={24} color={COLORS.textWhite} />
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
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Betöltés...</Text>
        </View>
      ) : (
        <FlatList
          data={notes}
          renderItem={renderNote}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primaryBlue}
            />
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/notes/create')}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={28} color={COLORS.textWhite} />
      </TouchableOpacity>
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
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    maxHeight: 50,
    marginBottom: 8,
  },
  filterContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: COLORS.primaryBlue,
    borderColor: COLORS.primaryBlue,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  filterTabTextActive: {
    color: COLORS.textWhite,
  },
  projectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  noteCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  noteCardPinned: {
    borderColor: COLORS.primaryBlue,
    borderWidth: 2,
  },
  pinnedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textWhite,
    flex: 1,
    marginRight: 8,
  },
  priorityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  notePreview: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
    marginBottom: 12,
  },
  noteFooter: {
    gap: 8,
  },
  noteMeta: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  projectBadge: {
    backgroundColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  projectBadgeText: {
    fontSize: 12,
    color: COLORS.textWhite,
    fontWeight: '600',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dateBadgeText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  tagChip: {
    backgroundColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  tagMore: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  deleteButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    padding: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primaryBlue,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
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
