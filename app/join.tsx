import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { subscribeToGame, subscribeToPlayers, joinGame } from '../lib/gameService';
import { Spacing, Typography } from '../constants/theme';
import type { Game, Player } from '../types/game';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export default function JoinGameScreen() {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const normalized = code.trim().toUpperCase();
    if (normalized.length < 10) {
      setGame(null);
      setPlayers([]);
      return;
    }

    const unsubscribeGame = subscribeToGame(normalized, setGame);
    const unsubscribePlayers = subscribeToPlayers(normalized, setPlayers);

    return () => {
      unsubscribeGame();
      unsubscribePlayers();
    };
  }, [code]);

  const handleJoin = async () => {
    if (!code.trim()) {
      Alert.alert('Campo obrigatório', 'Escreve o código do jogo.');
      return;
    }
    if (!playerName.trim()) {
      Alert.alert('Campo obrigatório', 'Escreve o teu nome.');
      return;
    }

    setJoining(true);
    try {
      await joinGame(code, playerName.trim());
      router.replace(`/game/lobby?code=${code.trim().toUpperCase()}`);
    } catch (error: any) {
      Alert.alert('Erro', error.message ?? 'Algo correu mal.');
    } finally {
      setJoining(false);
    }
  };

  const gameFound = game !== null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.header, { color: colors.text }]}>Entrar no Jogo</Text>

      <View style={styles.form}>
        <Text style={[styles.label, { color: colors.textMuted }]}>CÓDIGO DO JOGO</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: colors.surface,
            color: colors.text,
            borderColor: colors.border,
          }]}
          placeholder="G-XXX-XXXX"
          placeholderTextColor={colors.textMuted}
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          autoCapitalize="characters"
          maxLength={10}
        />

        {gameFound && game && (
          <View style={[styles.gameCard, {
            backgroundColor: colors.surface,
            borderColor: colors.primary,
          }]}>
            <Text style={[styles.gameCardLabel, { color: colors.primary }]}>
              JOGO ENCONTRADO
            </Text>
            <Text style={[styles.gameCardName, { color: colors.text }]}>
              {game.name}
            </Text>
            <View style={styles.gameCardRow}>
              <Text style={[styles.gameCardMeta, { color: colors.textSecondary }]}>
                JOGADORES:  {players.length}/{game.maxPlayers}
              </Text>
              <View style={styles.playerDots}>
                {Array.from({ length: game.maxPlayers }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.playerDot,
                      { borderColor: colors.textMuted },
                      i < players.length && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
        )}

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
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
          onPress={() => router.back()}
          disabled={joining}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>VOLTAR</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
            (joining || !gameFound) && styles.disabled,
          ]}
          onPress={handleJoin}
          disabled={joining || !gameFound}
        >
          {joining ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={[styles.primaryButtonText, { color: colors.background }]}>
              ENTRAR →
            </Text>
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
  gameCard: {
    borderRadius: 8,
    padding: Spacing.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  gameCardLabel: {
    ...Typography.caption,
    letterSpacing: 1,
  },
  gameCardName: {
    ...Typography.heading,
    fontSize: 20,
  },
  gameCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  gameCardMeta: {
    ...Typography.caption,
    letterSpacing: 1,
  },
  playerDots: {
    flexDirection: 'row',
    gap: 4,
  },
  playerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
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