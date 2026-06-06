import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import {
  findActiveGameForUser,
  getRouteForGameStatus,
} from '../lib/gameService';
import { Spacing, Typography } from '../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export default function HomeScreen() {
  const [checking, setChecking] = useState(true);
  const { isDark, toggleTheme, colors } = useTheme();

  useEffect(() => {
    (async () => {
      try {
        const activeGame = await findActiveGameForUser();
        if (activeGame) {
          router.replace(getRouteForGameStatus(activeGame));
          return;
        }
      } catch (e) {
        console.error('Erro a procurar jogo ativo:', e);
      }
      setChecking(false);
    })();
  }, []);

  if (checking) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.checkingLabel, { color: colors.textMuted }]}>
          A verificar...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Toggle de tema — canto superior direito */}
      <Pressable
        style={[styles.themeToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={toggleTheme}
      >
        <Text style={styles.themeToggleIcon}>{isDark ? '☀️' : '🌙'}</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Text style={[styles.logoText, { color: colors.background }]}>◎</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>ZONEHUNT</Text>
        <Text style={[styles.tagline, { color: colors.textMuted }]}>
          MULTIPLAYER · LOCATION · AR
        </Text>
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
          ]}
          onPress={() => router.push('/create')}
        >
          <Text style={[styles.primaryButtonText, { color: colors.background }]}>
            ⊕ CRIAR JOGO
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
          onPress={() => router.push('/join')}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            ⊞ ENTRAR NUM JOGO
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themeToggle: {
    position: 'absolute',
    top: Spacing.xxl,
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  themeToggleIcon: {
    fontSize: 20,
  },
  checkingLabel: {
    ...Typography.caption,
    marginTop: Spacing.md,
    letterSpacing: 2,
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoText: {
    fontSize: 48,
  },
  title: {
    ...Typography.title,
    fontSize: 40,
    letterSpacing: 4,
    marginBottom: Spacing.xs,
  },
  tagline: {
    ...Typography.caption,
    letterSpacing: 2,
  },
  buttons: {
    width: '100%',
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  primaryButton: {
    paddingVertical: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...Typography.label,
    letterSpacing: 1,
  },
  secondaryButton: {
    paddingVertical: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    ...Typography.label,
    letterSpacing: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});