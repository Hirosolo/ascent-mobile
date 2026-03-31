import { Pressable, StyleSheet, Text, ViewStyle, StyleProp, TextStyle } from 'react-native';
import { colors } from '@/theme/tokens';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  variant?: 'solid' | 'hero';
};

export function PrimaryButton({ label, onPress, disabled, style, textStyle, variant = 'solid' }: PrimaryButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'hero' ? styles.heroButton : styles.solidButton,
        style,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.text, variant === 'hero' && styles.heroText, textStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  solidButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  heroButton: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 0,
    paddingVertical: 16,
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
    elevation: 6,
  },
  text: {
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  heroText: {
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.4,
  },
});
