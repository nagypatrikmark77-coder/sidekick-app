import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors, FontSize } from '@/constants/theme';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Betöltés...' }: LoadingScreenProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  text: {
    color: Colors.textMuted,
    fontSize: FontSize.lg,
    marginTop: 12,
  },
});
