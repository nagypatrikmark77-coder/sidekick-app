import { StyleSheet, Text, View } from 'react-native';

const COLORS = {
  textWhite: '#FFFFFF',
  textMuted: '#9CA3AF',
  warning: '#F59E0B',
};

interface StreakBadgeProps {
  streak: number;
  size?: 'small' | 'medium' | 'large';
}

export function StreakBadge({ streak, size = 'medium' }: StreakBadgeProps) {
  const isActive = streak > 0;

  const sizeStyles = {
    small: { icon: 12, text: 10, container: 20 },
    medium: { icon: 16, text: 12, container: 24 },
    large: { icon: 20, text: 14, container: 28 },
  };

  const styles = sizeStyles[size];

  return (
    <View style={[stylesContainer.badge, { height: styles.container, minWidth: styles.container }]}>
      <Text style={[stylesContainer.icon, { fontSize: styles.icon }]}>
        {isActive ? '🔥' : '⚪'}
      </Text>
      {isActive && (
        <Text style={[stylesContainer.text, { fontSize: styles.text, color: COLORS.warning }]}>
          {streak}
        </Text>
      )}
    </View>
  );
}

const stylesContainer = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  icon: {
    lineHeight: 16,
  },
  text: {
    fontWeight: '700',
    color: COLORS.warning,
  },
});
