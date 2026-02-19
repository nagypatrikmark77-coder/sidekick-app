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
import { projectsService, type Project } from '@/lib/notes-service';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, Radius, FontSize, FontWeight, PresetColors, HEADER_PADDING_TOP } from '@/constants/theme';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

export default function ManageProjects() {
  const router = useRouter();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectColor, setProjectColor] = useState<string>(PresetColors[0]);
  const [projectCategory, setProjectCategory] = useState('');

  useEffect(() => {
    if (user) loadProjects();
  }, [user]);

  const loadProjects = async () => {
    try {
      const data = await projectsService.getProjects();
      setProjects(data);

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
    setProjectColor(PresetColors[0]);
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

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Feather name="arrow-left" size={24} color={Colors.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Projektek kezelése</Text>
          <View style={styles.headerButton} />
        </View>
        <LoadingScreen />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Feather name="arrow-left" size={24} color={Colors.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Projektek kezelése</Text>
        <TouchableOpacity onPress={handleCreate} style={styles.headerButton}>
          <Feather name="plus" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {projects.length === 0 ? (
          <EmptyState
            icon="folder"
            title="Még nincsenek projekteid"
            subtitle="Hozz létre egy új projektet a + gombbal"
          />
        ) : (
          projects.map(project => (
            <View key={project.id} style={styles.projectCard}>
              <View style={styles.projectHeader}>
                <View style={styles.projectInfo}>
                  <View style={[styles.projectColorDot, { backgroundColor: project.color }]} />
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
                  <TouchableOpacity onPress={() => handleEdit(project)} style={styles.actionButton}>
                    <Feather name="edit-2" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(project)} style={styles.actionButton}>
                    <Feather name="trash-2" size={18} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

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
              <TouchableOpacity onPress={() => setShowCreateModal(false)} style={styles.modalCloseButton}>
                <Feather name="x" size={24} color={Colors.textWhite} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Projekt neve</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Projekt neve"
                  placeholderTextColor={Colors.textMuted}
                  value={projectName}
                  onChangeText={setProjectName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Szín</Text>
                <View style={styles.colorPicker}>
                  {PresetColors.map(color => (
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
                        <Feather name="check" size={16} color={Colors.textWhite} />
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
                  placeholderTextColor={Colors.textMuted}
                  value={projectCategory}
                  onChangeText={setProjectCategory}
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowCreateModal(false)}>
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: HEADER_PADDING_TOP,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.xl,
  },
  projectCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
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
    gap: Spacing.md,
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
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    marginBottom: 4,
  },
  projectCategory: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  projectActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  noteCount: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  actionButton: {
    padding: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.modalOverlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Spacing.xl,
    borderTopRightRadius: Spacing.xl,
    paddingTop: Spacing.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  modalCloseButton: {
    padding: Spacing.sm,
  },
  modalBody: {
    padding: Spacing.xl,
    gap: Spacing.xxl,
  },
  inputGroup: {
    gap: Spacing.sm,
  },
  inputLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.lg,
    color: Colors.textWhite,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
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
    borderColor: Colors.primary,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textWhite,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textWhite,
  },
});
