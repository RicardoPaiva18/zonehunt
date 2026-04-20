import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, Typography } from '../../constants/theme';

export default function AreaScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Definir Área</Text>
      <Text style={styles.subtitle}>(em construção)</Text>
      <Text style={styles.code}>Código: {code}</Text>

      <Pressable
        style={styles.button}
        onPress={() => router.replace('/')}
      >
        <Text style={styles.buttonText}>VOLTAR AO MENU</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    ...Typography.heading,
    color: Colors.text,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textMuted,
  },
  code: {
    ...Typography.body,
    color: Colors.primary,
    marginTop: Spacing.md,
  },
  button: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonText: {
    color: Colors.text,
    letterSpacing: 1,
  },
});