import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, Radius, FontSize, FontWeight, Spacing } from '@/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'small' | 'medium' | 'large';
}

const variantStyles: Record<ButtonVariant, { bg: string; text: string; border: string }> = {
  primary: { bg: Colors.primary, text: Colors.textWhite, border: Colors.primary },
  secondary: { bg: Colors.card, text: Colors.textWhite, border: Colors.border },
  danger: { bg: Colors.error, text: Colors.textWhite, border: Colors.error },
  outline: { bg: 'transparent', text: Colors.error, border: Colors.error },
};

const sizeStyles = {
  small: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, fontSize: FontSize.md },
  medium: { paddingVertical: Spacing.md + 2, paddingHorizontal: Spacing.xl, fontSize: FontSize.lg },
  large: { paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xxl, fontSize: FontSize.lg },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  size = 'medium',
}: ButtonProps) {
  const colors = variantStyles[variant];
  const sizing = sizeStyles[size];

  return (
    <TouchableOpacity
      style={[
        styles.base,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          paddingVertical: sizing.paddingVertical,
          paddingHorizontal: sizing.paddingHorizontal,
          opacity: disabled ? 0.5 : 1,
        },
        variant === 'outline' && styles.outlineBorder,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={[styles.text, { color: colors.text, fontSize: sizing.fontSize }, textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBorder: {
    borderWidth: 1,
  },
  text: {
    fontWeight: FontWeight.bold,
  },
});
