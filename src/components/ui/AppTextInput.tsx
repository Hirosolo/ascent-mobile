import { TextInput, TextInputProps, StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';

export function AppTextInput(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.textDim} style={styles.input} {...props} />;
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceCard,
  },
});
