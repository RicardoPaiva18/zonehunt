import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { subscribeToGame, subscribeToPlayers, joinGame } from '../lib/gameService';
import { Colors, Spacing, Typography, GameConfig } from '../constants/theme';
import type { Game, Player } from '../types/game';

export default function JoinGameScreen() {
  const [code, setCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) {
      signInAnonymously(auth).catch(console.error);
    }
  }, []);

  // Quando o código tiver o comprimento certo, começa a espreitar o jogo em tempo real
  useEffect(() => {
    const normalized = code.trim().toUpperCase();
    // Esperar código completo tipo G-XXX-XXXX (10 caracteres)
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
    <View style={styles.container}>
      <Text style={styles.header}>Entrar no Jogo</Text>

      <View style={styles.form}>
        <Text style={styles.label}>CÓDIGO DO JOGO</Text>
        <TextInput
          style={styles.input}
          placeholder="G-XXX-XXXX"
          placeholderTextColor={Colors.textMuted}
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          autoCapitalize="characters"
          maxLength={10}
        />

        {gameFound && game && (
          <View style={styles.gameCard}>
            <Text style={styles.gameCardLabel}>JOGO ENCONTRADO</Text>
            <Text style={styles.gameCardName}>{game.name}</Text>
            <View style={styles.gameCardRow}>
              <Text style={styles.gameCardMeta}>JOGADORES:  {players.length}/{game.maxPlayers}</Text>
              <View style={styles.playerDots}>
                {Array.from({ length: game.maxPlayers }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.playerDot,
                      i < players.length && styles.playerDotFilled,
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
        )}

        <Text style={styles.label}>O TEU NOME</Text>
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={Colors.textMuted}
          value={playerName}
          onChangeText={setPlayerName}
          maxLength={20}
        />
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={() => router.back()}
          disabled={joining}
        >
          <Text style={styles.secondaryButtonText}>VOLTAR</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
            (joining || !gameFound) && styles.disabled,
          ]}
          onPress={handleJoin}
          disabled={joining || !gameFound}
        >
          {joining ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={styles.primaryButtonText}>ENTRAR →</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  header: {
    ...Typography.heading,
    color: Colors.text,
    marginBottom: Spacing.xl,
  },
  form: {
    flex: 1,
    gap: Spacing.md,
  },
  label: {
    ...Typography.caption,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginTop: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  gameCard: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  gameCardLabel: {
    ...Typography.caption,
    color: Colors.primary,
    letterSpacing: 1,
  },
  gameCardName: {
    ...Typography.heading,
    color: Colors.text,
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
    color: Colors.textSecondary,
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
    borderColor: Colors.textMuted,
  },
  playerDotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...Typography.label,
    color: Colors.background,
    letterSpacing: 1,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    ...Typography.label,
    color: Colors.text,
    letterSpacing: 1,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});