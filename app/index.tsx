import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors, Spacing, Typography } from "../constants/theme";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>◎</Text>
        </View>
        <Text style={styles.title}>ZONEHUNT</Text>
        <Text style={styles.tagline}>MULTIPLAYER · LOCATION · AR</Text>
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/create")}
        >
          <Text style={styles.primaryButtonText}>⊕ CRIAR JOGO</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/join")}
        >
          <Text style={styles.secondaryButtonText}>⊞ ENTRAR NUM JOGO</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.xl,
    justifyContent: "space-between",
  },
  header: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  logoText: {
    fontSize: 48,
    color: Colors.background,
  },
  title: {
    ...Typography.title,
    fontSize: 40,
    color: Colors.text,
    letterSpacing: 4,
    marginBottom: Spacing.xs,
  },
  tagline: {
    ...Typography.caption,
    color: Colors.textMuted,
    letterSpacing: 2,
  },
  buttons: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryButtonText: {
    ...Typography.label,
    color: Colors.background,
    letterSpacing: 1,
  },
  secondaryButton: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    ...Typography.label,
    color: Colors.text,
    letterSpacing: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
