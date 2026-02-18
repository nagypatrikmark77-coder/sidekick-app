import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  habitsService,
  type Habit,
  type HabitFrequency,
  type HabitCategory,
} from '@/lib/habits-service';
import { useAuth } from '@/contexts/AuthContext';

const COLORS = {
  background: '#0A0A0F',
  card: '#1A1A2E',
  border: '#2A2A4A',
  primaryBlue: '#3B82F6',
  textWhite: '#FFFFFF',
  textMuted: '#9CA3AF',
};

const EMOJIS = [
  '💪', '🏃', '📚', '💧', '🧘', '🍎', '📝', '🎯',
  '⚡', '🌱', '🎨', '🎵', '📖', '🏋️', '🚶', '😴',
  '☕', '🧠', '💤', '🌟',
];

const COLORS_PRESET = [
  '#3B82F6', '#EF4444', '#22C55E', '#F59E0B',
  '#A855F7', '#EC4899', '#06B6D4', '#F97316',
];

const FREQUENCIES: { value: HabitFrequency; label: string }[] = [
  { value: 'daily', label: 'Naponta' },
  { value: 'weekly', label: 'Hetente' },
  { value: 'custom', label: 'Egyéni' },
];

const CATEGORIES: { value: HabitCategory; label: string }[] = [
  { value: 'munka', label: 'Munka' },
  { value: 'egészség', label: 'Egészség' },
  { value: 'tanulás', label: 'Tanulás' },
  { value: 'sport', label: 'Sport' },
  { value: 'egyéb', label: 'Egyéb' },
];

const DAYS = [
  { value: 0, label: 'V', short: 'V' },
  { value: 1, label: 'H', short: 'H' },
  { value: 2, label: 'K', short: 'K' },
  { value: 3, label: 'Sze', short: 'Sze' },
  { value: 4, label: 'Cs', short: 'Cs' },
  { value: 5, label: 'P', short: 'P' },
  { value: 6, label: 'Szo', short: 'Szo' },
];

export default function CreateHabit() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS_PRESET[0]);
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [category, setCategory] = useState<HabitCategory>('egyéb');
  const [targetCount, setTargetCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (id && user) {
      loadHabit();
    }
  }, [id, user]);

  const loadHabit = async () => {
    try {
      const habit = await habitsService.getHabit(id!);
      if (habit) {
        setName(habit.name);
        setDescription(habit.description || '');
        setIcon(habit.icon);
        setColor(habit.color);
        setFrequency(habit.frequency);
        setCustomDays(habit.custom_days || []);
        setCategory(habit.category);
        setTargetCount(habit.target_count);
        setEditing(true);
      }
    } catch (error) {
      console.error('Error loading habit:', error);
      Alert.alert('Hiba', 'Nem sikerült betölteni a szokást.');
      router.back();
    }
  };

  const toggleDay = (day: number) => {
    if (customDays.includes(day)) {
      setCustomDays(customDays.filter(d => d !== day));
    } else {
      setCustomDays([...customDays, day]);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Hiba', 'A szokás neve kötelező.');
      return;
    }

    if (frequency === 'custom' && customDays.length === 0) {
      Alert.alert('Hiba', 'Válassz legalább egy napot az egyéni gyakoriságnál.');
      return;
    }

    setLoading(true);
    try {
      const habitData = {
        name: name.trim(),
        description: description.trim() || null,
        icon,
        color,
        frequency,
        custom_days: frequency === 'custom' ? customDays : null,
        category,
        target_count: targetCount,
        archived: false,
      };

      if (editing && id) {
        await habitsService.updateHabit(id, habitData);
      } else {
        await habitsService.createHabit(habitData);
      }

      router.back();
    } catch (error) {
      console.error('Error saving habit:', error);
      Alert.alert('Hiba', 'Nem sikerült menteni a szokást.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Feather name="x" size={24} color={COLORS.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {editing ? 'Szokás szerkesztése' : 'Új szokás'}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.saveButton}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>{loading ? 'Mentés...' : 'Mentés'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Név *</Text>
          <TextInput
            style={styles.input}
            placeholder="Szokás neve"
            placeholderTextColor={COLORS.textMuted}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Leírás</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Opcionális leírás"
            placeholderTextColor={COLORS.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ikon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.iconPicker}>
              {EMOJIS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.iconOption,
                    icon === emoji && styles.iconOptionActive,
                  ]}
                  onPress={() => setIcon(emoji)}
                >
                  <Text style={styles.iconText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Szín</Text>
          <View style={styles.colorPicker}>
            {COLORS_PRESET.map(colorOption => (
              <TouchableOpacity
                key={colorOption}
                style={[
                  styles.colorOption,
                  { backgroundColor: colorOption },
                  color === colorOption && styles.colorOptionActive,
                ]}
                onPress={() => setColor(colorOption)}
              >
                {color === colorOption && (
                  <Feather name="check" size={16} color={COLORS.textWhite} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Gyakoriság</Text>
          <View style={styles.frequencyContainer}>
            {FREQUENCIES.map(freq => (
              <TouchableOpacity
                key={freq.value}
                style={[
                  styles.frequencyOption,
                  frequency === freq.value && styles.frequencyOptionActive,
                ]}
                onPress={() => setFrequency(freq.value)}
              >
                <Text
                  style={[
                    styles.frequencyText,
                    frequency === freq.value && styles.frequencyTextActive,
                  ]}
                >
                  {freq.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {frequency === 'custom' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Válassz napokat</Text>
            <View style={styles.daysContainer}>
              {DAYS.map(day => (
                <TouchableOpacity
                  key={day.value}
                  style={[
                    styles.dayOption,
                    customDays.includes(day.value) && styles.dayOptionActive,
                  ]}
                  onPress={() => toggleDay(day.value)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      customDays.includes(day.value) && styles.dayTextActive,
                    ]}
                  >
                    {day.short}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Kategória</Text>
          <View style={styles.categoryContainer}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.value}
                style={[
                  styles.categoryOption,
                  category === cat.value && styles.categoryOptionActive,
                ]}
                onPress={() => setCategory(cat.value)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    category === cat.value && styles.categoryTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Cél (hányszor naponta)</Text>
          <View style={styles.targetContainer}>
            <TouchableOpacity
              style={styles.targetButton}
              onPress={() => setTargetCount(Math.max(1, targetCount - 1))}
            >
              <Feather name="minus" size={20} color={COLORS.textWhite} />
            </TouchableOpacity>
            <Text style={styles.targetCount}>{targetCount}</Text>
            <TouchableOpacity
              style={styles.targetButton}
              onPress={() => setTargetCount(targetCount + 1)}
            >
              <Feather name="plus" size={20} color={COLORS.textWhite} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
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
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  iconPicker: {
    flexDirection: 'row',
    gap: 12,
  },
  iconOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconOptionActive: {
    borderColor: COLORS.primaryBlue,
    borderWidth: 3,
  },
  iconText: {
    fontSize: 24,
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
  frequencyContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  frequencyOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  frequencyOptionActive: {
    backgroundColor: COLORS.primaryBlue,
    borderColor: COLORS.primaryBlue,
  },
  frequencyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  frequencyTextActive: {
    color: COLORS.textWhite,
  },
  daysContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dayOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  dayOptionActive: {
    backgroundColor: COLORS.primaryBlue,
    borderColor: COLORS.primaryBlue,
  },
  dayText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  dayTextActive: {
    color: COLORS.textWhite,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryOptionActive: {
    backgroundColor: COLORS.primaryBlue,
    borderColor: COLORS.primaryBlue,
  },
  categoryText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: COLORS.textWhite,
  },
  targetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  targetButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetCount: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textWhite,
    minWidth: 40,
    textAlign: 'center',
  },
});
