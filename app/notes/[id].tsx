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
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  type Category,
  type Project,
  type NoteAttachment,
} from '@/lib/notes-service';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, PriorityColors } from '@/constants/theme';
import { type Priority, PRIORITY_LABELS } from '@/types/database';

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: PRIORITY_LABELS.low, color: PriorityColors.low },
  { value: 'medium', label: PRIORITY_LABELS.medium, color: PriorityColors.medium },
  { value: 'high', label: PRIORITY_LABELS.high, color: PriorityColors.high },
];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'munka', label: 'Munka' },
  { value: 'suli', label: 'Suli' },
  { value: 'személyes', label: 'Személyes' },
  { value: 'egyéb', label: 'Egyéb' },
];

export default function ViewNote() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [note, setNote] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState<Category>('egyéb');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [newAttachments, setNewAttachments] = useState<{ uri: string; fileName: string }[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (id && user) {
      loadNote();
      loadProjects();
    }
  }, [id, user]);

  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setPriority(note.priority || 'medium');
      setCategory(note.category || 'egyéb');
      setProjectId(note.project_id || null);
      setTags(note.tags || []);
      setDueDate(note.due_date ? new Date(note.due_date) : null);
    }
  }, [note]);

  useEffect(() => {
    // Auto-save after 3 seconds of inactivity
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }
    if (note) {
      autoSaveTimer.current = setTimeout(() => {
        handleSave(true);
      }, 3000);
    }

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [title, content, priority, category, projectId, tags, dueDate, newAttachments, note]);

  const loadNote = async () => {
    try {
      const noteData = await notesService.getNote(id);
      if (!noteData) {
        Alert.alert('Hiba', 'A jegyzet nem található.');
        router.back();
        return;
      }
      setNote(noteData);

      const attachmentsData = await attachmentsService.getNoteAttachments(id);
      setAttachments(attachmentsData);
    } catch (error) {
      console.error('Error loading note:', error);
      Alert.alert('Hiba', 'Nem sikerült betölteni a jegyzetet.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

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
              setNewAttachments([...newAttachments, { uri, fileName }]);
            }
          },
        },
        {
          text: 'Galéria',
          onPress: async () => {
            const uri = await pickImage();
            if (uri) {
              const fileName = `photo_${Date.now()}.jpg`;
              setNewAttachments([...newAttachments, { uri, fileName }]);
            }
          },
        },
      ]
    );
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    Alert.alert(
      'Fénykép törlése',
      'Biztosan törölni szeretnéd ezt a fényképet?',
      [
        { text: 'Mégse', style: 'cancel' },
        {
          text: 'Törlés',
          style: 'destructive',
          onPress: async () => {
            try {
              await attachmentsService.deleteAttachment(attachmentId);
              loadNote();
            } catch (error) {
              Alert.alert('Hiba', 'Nem sikerült törölni a fényképet.');
            }
          },
        },
      ]
    );
  };

  const handleRemoveNewAttachment = (index: number) => {
    setNewAttachments(newAttachments.filter((_, i) => i !== index));
  };

  const handleSave = async (silent = false) => {
    if (!note) return;

    setSaving(true);
    try {
      await notesService.updateNote(id, {
        title: title.trim() || 'Cím nélküli jegyzet',
        content: content.trim(),
        priority,
        category,
        project_id: projectId,
        tags,
        due_date: dueDate?.toISOString() || null,
        pinned: note.pinned,
      });

      // Upload new attachments
      for (const attachment of newAttachments) {
        try {
          await attachmentsService.uploadAttachment(id, attachment.uri, attachment.fileName);
        } catch (error) {
          console.error('Error uploading attachment:', error);
        }
      }
      setNewAttachments([]);

      if (!silent) {
        loadNote();
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

  const handleDelete = async () => {
    Alert.alert(
      'Jegyzet törlése',
      'Biztosan törölni szeretnéd ezt a jegyzetet? Ez a művelet nem visszavonható.',
      [
        { text: 'Mégse', style: 'cancel' },
        {
          text: 'Törlés',
          style: 'destructive',
          onPress: async () => {
            try {
              await notesService.deleteNote(id);
              router.back();
            } catch (error) {
              Alert.alert('Hiba', 'Nem sikerült törölni a jegyzetet.');
            }
          },
        },
      ]
    );
  };

  const getTagColor = (tag: string) => {
    const colors = [
      Colors.primary,
      PriorityColors.medium,
      PriorityColors.low,
      '#A855F7',
      '#EC4899',
    ];
    return colors[tag.length % colors.length];
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Feather name="arrow-left" size={24} color={Colors.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Betöltés...</Text>
          <View style={styles.headerButton} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Feather name="arrow-left" size={24} color={Colors.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Jegyzet szerkesztése</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
            <Feather name="trash-2" size={20} color={PriorityColors.high} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleSave(false)}
            style={styles.saveButton}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>{saving ? 'Mentés...' : 'Mentés'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <TextInput
          style={styles.titleInput}
          placeholder="Cím"
          placeholderTextColor={Colors.textMuted}
          value={title}
          onChangeText={setTitle}
          multiline
        />

        <TextInput
          style={styles.contentInput}
          placeholder="Jegyzet tartalma..."
          placeholderTextColor={Colors.textMuted}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />

        {(attachments.length > 0 || newAttachments.length > 0) && (
          <View style={styles.attachmentsSection}>
            <Text style={styles.sectionTitle}>Fényképek</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {attachments.map(attachment => (
                <View key={attachment.id} style={styles.attachmentItem}>
                  <Image
                    source={{ uri: attachmentsService.getAttachmentUrl(attachment.file_path) }}
                    style={styles.attachmentImage}
                  />
                  <TouchableOpacity
                    style={styles.attachmentRemove}
                    onPress={() => handleRemoveAttachment(attachment.id)}
                  >
                    <Feather name="x" size={16} color={Colors.textWhite} />
                  </TouchableOpacity>
                </View>
              ))}
              {newAttachments.map((attachment, index) => (
                <View key={`new-${index}`} style={styles.attachmentItem}>
                  <Image source={{ uri: attachment.uri }} style={styles.attachmentImage} />
                  <TouchableOpacity
                    style={styles.attachmentRemove}
                    onPress={() => handleRemoveNewAttachment(index)}
                  >
                    <Feather name="x" size={16} color={Colors.textWhite} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

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
                placeholderTextColor={Colors.textMuted}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={handleAddTag}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={handleAddTag} style={styles.tagAddButton}>
                <Feather name="plus" size={20} color={Colors.primary} />
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
                    <Feather name="x" size={14} color={Colors.textWhite} />
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
              <Feather name="calendar" size={20} color={Colors.textWhite} />
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
                  <Feather name="x" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.actionSection}>
            <Text style={styles.actionLabel}>Fényképek</Text>
            <TouchableOpacity style={styles.photoButton} onPress={handleAddPhoto}>
              <Feather name="camera" size={20} color={Colors.primary} />
              <Text style={styles.photoButtonText}>Fénykép hozzáadása</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {showDatePicker && Platform.OS !== 'web' && DateTimePicker && (
        <DateTimePicker
          value={dueDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event: any, selectedDate: any) => {
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    color: Colors.textWhite,
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
    color: Colors.textWhite,
    marginBottom: 16,
    minHeight: 50,
  },
  contentInput: {
    fontSize: 16,
    color: Colors.textWhite,
    lineHeight: 24,
    minHeight: 200,
    marginBottom: 24,
  },
  attachmentsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 12,
  },
  attachmentItem: {
    position: 'relative',
    marginRight: 12,
  },
  attachmentImage: {
    width: 120,
    height: 120,
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
  actionBar: {
    gap: 24,
  },
  actionSection: {
    gap: 12,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  projectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    gap: 6,
  },
  projectOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  projectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  projectOptionText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  projectOptionTextActive: {
    color: Colors.textWhite,
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
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  priorityOptionActive: {
    backgroundColor: Colors.card,
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  priorityOptionText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  priorityOptionTextActive: {
    color: Colors.textWhite,
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
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryOptionText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  categoryOptionTextActive: {
    color: Colors.textWhite,
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  tagInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textWhite,
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
    color: Colors.textWhite,
    fontWeight: '600',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textWhite,
    fontWeight: '600',
  },
  dateRemoveButton: {
    padding: 4,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  photoButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
});
