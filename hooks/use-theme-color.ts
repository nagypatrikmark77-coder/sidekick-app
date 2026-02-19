import { Colors } from '@/constants/theme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors
) {
  const colorFromProps = props.dark;

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[colorName];
  }
}
