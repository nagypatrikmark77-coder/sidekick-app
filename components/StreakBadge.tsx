import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';

interface StreakBadgeProps {
  streak: number;
  size?: 'small' | 'medium' | 'large';
}

const sizeStyles = {
  small: { icon: 12, text: 10, container: 20 },
  medium: { icon: 16, text: 12, container: 24 },
  large: { icon: 20, text: 14, container: 28 },
};

export function StreakBadge({ streak, size = 'medium' }: StreakBadgeProps) {
  const isActive = streak > 0;
  const s = sizeStyles[size];

  return (
    <View style={[styles.badge, { height: s.container, minWidth: s.container }]}>
      <Text style={{ fontSize: s.icon, lineHeight: s.icon + 4 }}>
        {isActive ? '\uD83D\uDD25' : '\u26AA'}
      </Text>
      {isActive && (
        <Text style={[styles.text, { fontSize: s.text }]}>{streak}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  text: {
    fontWeight: '700',
    color: Colors.warning,
  },
});
