import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  Linking,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { profileService, type Profile, type Subscription } from '@/lib/profile-service';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, Radius, FontSize, FontWeight, HEADER_PADDING_TOP } from '@/constants/theme';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Local state for personal data (placeholder until DB ready)
  const [personalData, setPersonalData] = useState({
    age: '',
    occupation: '',
    interests: '',
  });

  // Placeholder toggles
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [profileData, subData] = await Promise.all([
        profileService.getProfile(),
        profileService.getSubscription(),
      ]);
      setProfile(profileData);
      setSubscription(subData);
      if (profileData?.name) setNameInput(profileData.name);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;

    setSavingName(true);
    try {
      await profileService.updateProfile({ name: nameInput.trim() });
      setProfile(prev => prev ? { ...prev, name: nameInput.trim() } : prev);
      setEditingName(false);
    } catch (error) {
      Alert.alert('Hiba', 'Nem sikerült menteni a nevet.');
    } finally {
      setSavingName(false);
    }
  };

  const handlePasswordReset = async () => {
    Alert.alert(
      'Jelszó változtatás',
      'Küldünk egy jelszó-visszaállító emailt a fiókodhoz tartozó email címre.',
      [
        { text: 'Mégse', style: 'cancel' },
        {
          text: 'Küldés',
          onPress: async () => {
            try {
              await profileService.sendPasswordReset();
              Alert.alert('Sikeres', 'Jelszó-visszaállító email elküldve!');
            } catch (error) {
              Alert.alert('Hiba', 'Nem sikerült elküldeni az emailt.');
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Kijelentkezés',
      'Biztosan ki szeretnél jelentkezni?',
      [
        { text: 'Mégse', style: 'cancel' },
        {
          text: 'Kijelentkezés',
          style: 'destructive',
          onPress: signOut,
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Fiók törlése',
      'Biztosan törölni szeretnéd a fiókodat? Ez a művelet nem visszavonható, és minden adatod véglegesen törlődik.',
      [
        { text: 'Mégse', style: 'cancel' },
        {
          text: 'Fiók törlése',
          style: 'destructive',
          onPress: async () => {
            try {
              await profileService.deleteAccount();
            } catch (error) {
              Alert.alert('Hiba', 'Nem sikerült törölni a fiókot.');
            }
          },
        },
      ]
    );
  };

  const getTrialDaysLeft = () => {
    if (!subscription?.trial_ends_at) return 0;
    const end = new Date(subscription.trial_ends_at);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / 86400000);
    return Math.max(0, diff);
  };

  const getSubscriptionLabel = () => {
    if (!subscription) return 'Nincs aktív előfizetés';

    switch (subscription.status) {
      case 'trial': {
        const days = getTrialDaysLeft();
        return `Próbaidőszak: ${days} nap van hátra`;
      }
      case 'active':
        return `${subscription.plan} - Aktív`;
      case 'expired':
        return 'Lejárt';
      case 'cancelled':
        return 'Lemondva';
      default:
        return subscription.status;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profil</Text>
        </View>
        <LoadingScreen />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profil</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Feather name="user" size={40} color={Colors.textMuted} />
            </View>
          )}
          <Text style={styles.profileName}>{profile?.name || 'Felhasználó'}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
        </View>

        {/* Fiók section */}
        <Text style={styles.sectionTitle}>Fiók</Text>
        <Card style={styles.sectionCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Feather name="edit-2" size={20} color={Colors.textMuted} />
              <Text style={styles.settingLabel}>Név szerkesztése</Text>
            </View>
            {editingName ? (
              <View style={styles.nameEditContainer}>
                <TextInput
                  style={styles.nameInput}
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder="Neved"
                  placeholderTextColor={Colors.textMuted}
                  autoFocus
                />
                <TouchableOpacity onPress={handleSaveName} disabled={savingName}>
                  <Feather name="check" size={20} color={Colors.success} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditingName(false)}>
                  <Feather name="x" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setEditingName(true)} style={styles.settingAction}>
                <Text style={styles.settingValue}>{profile?.name || 'Nincs megadva'}</Text>
                <Feather name="chevron-right" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Feather name="mail" size={20} color={Colors.textMuted} />
              <Text style={styles.settingLabel}>Email</Text>
            </View>
            <Text style={styles.settingValueMuted}>{user?.email || ''}</Text>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.settingRow} onPress={handlePasswordReset}>
            <View style={styles.settingLeft}>
              <Feather name="lock" size={20} color={Colors.textMuted} />
              <Text style={styles.settingLabel}>Jelszó változtatás</Text>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Előfizetés section */}
        <Text style={styles.sectionTitle}>Előfizetés</Text>
        <Card style={styles.sectionCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Feather name="credit-card" size={20} color={Colors.textMuted} />
              <View>
                <Text style={styles.settingLabel}>Jelenlegi csomag</Text>
                <Text style={styles.subscriptionStatus}>{getSubscriptionLabel()}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => Linking.openURL('https://sidekickapp.hu')}
          >
            <View style={styles.settingLeft}>
              <Feather name="external-link" size={20} color={Colors.primary} />
              <Text style={[styles.settingLabel, { color: Colors.primary }]}>
                Előfizetés kezelése
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </Card>

        {/* Személyes adatok section */}
        <Text style={styles.sectionTitle}>Személyes adatok</Text>
        <Card style={styles.sectionCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Feather name="calendar" size={20} color={Colors.textMuted} />
              <Text style={styles.settingLabel}>Kor</Text>
            </View>
            <TextInput
              style={styles.inlineInput}
              value={personalData.age}
              onChangeText={v => setPersonalData(p => ({ ...p, age: v }))}
              placeholder="—"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Feather name="briefcase" size={20} color={Colors.textMuted} />
              <Text style={styles.settingLabel}>Foglalkozás</Text>
            </View>
            <TextInput
              style={styles.inlineInput}
              value={personalData.occupation}
              onChangeText={v => setPersonalData(p => ({ ...p, occupation: v }))}
              placeholder="—"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Feather name="heart" size={20} color={Colors.textMuted} />
              <Text style={styles.settingLabel}>Érdeklődési körök</Text>
            </View>
            <TextInput
              style={styles.inlineInput}
              value={personalData.interests}
              onChangeText={v => setPersonalData(p => ({ ...p, interests: v }))}
              placeholder="—"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </Card>

        {/* Alkalmazás section */}
        <Text style={styles.sectionTitle}>Alkalmazás</Text>
        <Card style={styles.sectionCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Feather name="moon" size={20} color={Colors.textMuted} />
              <Text style={styles.settingLabel}>Sötét mód</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.textWhite}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Feather name="bell" size={20} color={Colors.textMuted} />
              <Text style={styles.settingLabel}>Értesítések</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.textWhite}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Feather name="globe" size={20} color={Colors.textMuted} />
              <Text style={styles.settingLabel}>Nyelv</Text>
            </View>
            <Text style={styles.settingValueMuted}>Magyar</Text>
          </View>
        </Card>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <Button
            title="Kijelentkezés"
            variant="outline"
            onPress={handleSignOut}
            style={styles.signOutButton}
          />

          <TouchableOpacity onPress={handleDeleteAccount} style={styles.deleteAccount}>
            <Text style={styles.deleteAccountText}>Fiók törlése</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>Sidekick v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: HEADER_PADDING_TOP,
    paddingBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: Spacing.md,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profileName: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    marginBottom: Spacing.xs,
  },
  profileEmail: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xxl,
  },
  sectionCard: {
    padding: 0,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    minHeight: 52,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  settingLabel: {
    fontSize: FontSize.lg,
    color: Colors.textWhite,
  },
  settingValue: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    marginRight: Spacing.xs,
  },
  settingValueMuted: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  settingAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subscriptionStatus: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },
  nameEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  nameInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.textWhite,
    width: 150,
  },
  inlineInput: {
    fontSize: FontSize.md,
    color: Colors.textWhite,
    textAlign: 'right',
    minWidth: 80,
    paddingVertical: Spacing.xs,
  },
  actionsContainer: {
    marginTop: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  signOutButton: {
    width: '100%',
  },
  deleteAccount: {
    padding: Spacing.sm,
  },
  deleteAccountText: {
    fontSize: FontSize.md,
    color: Colors.error,
    fontWeight: FontWeight.medium,
  },
  versionText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
});
