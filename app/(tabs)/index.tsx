import { StyleSheet, Text, View } from 'react-native';

const COLORS = {
  background: '#0A0A0F',
  textWhite: '#FFFFFF',
  textMuted: '#9CA3AF',
};

export default function Dashboard() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Főoldal</Text>
      <Text style={styles.description}>
        Itt jelennek meg a főoldali információk és áttekintések.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.textWhite,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
});
