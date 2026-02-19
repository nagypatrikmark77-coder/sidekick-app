import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function LoginScreen() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Add meg az email címed és a jelszavad.');
      return;
    }

    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      setError(error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.logo}
          contentFit="contain"
        />

        <Text style={styles.title}>Sidekick</Text>
        <Text style={styles.subtitle}>Jelentkezz be a fiókodba</Text>

        <Input
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />

        <Input
          style={styles.input}
          placeholder="Jelszó"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          autoComplete="password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title="Bejelentkezés"
          onPress={handleSignIn}
          loading={loading}
          disabled={loading}
          size="large"
          style={styles.button}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Még nincs fiókod? </Text>
          <Text
            style={styles.footerLink}
            onPress={() => Linking.openURL('https://sidekickapp.hu')}
          >
            Regisztrálj a sidekickapp.hu-n
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  logo: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.lg,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.xxxl,
  },
  input: {
    marginBottom: Spacing.lg,
  },
  error: {
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    fontSize: FontSize.md,
  },
  button: {
    marginTop: Spacing.xs,
  },
  footerText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  footerLink: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xxl,
    flexWrap: 'wrap',
  },
});
