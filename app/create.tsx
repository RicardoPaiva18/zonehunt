import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { createGame } from '../lib/gameService';
import { Spacing, Typography, GameConfig } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export default function CreateGameScreen() {
  const { colors } = useTheme();
  const [gameName, setGameName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!gameName.trim()) {
      Alert.alert('Campo obrigatório', 'Dá um nome ao jogo.');
      return;
    }
    if (!playerName.trim()) {
      Alert.alert('Campo obrigatório', 'Escreve o teu nome.');
      return;
    }

    setCreating(true);
    try {
      const { code } = await createGame(gameName.trim(), maxPlayers, playerName.trim());
      router.replace(`/game/lobby?code=${code}`);
    } catch (error: any) {
      Alert.alert('Erro', error.message ?? 'Algo correu mal.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.header, { color: colors.text }]}>Criar Jogo</Text>

      <View style={styles.form}>
        <Text style={[styles.label, { color: colors.textMuted }]}>NOME DO JOGO</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: colors.surface,
            color: colors.text,
            borderColor: colors.border,
          }]}
          placeholder="ex: Jogo 1"
          placeholderTextColor={colors.textMuted}
          value={gameName}
          onChangeText={setGameName}
          maxLength={30}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>O TEU NOME</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: colors.surface,
            color: colors.text,
            borderColor: colors.border,
          }]}
          placeholder="Username"
          placeholderTextColor={colors.textMuted}
          value={playerName}
          onChangeText={setPlayerName}
          maxLength={20}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>Nº DE JOGADORES</Text>
        <View style={styles.playerCount}>
          {Array.from({ length: GameConfig.MAX_PLAYERS }, (_, i) => i + 1).map((n) => (
            <Pressable
              key={n}
              onPress={() => setMaxPlayers(n)}
              style={[
                styles.playerDot,
                { borderColor: colors.textMuted },
                maxPlayers >= n && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
            />
          ))}
          <Text style={[styles.playerCountLabel, { color: colors.text }]}>
            {maxPlayers}/{GameConfig.MAX_PLAYERS}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
          onPress={() => router.back()}
          disabled={creating}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>VOLTAR</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
            creating && styles.disabled,
          ]}
          onPress={handleCreate}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={[styles.primaryButtonText, { color: colors.background }]}>CRIAR →</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
  },
  header: {
    ...Typography.heading,
    marginBottom: Spacing.xl,
  },
  form: {
    flex: 1,
    gap: Spacing.md,
  },
  label: {
    ...Typography.caption,
    letterSpacing: 1,
    marginTop: Spacing.sm,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
    borderWidth: 1,
  },
  playerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  playerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
  },
  playerCountLabel: {
    ...Typography.label,
    marginLeft: Spacing.md,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...Typography.label,
    letterSpacing: 1,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    ...Typography.label,
    letterSpacing: 1,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});