import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  projectsService,
  type Project,
} from '@/lib/notes-service';
import { useAuth } from '@/contexts/AuthContext';

const COLORS = {
  background: '#0A0A0F',
  card: '#1A1A2E',
  border: '#2A2A4A',
  primaryBlue: '#3B82F6',
  textWhite: '#FFFFFF',
  textMuted: '#9CA3AF',
  error: '#EF4444',
};

const PROJECT_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#22C55E', // Green
  '#F59E0B', // Amber
  '#A855F7', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
];

export default function ManageProjects() {
  const router = useRouter();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectColor, setProjectColor] = useState(PROJECT_COLORS[0]);
  const [projectCategory, setProjectCategory] = useState('');

  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  const loadProjects = async () => {
    try {
      const data = await projectsService.getProjects();
      setProjects(data);

      // Load note counts
      const counts: Record<string, number> = {};
      for (const project of data) {
        counts[project.id] = await projectsService.getProjectNoteCount(project.id);
      }
      setNoteCounts(counts);
    } catch (error) {
      console.error('Error loading projects:', error);
      Alert.alert('Hiba', 'Nem sikerült betölteni a projekteket.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingProject(null);
    setProjectName('');
    setProjectColor(PROJECT_COLORS[0]);
    setProjectCategory('');
    setShowCreateModal(true);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setProjectName(project.name);
    setProjectColor(project.color);
    setProjectCategory(project.category || '');
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!projectName.trim()) {
      Alert.alert('Hiba', 'A projekt neve kötelező.');
      return;
    }

    try {
      if (editingProject) {
        await projectsService.updateProject(editingProject.id, {
          name: projectName.trim(),
          color: projectColor,
          category: projectCategory || undefined,
        });
      } else {
        await projectsService.createProject({
          name: projectName.trim(),
          color: projectColor,
          category: projectCategory || undefined,
        });
      }
      setShowCreateModal(false);
      loadProjects();
    } catch (error) {
      console.error('Error saving project:', error);
      Alert.alert('Hiba', 'Nem sikerült menteni a projektet.');
    }
  };

  const handleDelete = async (project: Project) => {
    const count = noteCounts[project.id] || 0;
    Alert.alert(
      'Projekt törlése',
      `Biztosan törölni szeretnéd a "${project.name}" projektet?${count > 0 ? `\n\nEz a projekt ${count} jegyzetet tartalmaz, amelyek projekt nélkül maradnak.` : ''}`,
      [
        { text: 'Mégse', style: 'cancel' },
        {
          text: 'Törlés',
          style: 'destructive',
          onPress: async () => {
            try {
              await projectsService.deleteProject(project.id);
              loadProjects();
            } catch (error) {
              Alert.alert('Hiba', 'Nem sikerült törölni a projektet.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Feather name="arrow-left" size={24} color={COLORS.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Projektek kezelése</Text>
        <TouchableOpacity onPress={handleCreate} style={styles.headerButton}>
          <Feather name="plus" size={24} color={COLORS.primaryBlue} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Betöltés...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {projects.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="folder" size={64} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Még nincsenek projekteid</Text>
              <Text style={styles.emptyText}>
                Hozz létre egy új projektet a + gombbal
              </Text>
            </View>
          ) : (
            projects.map(project => (
              <View key={project.id} style={styles.projectCard}>
                <View style={styles.projectHeader}>
                  <View style={styles.projectInfo}>
                    <View
                      style={[styles.projectColorDot, { backgroundColor: project.color }]}
                    />
                    <View style={styles.projectText}>
                      <Text style={styles.projectName}>{project.name}</Text>
                      {project.category && (
                        <Text style={styles.projectCategory}>{project.category}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.projectActions}>
                    <Text style={styles.noteCount}>
                      {noteCounts[project.id] || 0} jegyzet
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleEdit(project)}
                      style={styles.actionButton}
                    >
                      <Feather name="edit-2" size={18} color={COLORS.primaryBlue} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(project)}
                      style={styles.actionButton}
                    >
                      <Feather name="trash-2" size={18} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingProject ? 'Projekt szerkesztése' : 'Új projekt'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                style={styles.modalCloseButton}
              >
                <Feather name="x" size={24} color={COLORS.textWhite} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Projekt neve</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Projekt neve"
                  placeholderTextColor={COLORS.textMuted}
                  value={projectName}
                  onChangeText={setProjectName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Szín</Text>
                <View style={styles.colorPicker}>
                  {PROJECT_COLORS.map(color => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        projectColor === color && styles.colorOptionActive,
                      ]}
                      onPress={() => setProjectColor(color)}
                    >
                      {projectColor === color && (
                        <Feather name="check" size={16} color={COLORS.textWhite} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Kategória (opcionális)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Kategória"
                  placeholderTextColor={COLORS.textMuted}
                  value={projectCategory}
                  onChangeText={setProjectCategory}
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Mégse</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Mentés</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
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
  },
  projectCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  projectColorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  projectText: {
    flex: 1,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textWhite,
    marginBottom: 4,
  },
  projectCategory: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  projectActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noteCount: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  actionButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textWhite,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalBody: {
    padding: 20,
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textWhite,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionActive: {
    borderColor: COLORS.textWhite,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textWhite,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primaryBlue,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textWhite,
  },
});
