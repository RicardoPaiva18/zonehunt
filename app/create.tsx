import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { createGame } from '../lib/gameService';
import { Colors, Spacing, Typography, GameConfig } from '../constants/theme';

export default function CreateGameScreen() {
  const [gameName, setGameName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [gameCode, setGameCode] = useState('');
  const [creating, setCreating] = useState(false);

  // Garantir que o utilizador está autenticado ao abrir o ecrã
  useEffect(() => {
    if (!auth.currentUser) {
      signInAnonymously(auth).catch((err) => {
        console.error('Erro a autenticar:', err);
      });
    }
  }, []);

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
    <View style={styles.container}>
      <Text style={styles.header}>Criar Jogo</Text>

      <View style={styles.form}>
        <Text style={styles.label}>NOME DO JOGO</Text>
        <TextInput
          style={styles.input}
          placeholder="ex: Jogo 1"
          placeholderTextColor={Colors.textMuted}
          value={gameName}
          onChangeText={setGameName}
          maxLength={30}
        />

        <Text style={styles.label}>O TEU NOME</Text>
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={Colors.textMuted}
          value={playerName}
          onChangeText={setPlayerName}
          maxLength={20}
        />

        <Text style={styles.label}>Nº DE JOGADORES</Text>
        <View style={styles.playerCount}>
          {Array.from({ length: GameConfig.MAX_PLAYERS }, (_, i) => i + 1).map((n) => (
            <Pressable
              key={n}
              onPress={() => setMaxPlayers(n)}
              style={[
                styles.playerDot,
                maxPlayers >= n && styles.playerDotFilled,
              ]}
            />
          ))}
          <Text style={styles.playerCountLabel}>{maxPlayers}/{GameConfig.MAX_PLAYERS}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={() => router.back()}
          disabled={creating}
        >
          <Text style={styles.secondaryButtonText}>VOLTAR</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
            creating && styles.disabled,
          ]}
          onPress={handleCreate}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={styles.primaryButtonText}>CRIAR →</Text>
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
    borderColor: Colors.textMuted,
  },
  playerDotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  playerCountLabel: {
    ...Typography.label,
    color: Colors.text,
    marginLeft: Spacing.md,
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
