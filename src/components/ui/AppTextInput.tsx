import { TextInput, TextInputProps, StyleSheet, Text, View, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { colors } from '@/theme/tokens';

type AppTextInputProps = TextInputProps & {
  label?: string;
  errorText?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  variant?: 'card' | 'underline';
};

export function AppTextInput({
  label,
  errorText,
  containerStyle,
  inputStyle,
  variant = 'card',
  ...props
}: AppTextInputProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={variant === 'underline' ? 'rgba(244, 244, 245, 0.2)' : colors.textDim}
        style={[styles.input, variant === 'underline' ? styles.underlineInput : styles.cardInput, inputStyle]}
        {...props}
      />
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 10,
    color: colors.textDim,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  input: {
    color: colors.textPrimary,
  },
  cardInput: {
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surfaceCard,
  },
  underlineInput: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(244, 244, 245, 0.22)',
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  error: {
    color: colors.red,
    fontSize: 12,
  },
});
