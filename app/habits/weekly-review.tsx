import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { habitsStatsService } from '@/lib/habits-service';
import { Colors } from '@/constants/theme';
import { StreakBadge } from '@/components/StreakBadge';
import { useAuth } from '@/contexts/AuthContext';

export default function WeeklyReview() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    try {
      const weeklyStats = await habitsStatsService.getWeeklyStats();
      setStats(weeklyStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMotivationalMessage = () => {
    if (!stats) return '';

    const completionRate = stats.totalHabits > 0
      ? (stats.completedHabits / (stats.totalHabits * 7)) * 100
      : 0;

    if (completionRate >= 80) {
      return 'Fantasztikus! Rendkívüli teljesítményt értél el ezen a héten! 🎉';
    } else if (completionRate >= 60) {
      return 'Jó munkát végeztél! Folytasd így! 💪';
    } else if (completionRate >= 40) {
      return 'Nem rossz, de van még mit fejleszteni. Ne add fel! 🌟';
    } else {
      return 'Minden nap egy új lehetőség. Kezdj el ma! 🚀';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Feather name="arrow-left" size={24} color={Colors.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Heti áttekintés</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Betöltés...</Text>
        </View>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Feather name="arrow-left" size={24} color={Colors.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Heti áttekintés</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Nincs elég adat az áttekintéshez.</Text>
        </View>
      </View>
    );
  }

  const completionRate = stats.totalHabits > 0
    ? (stats.completedHabits / (stats.totalHabits * 7)) * 100
    : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Feather name="arrow-left" size={24} color={Colors.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Heti áttekintés</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Szokásaid áttekintése</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryNumber}>{stats.completedHabits}</Text>
              <Text style={styles.summaryLabel}>Teljesített szokás</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryNumber}>{stats.totalHabits * 7}</Text>
              <Text style={styles.summaryLabel}>Összes lehetőség</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryNumber}>{Math.round(completionRate)}%</Text>
              <Text style={styles.summaryLabel}>Teljesítmény</Text>
            </View>
          </View>
        </View>

        <View style={styles.messageCard}>
          <Text style={styles.messageText}>{getMotivationalMessage()}</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Feather name="zap" size={20} color={Colors.warning} />
            <Text style={styles.statTitle}>Legjobb sorozat</Text>
          </View>
          <View style={styles.statValue}>
            <StreakBadge streak={stats.bestStreak} size="large" />
            <Text style={styles.statText}>{stats.bestStreak} nap</Text>
          </View>
        </View>

        {stats.mostConsistent && (
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Feather name="trending-up" size={20} color={Colors.success} />
              <Text style={styles.statTitle}>Legkonzisztensebb szokás</Text>
            </View>
            <View style={styles.habitInfo}>
              <Text style={styles.habitIcon}>{stats.mostConsistent.habit.icon}</Text>
              <View style={styles.habitDetails}>
                <Text style={styles.habitName}>{stats.mostConsistent.habit.name}</Text>
                <Text style={styles.habitRate}>
                  {Math.round(stats.mostConsistent.rate)}% teljesítmény
                </Text>
              </View>
            </View>
          </View>
        )}

        {stats.leastConsistent && stats.leastConsistent.rate < 100 && (
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Feather name="trending-down" size={20} color={Colors.warning} />
              <Text style={styles.statTitle}>Fejlesztendő szokás</Text>
            </View>
            <View style={styles.habitInfo}>
              <Text style={styles.habitIcon}>{stats.leastConsistent.habit.icon}</Text>
              <View style={styles.habitDetails}>
                <Text style={styles.habitName}>{stats.leastConsistent.habit.name}</Text>
                <Text style={styles.habitRate}>
                  {Math.round(stats.leastConsistent.rate)}% teljesítmény
                </Text>
              </View>
            </View>
          </View>
        )}
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
    color: Colors.textMuted,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 16,
  },
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 20,
    textAlign: 'center',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryStat: {
    alignItems: 'center',
    flex: 1,
  },
  summaryNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  messageCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageText: {
    fontSize: 16,
    color: Colors.textWhite,
    textAlign: 'center',
    lineHeight: 24,
  },
  statCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  statTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  statValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  habitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  habitIcon: {
    fontSize: 32,
  },
  habitDetails: {
    flex: 1,
  },
  habitName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 4,
  },
  habitRate: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});
