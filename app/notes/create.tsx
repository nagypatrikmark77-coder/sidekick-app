import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
// DateTimePicker is not available on web, we'll use a simple date input fallback
let DateTimePicker: any;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}
import { Image } from 'expo-image';
import {
  notesService,
  projectsService,
  attachmentsService,
  pickImage,
  takePhoto,
  type Priority,
  type Category,
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
  priorityHigh: '#EF4444',
  priorityMedium: '#F59E0B',
  priorityLow: '#22C55E',
  inputBg: '#1A1A2E',
};

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Alacsony', color: COLORS.priorityLow },
  { value: 'medium', label: 'Közepes', color: COLORS.priorityMedium },
  { value: 'high', label: 'Magas', color: COLORS.priorityHigh },
];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'munka', label: 'Munka' },
  { value: 'suli', label: 'Suli' },
  { value: 'személyes', label: 'Személyes' },
  { value: 'egyéb', label: 'Egyéb' },
];

export default function CreateNote() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState<Category>('egyéb');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [attachments, setAttachments] = useState<{ uri: string; fileName: string }[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadProjects();
  }, [user]);

  useEffect(() => {
    // Auto-save after 3 seconds of inactivity
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }
    autoSaveTimer.current = setTimeout(() => {
      if (title || content) {
        handleSave(true);
      }
    }, 3000);

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [title, content, priority, category, projectId, tags, dueDate, attachments]);

  const loadProjects = async () => {
    try {
      const data = await projectsService.getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleAddPhoto = async () => {
    Alert.alert(
      'Fénykép hozzáadása',
      'Válassz forrást',
      [
        { text: 'Mégse', style: 'cancel' },
        {
          text: 'Kamera',
          onPress: async () => {
            const uri = await takePhoto();
            if (uri) {
              const fileName = `photo_${Date.now()}.jpg`;
              setAttachments([...attachments, { uri, fileName }]);
            }
          },
        },
        {
          text: 'Galéria',
          onPress: async () => {
            const uri = await pickImage();
            if (uri) {
              const fileName = `photo_${Date.now()}.jpg`;
              setAttachments([...attachments, { uri, fileName }]);
            }
          },
        },
      ]
    );
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSave = async (silent = false) => {
    if (!title.trim() && !content.trim()) {
      if (!silent) {
        Alert.alert('Hiba', 'A cím vagy tartalom megadása kötelező.');
      }
      return;
    }

    setSaving(true);
    try {
      const note = await notesService.createNote({
        title: title.trim() || 'Cím nélküli jegyzet',
        content: content.trim(),
        priority,
        category,
        project_id: projectId,
        tags,
        due_date: dueDate?.toISOString() || null,
        pinned: false,
      });

      // Upload attachments
      for (const attachment of attachments) {
        try {
          await attachmentsService.uploadAttachment(note.id, attachment.uri, attachment.fileName);
        } catch (error) {
          console.error('Error uploading attachment:', error);
        }
      }

      if (!silent) {
        router.back();
      }
    } catch (error) {
      console.error('Error saving note:', error);
      if (!silent) {
        Alert.alert('Hiba', 'Nem sikerült menteni a jegyzetet.');
      }
    } finally {
      setSaving(false);
    }
  };

  const getTagColor = (tag: string) => {
    const colors = [
      COLORS.primaryBlue,
      COLORS.priorityMedium,
      COLORS.priorityLow,
      '#A855F7',
      '#EC4899',
    ];
    return colors[tag.length % colors.length];
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Feather name="x" size={24} color={COLORS.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Új jegyzet</Text>
        <TouchableOpacity
          onPress={() => handleSave(false)}
          style={styles.saveButton}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Mentés...' : 'Mentés'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <TextInput
          style={styles.titleInput}
          placeholder="Cím"
          placeholderTextColor={COLORS.textMuted}
          value={title}
          onChangeText={setTitle}
          multiline
        />

        <TextInput
          style={styles.contentInput}
          placeholder="Jegyzet tartalma..."
          placeholderTextColor={COLORS.textMuted}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.actionBar}>
          <View style={styles.actionSection}>
            <Text style={styles.actionLabel}>Projekt</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[
                  styles.projectOption,
                  projectId === null && styles.projectOptionActive,
                ]}
                onPress={() => setProjectId(null)}
              >
                <Text
                  style={[
                    styles.projectOptionText,
                    projectId === null && styles.projectOptionTextActive,
                  ]}
                >
                  Nincs projekt
                </Text>
              </TouchableOpacity>
              {projects.map(project => (
                <TouchableOpacity
                  key={project.id}
                  style={[
                    styles.projectOption,
                    projectId === project.id && styles.projectOptionActive,
                  ]}
                  onPress={() => setProjectId(project.id)}
                >
                  <View
                    style={[styles.projectDot, { backgroundColor: project.color }]}
                  />
                  <Text
                    style={[
                      styles.projectOptionText,
                      projectId === project.id && styles.projectOptionTextActive,
                    ]}
                  >
                    {project.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.actionSection}>
            <Text style={styles.actionLabel}>Prioritás</Text>
            <View style={styles.priorityContainer}>
              {PRIORITIES.map(p => (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    styles.priorityOption,
                    priority === p.value && styles.priorityOptionActive,
                  ]}
                  onPress={() => setPriority(p.value)}
                >
                  <View style={[styles.priorityDot, { backgroundColor: p.color }]} />
                  <Text
                    style={[
                      styles.priorityOptionText,
                      priority === p.value && styles.priorityOptionTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.actionSection}>
            <Text style={styles.actionLabel}>Kategória</Text>
            <View style={styles.categoryContainer}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c.value}
                  style={[
                    styles.categoryOption,
                    category === c.value && styles.categoryOptionActive,
                  ]}
                  onPress={() => setCategory(c.value)}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      category === c.value && styles.categoryOptionTextActive,
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.actionSection}>
            <Text style={styles.actionLabel}>Címkék</Text>
            <View style={styles.tagInputContainer}>
              <TextInput
                style={styles.tagInput}
                placeholder="Címke hozzáadása"
                placeholderTextColor={COLORS.textMuted}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={handleAddTag}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={handleAddTag} style={styles.tagAddButton}>
                <Feather name="plus" size={20} color={COLORS.primaryBlue} />
              </TouchableOpacity>
            </View>
            {tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {tags.map((tag, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.tagChip, { backgroundColor: getTagColor(tag) }]}
                    onPress={() => handleRemoveTag(tag)}
                  >
                    <Text style={styles.tagChipText}>{tag}</Text>
                    <Feather name="x" size={14} color={COLORS.textWhite} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.actionSection}>
            <Text style={styles.actionLabel}>Határidő</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Feather name="calendar" size={20} color={COLORS.textWhite} />
              <Text style={styles.dateButtonText}>
                {dueDate
                  ? dueDate.toLocaleDateString('hu-HU')
                  : 'Határidő beállítása'}
              </Text>
              {dueDate && (
                <TouchableOpacity
                  onPress={() => setDueDate(null)}
                  style={styles.dateRemoveButton}
                >
                  <Feather name="x" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.actionSection}>
            <Text style={styles.actionLabel}>Fényképek</Text>
            <TouchableOpacity style={styles.photoButton} onPress={handleAddPhoto}>
              <Feather name="camera" size={20} color={COLORS.primaryBlue} />
              <Text style={styles.photoButtonText}>Fénykép hozzáadása</Text>
            </TouchableOpacity>
            {attachments.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachmentsContainer}>
                {attachments.map((attachment, index) => (
                  <View key={index} style={styles.attachmentItem}>
                    <Image source={{ uri: attachment.uri }} style={styles.attachmentImage} />
                    <TouchableOpacity
                      style={styles.attachmentRemove}
                      onPress={() => handleRemoveAttachment(index)}
                    >
                      <Feather name="x" size={16} color={COLORS.textWhite} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </ScrollView>

      {showDatePicker && Platform.OS !== 'web' && DateTimePicker && (
        <DateTimePicker
          value={dueDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (selectedDate) {
              setDueDate(selectedDate);
            }
          }}
        />
      )}
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
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.primaryBlue,
  },
  saveButtonText: {
    color: COLORS.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  titleInput: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textWhite,
    marginBottom: 16,
    minHeight: 50,
  },
  contentInput: {
    fontSize: 16,
    color: COLORS.textWhite,
    lineHeight: 24,
    minHeight: 200,
    marginBottom: 24,
  },
  actionBar: {
    gap: 24,
  },
  actionSection: {
    gap: 12,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  projectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
    gap: 6,
  },
  projectOptionActive: {
    backgroundColor: COLORS.primaryBlue,
    borderColor: COLORS.primaryBlue,
  },
  projectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  projectOptionText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  projectOptionTextActive: {
    color: COLORS.textWhite,
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  priorityOptionActive: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.primaryBlue,
    borderWidth: 2,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  priorityOptionText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  priorityOptionTextActive: {
    color: COLORS.textWhite,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryOptionActive: {
    backgroundColor: COLORS.primaryBlue,
    borderColor: COLORS.primaryBlue,
  },
  categoryOptionText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  categoryOptionTextActive: {
    color: COLORS.textWhite,
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
  },
  tagInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textWhite,
    paddingVertical: 10,
  },
  tagAddButton: {
    padding: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  tagChipText: {
    fontSize: 12,
    color: COLORS.textWhite,
    fontWeight: '600',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textWhite,
    fontWeight: '600',
  },
  dateRemoveButton: {
    padding: 4,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  photoButtonText: {
    fontSize: 14,
    color: COLORS.primaryBlue,
    fontWeight: '600',
  },
  attachmentsContainer: {
    marginTop: 8,
  },
  attachmentItem: {
    position: 'relative',
    marginRight: 12,
  },
  attachmentImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  attachmentRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
