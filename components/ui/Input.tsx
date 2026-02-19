import { TextInput, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { Colors, Radius, FontSize, Spacing } from '@/constants/theme';

interface InputProps extends TextInputProps {
  containerStyle?: ViewStyle;
}

export function Input({ style, containerStyle, ...props }: InputProps) {
  return (
    <TextInput
      style={[styles.input, style]}
      placeholderTextColor={Colors.textMuted}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.lg,
    color: Colors.textWhite,
  },
});
