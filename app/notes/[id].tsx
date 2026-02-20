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
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
let DateTimePicker: any;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}
import {
  notesService,
  projectsService,
  attachmentsService,
  pickImage,
  takePhoto,
  type Project,
  type NoteAttachment,
} from '@/lib/notes-service';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, Radius, FontSize, FontWeight, HEADER_PADDING_TOP } from '@/constants/theme';
import { type Priority, type NoteCategory, PRIORITY_LABELS, CATEGORY_LABELS } from '@/types/database';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

const SCREEN_BG = '#0A0A0F';
const CARD_BG = '#1A1A2E';
const BORDER_COLOR = '#2A2A4A';

const ACCENT_COLORS = [
  '#3B82F6', '#EF4444', '#22C55E', '#F59E0B',
  '#A855F7', '#EC4899', '#06B6D4', '#F97316',
];

const TAG_PASTEL_COLORS = [
  '#6366F1', '#8B5CF6', '#A855F7', '#EC4899',
  '#F43F5E', '#3B82F6', '#06B6D4', '#14B8A6',
];

const CATEGORIES: { value: NoteCategory; label: string }[] = [
  { value: 'munka', label: 'Munka' },
  { value: 'tanulás', label: 'Tanulas' },
  { value: 'személyes', label: 'Szemelyes' },
  { value: 'ötlet', label: 'Otlet' },
  { value: 'feladat', label: 'Feladat' },
  { value: 'egyéb', label: 'Egyeb' },
];

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'high', label: 'Magas', color: '#EF4444' },
  { value: 'medium', label: 'Kozepes', color: '#F59E0B' },
  { value: 'low', label: 'Alacsony', color: '#22C55E' },
];

type ActiveSheet = 'color' | 'project' | 'tag' | 'priority' | 'category' | 'date' | 'photo' | null;

export default function ViewNote() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState<NoteCategory>('egyéb');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [accentColor, setAccentColor] = useState<string>('#3B82F6');
  const [isPinned, setIsPinned] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [existingAttachments, setExistingAttachments] = useState<NoteAttachment[]>([]);
  const [newAttachments, setNewAttachments] = useState<{ uri: string; fileName: string }[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [menuVisible, setMenuVisible] = useState(false);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [noteLoaded, setNoteLoaded] = useState(false);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (id && user) {
      loadNote();
      loadProjects();
    }
  }, [id, user]);

  // Auto-save after 2 seconds of inactivity (only after initial load)
  useEffect(() => {
    if (!noteLoaded) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(() => {
      handleAutoSave();
    }, 2000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [title, content, priority, category, projectId, tags, dueDate, accentColor, noteLoaded]);

  const loadNote = async () => {
    try {
      const noteData = await notesService.getNote(id);
      if (!noteData) {
        Alert.alert('Hiba', 'A jegyzet nem talalhato.');
        router.back();
        return;
      }

      setTitle(noteData.title || '');
      setContent(noteData.content || '');
      setPriority(noteData.priority || 'medium');
      setCategory(noteData.category || 'egyéb');
      setProjectId(noteData.project_id || null);
      setTags(noteData.tags || []);
      setDueDate(noteData.due_date ? new Date(noteData.due_date) : null);
      setIsPinned(noteData.is_pinned);
      setCreatedAt(noteData.created_at);
      setUpdatedAt(noteData.updated_at);

      const attachmentsData = await attachmentsService.getNoteAttachments(id);
      setExistingAttachments(attachmentsData);

      setNoteLoaded(true);
    } catch (error) {
      console.error('Error loading note:', error);
      Alert.alert('Hiba', 'Nem sikerult betolteni a jegyzetet.');
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

  const handleAutoSave = async () => {
    setSaveStatus('saving');
    try {
      await notesService.updateNote(id, {
        title: title.trim() || 'Cim nelkuli jegyzet',
        content: content.trim(),
        priority,
        category,
        project_id: projectId,
        tags,
        due_date: dueDate?.toISOString() || null,
        is_pinned: isPinned,
      });

      // Upload any new attachments
      for (const att of newAttachments) {
        try {
          await attachmentsService.uploadAttachment(id, att.uri, att.fileName);
        } catch (error) {
          console.error('Error uploading:', error);
        }
      }
      if (newAttachments.length > 0) {
        setNewAttachments([]);
        const fresh = await attachmentsService.getNoteAttachments(id);
        setExistingAttachments(fresh);
      }

      setUpdatedAt(new Date().toISOString());
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error auto-saving:', error);
      setSaveStatus('idle');
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
    Alert.alert('Fenykep hozzaadasa', 'Valassz forrast', [
      { text: 'Megse', style: 'cancel' },
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
        text: 'Galeria',
        onPress: async () => {
          const uri = await pickImage();
          if (uri) {
            const fileName = `photo_${Date.now()}.jpg`;
            setNewAttachments([...newAttachments, { uri, fileName }]);
          }
        },
      },
    ]);
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    Alert.alert('Fenykep torlese', 'Biztosan torolni szeretned?', [
      { text: 'Megse', style: 'cancel' },
      {
        text: 'Torles',
        style: 'destructive',
        onPress: async () => {
          try {
            await attachmentsService.deleteAttachment(attachmentId);
            const fresh = await attachmentsService.getNoteAttachments(id);
            setExistingAttachments(fresh);
          } catch (error) {
            Alert.alert('Hiba', 'Nem sikerult torolni.');
          }
        },
      },
    ]);
  };

  const handleDelete = async () => {
    Alert.alert(
      'Jegyzet torlese',
      'Biztosan torolni szeretned ezt a jegyzetet? Ez a muvelet nem visszavonhato.',
      [
        { text: 'Megse', style: 'cancel' },
        {
          text: 'Torles',
          style: 'destructive',
          onPress: async () => {
            try {
              await notesService.deleteNote(id);
              router.back();
            } catch (error) {
              Alert.alert('Hiba', 'Nem sikerult torolni.');
            }
          },
        },
      ]
    );
  };

  const getTagColor = (tag: string) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return TAG_PASTEL_COLORS[Math.abs(hash) % TAG_PASTEL_COLORS.length];
  };

  const getProjectName = (pid: string | null) => {
    if (!pid) return null;
    return projects.find(p => p.id === pid);
  };

  const formatDateDisplay = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitleText}>Betoltes...</Text>
          </View>
          <View style={styles.headerBtn} />
        </View>
        <LoadingScreen />
      </View>
    );
  }

  const allAttachments = [
    ...existingAttachments.map(a => ({
      type: 'existing' as const,
      id: a.id,
      uri: attachmentsService.getAttachmentUrl(a.file_path),
    })),
    ...newAttachments.map((a, idx) => ({
      type: 'new' as const,
      id: `new-${idx}`,
      uri: a.uri,
    })),
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          {saveStatus === 'saving' && (
            <Text style={styles.saveIndicator}>Mentes...</Text>
          )}
          {saveStatus === 'saved' && (
            <View style={styles.savedRow}>
              <Feather name="check" size={14} color="#22C55E" />
              <Text style={styles.savedText}>Mentve</Text>
            </View>
          )}
          {saveStatus === 'idle' && (
            <Text style={styles.headerTitleText} numberOfLines={1}>
              {title || 'Jegyzet'}
            </Text>
          )}
        </View>

        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.headerBtn}>
          <Feather name="more-horizontal" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Editor */}
      <KeyboardAvoidingView
        style={styles.editorWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.editor}
          contentContainerStyle={styles.editorContent}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            style={styles.titleInput}
            placeholder="Jegyzet cime..."
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
            returnKeyType="next"
            onSubmitEditing={() => contentInputRef.current?.focus()}
            blurOnSubmit={false}
          />

          {/* Tags display below title */}
          {tags.length > 0 && (
            <View style={styles.tagsDisplay}>
              {tags.map((tag, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.tagPill, { backgroundColor: getTagColor(tag) + '30' }]}
                  onPress={() => handleRemoveTag(tag)}
                >
                  <Text style={[styles.tagPillText, { color: getTagColor(tag) }]}>{tag}</Text>
                  <Feather name="x" size={12} color={getTagColor(tag)} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TextInput
            ref={contentInputRef}
            style={styles.contentInput}
            placeholder="Kezdj el irni..."
            placeholderTextColor={Colors.textMuted}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />

          {/* Attachments */}
          {allAttachments.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachmentsRow}>
              {allAttachments.map(att => (
                <View key={att.id} style={styles.attachmentThumb}>
                  <Image source={{ uri: att.uri }} style={styles.attachmentImg} />
                  <TouchableOpacity
                    style={styles.attachmentRemove}
                    onPress={() => {
                      if (att.type === 'existing') {
                        handleDeleteAttachment(att.id);
                      } else {
                        const idx = parseInt(att.id.replace('new-', ''));
                        setNewAttachments(newAttachments.filter((_, i) => i !== idx));
                      }
                    }}
                  >
                    <Feather name="x" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Dates at bottom */}
          <View style={styles.datesContainer}>
            {createdAt && (
              <Text style={styles.dateInfoText}>
                Letrehozva: {formatDateDisplay(createdAt)}
              </Text>
            )}
            {updatedAt && (
              <Text style={styles.dateInfoText}>
                Utolso modositas: {formatDateDisplay(updatedAt)}
              </Text>
            )}
          </View>
        </ScrollView>

        {/* Bottom Toolbar */}
        <View style={styles.toolbar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolbarContent}
          >
            <TouchableOpacity style={styles.toolbarItem} onPress={() => setActiveSheet('color')}>
              <View style={[styles.toolbarColorDot, { backgroundColor: accentColor }]} />
              <Text style={styles.toolbarLabel}>Szin</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolbarItem} onPress={() => setActiveSheet('project')}>
              <Feather name="folder" size={18} color={projectId ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.toolbarLabel, projectId && { color: Colors.primary }]}>
                {projectId ? (getProjectName(projectId)?.name || 'Projekt') : 'Projekt'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolbarItem} onPress={() => setActiveSheet('tag')}>
              <Feather name="tag" size={18} color={tags.length > 0 ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.toolbarLabel, tags.length > 0 && { color: Colors.primary }]}>
                Cimke{tags.length > 0 ? ` (${tags.length})` : ''}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolbarItem} onPress={() => setActiveSheet('priority')}>
              <Feather name="zap" size={18} color={
                priority === 'high' ? '#EF4444' : priority === 'medium' ? '#F59E0B' : '#22C55E'
              } />
              <Text style={[styles.toolbarLabel, {
                color: priority === 'high' ? '#EF4444' : priority === 'medium' ? '#F59E0B' : '#22C55E'
              }]}>
                {PRIORITIES.find(p => p.value === priority)?.label || 'Prioritas'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolbarItem} onPress={() => setActiveSheet('category')}>
              <Feather name="grid" size={18} color={category !== 'egyéb' ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.toolbarLabel, category !== 'egyéb' && { color: Colors.primary }]}>
                {CATEGORIES.find(c => c.value === category)?.label || 'Kategoria'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolbarItem}
              onPress={() => {
                if (Platform.OS === 'web') {
                  Alert.alert('Hatarido', 'A datumvalaszto nem elerheto weben.');
                } else {
                  setShowDatePicker(true);
                }
              }}
            >
              <Feather name="calendar" size={18} color={dueDate ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.toolbarLabel, dueDate && { color: Colors.primary }]}>
                {dueDate ? dueDate.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }) : 'Hatarido'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolbarItem} onPress={handleAddPhoto}>
              <Feather name="camera" size={18} color={allAttachments.length > 0 ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.toolbarLabel, allAttachments.length > 0 && { color: Colors.primary }]}>
                Foto{allAttachments.length > 0 ? ` (${allAttachments.length})` : ''}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Date Picker */}
      {showDatePicker && Platform.OS !== 'web' && DateTimePicker && (
        <DateTimePicker
          value={dueDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event: any, selectedDate: any) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (selectedDate) setDueDate(selectedDate);
          }}
        />
      )}

      {/* Menu Modal */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContent}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                handleDelete();
              }}
            >
              <Feather name="trash-2" size={18} color="#EF4444" />
              <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Torles</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                Alert.alert('Megosztas', 'Hamarosan elerheto!');
              }}
            >
              <Feather name="share" size={18} color={Colors.textMuted} />
              <Text style={styles.menuItemText}>Megosztas</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Bottom Sheet for toolbar options */}
      <Modal
        visible={activeSheet !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveSheet(null)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setActiveSheet(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sheetContent}>
            <View style={styles.sheetHandle} />

            {activeSheet === 'color' && (
              <View style={styles.sheetBody}>
                <Text style={styles.sheetTitle}>Szin</Text>
                <View style={styles.colorGrid}>
                  {ACCENT_COLORS.map(color => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        accentColor === color && styles.colorOptionActive,
                      ]}
                      onPress={() => { setAccentColor(color); setActiveSheet(null); }}
                    >
                      {accentColor === color && <Feather name="check" size={18} color="#FFFFFF" />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {activeSheet === 'project' && (
              <View style={styles.sheetBody}>
                <Text style={styles.sheetTitle}>Projekt</Text>
                <TouchableOpacity
                  style={[styles.sheetOption, !projectId && styles.sheetOptionActive]}
                  onPress={() => { setProjectId(null); setActiveSheet(null); }}
                >
                  <Text style={[styles.sheetOptionText, !projectId && styles.sheetOptionTextActive]}>
                    Nincs projekt
                  </Text>
                </TouchableOpacity>
                {projects.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.sheetOption, projectId === p.id && styles.sheetOptionActive]}
                    onPress={() => { setProjectId(p.id); setActiveSheet(null); }}
                  >
                    <View style={[styles.sheetOptionDot, { backgroundColor: p.color }]} />
                    <Text style={[styles.sheetOptionText, projectId === p.id && styles.sheetOptionTextActive]}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {activeSheet === 'tag' && (
              <View style={styles.sheetBody}>
                <Text style={styles.sheetTitle}>Cimkek</Text>
                <View style={styles.tagInputRow}>
                  <TextInput
                    style={styles.tagInput}
                    placeholder="Uj cimke..."
                    placeholderTextColor={Colors.textMuted}
                    value={tagInput}
                    onChangeText={setTagInput}
                    onSubmitEditing={handleAddTag}
                    returnKeyType="done"
                    autoFocus
                  />
                  <TouchableOpacity style={styles.tagAddBtn} onPress={handleAddTag}>
                    <Feather name="plus" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                {tags.length > 0 && (
                  <View style={styles.sheetTags}>
                    {tags.map((tag, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.sheetTagPill, { backgroundColor: getTagColor(tag) + '30' }]}
                        onPress={() => handleRemoveTag(tag)}
                      >
                        <Text style={[styles.sheetTagText, { color: getTagColor(tag) }]}>{tag}</Text>
                        <Feather name="x" size={12} color={getTagColor(tag)} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {activeSheet === 'priority' && (
              <View style={styles.sheetBody}>
                <Text style={styles.sheetTitle}>Prioritas</Text>
                {PRIORITIES.map(p => (
                  <TouchableOpacity
                    key={p.value}
                    style={[styles.sheetOption, priority === p.value && styles.sheetOptionActive]}
                    onPress={() => { setPriority(p.value); setActiveSheet(null); }}
                  >
                    <View style={[styles.sheetOptionDot, { backgroundColor: p.color }]} />
                    <Text style={[styles.sheetOptionText, priority === p.value && styles.sheetOptionTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {activeSheet === 'category' && (
              <View style={styles.sheetBody}>
                <Text style={styles.sheetTitle}>Kategoria</Text>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.value}
                    style={[styles.sheetOption, category === c.value && styles.sheetOptionActive]}
                    onPress={() => { setCategory(c.value); setActiveSheet(null); }}
                  >
                    <Text style={[styles.sheetOptionText, category === c.value && styles.sheetOptionTextActive]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {activeSheet === 'date' && (
              <View style={styles.sheetBody}>
                <Text style={styles.sheetTitle}>Hatarido</Text>
                <TouchableOpacity
                  style={styles.sheetOption}
                  onPress={() => {
                    setActiveSheet(null);
                    if (Platform.OS !== 'web') setShowDatePicker(true);
                  }}
                >
                  <Feather name="calendar" size={18} color={Colors.primary} />
                  <Text style={styles.sheetOptionText}>
                    {dueDate ? dueDate.toLocaleDateString('hu-HU') : 'Datum valasztasa'}
                  </Text>
                </TouchableOpacity>
                {dueDate && (
                  <TouchableOpacity
                    style={styles.sheetOption}
                    onPress={() => { setDueDate(null); setActiveSheet(null); }}
                  >
                    <Feather name="x" size={18} color="#EF4444" />
                    <Text style={[styles.sheetOptionText, { color: '#EF4444' }]}>Hatarido torlese</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
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
    paddingBottom: Spacing.md,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
  saveIndicator: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savedText: {
    fontSize: FontSize.md,
    color: '#22C55E',
    fontWeight: FontWeight.medium,
  },

  // Editor
  editorWrapper: {
    flex: 1,
  },
  editor: {
    flex: 1,
  },
  editorContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: 40,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    padding: 0,
    marginBottom: Spacing.sm,
  },
  contentInput: {
    fontSize: FontSize.lg,
    color: '#FFFFFF',
    lineHeight: 26,
    padding: 0,
    minHeight: 300,
  },

  // Tags display
  tagsDisplay: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    gap: 4,
  },
  tagPillText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  // Attachments
  attachmentsRow: {
    marginTop: Spacing.lg,
  },
  attachmentThumb: {
    position: 'relative',
    marginRight: Spacing.md,
  },
  attachmentImg: {
    width: 80,
    height: 80,
    borderRadius: Radius.md,
  },
  attachmentRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Dates
  datesContainer: {
    marginTop: 40,
    gap: 4,
  },
  dateInfoText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },

  // Toolbar
  toolbar: {
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    backgroundColor: SCREEN_BG,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  toolbarContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  toolbarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    gap: 6,
    marginRight: 4,
  },
  toolbarColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  toolbarLabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
  },

  // Menu
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: HEADER_PADDING_TOP + 44,
    paddingRight: Spacing.xl,
  },
  menuContent: {
    backgroundColor: CARD_BG,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    overflow: 'hidden',
    minWidth: 180,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  menuItemText: {
    fontSize: FontSize.lg,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },

  // Bottom sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: SCREEN_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '60%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER_COLOR,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sheetBody: {
    paddingHorizontal: Spacing.xl,
  },
  sheetTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    marginBottom: Spacing.lg,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  colorOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionActive: {
    borderColor: '#FFFFFF',
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  sheetOptionActive: {
    backgroundColor: Colors.primary + '20',
  },
  sheetOptionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sheetOptionText: {
    fontSize: FontSize.lg,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
  },
  sheetOptionTextActive: {
    color: '#FFFFFF',
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  tagInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: '#FFFFFF',
    paddingVertical: Spacing.md,
  },
  tagAddBtn: {
    padding: Spacing.sm,
  },
  sheetTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  sheetTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    gap: 4,
  },
  sheetTagText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
