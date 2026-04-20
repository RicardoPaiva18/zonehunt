import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { auth } from '../../lib/firebase';
import {
  subscribeToGame,
  subscribeToPlayers,
  updateGameStatus,
  leaveGame,
} from '../../lib/gameService';
import { Colors, Spacing, Typography } from '../../constants/theme';
import type { Game, Player } from '../../types/game';

export default function LobbyScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [advancing, setAdvancing] = useState(false);

  // Subscrever ao jogo e jogadores em tempo real
  useEffect(() => {
    if (!code) return;

    const unsubGame = subscribeToGame(code, (g) => {
      setGame(g);
      // Se o jogo deixou de estar em 'waiting', avançar para o próximo ecrã
      if (g && g.status === 'placing') {
        router.replace(`/game/area?code=${code}`);
      }
    });
    const unsubPlayers = subscribeToPlayers(code, setPlayers);

    return () => {
      unsubGame();
      unsubPlayers();
    };
  }, [code]);

  const currentUserId = auth.currentUser?.uid;
  const isAdmin = game?.adminId === currentUserId;
  const canStart = players.length >= 2; // mínimo 2 jogadores

  const handleStart = async () => {
    if (!code || !canStart) return;
    setAdvancing(true);
    try {
      await updateGameStatus(code, 'placing');
      // A subscrição vai automaticamente redirecionar para /game/area
    } catch (error: any) {
      Alert.alert('Erro', error.message ?? 'Não foi possível começar o jogo.');
      setAdvancing(false);
    }
  };

  const handleLeave = () => {
    Alert.alert(
      'Sair do jogo',
      'Tens a certeza que queres sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            if (code) {
              await leaveGame(code);
            }
            router.replace('/');
          },
        },
      ],
    );
  };

  // Estados de carregamento
  if (!code || !game) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>A carregar...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{game.name}</Text>
        <View style={styles.codeRow}>
          <Text style={styles.codeLabel}>CÓDIGO</Text>
          <Text style={styles.code}>{game.code}</Text>
        </View>
        <Text style={styles.counter}>
          JOGADORES  {players.length}/{game.maxPlayers}
        </Text>
      </View>

      <ScrollView style={styles.playerList} contentContainerStyle={styles.playerListContent}>
        {players.map((player) => {
          const colorHex = getPlayerColorHex(player.color);
          const isYou = player.id === currentUserId;
          return (
            <View key={player.id} style={styles.playerRow}>
              <View style={[styles.playerDot, { backgroundColor: colorHex }]} />
              <Text style={styles.playerName}>
                {player.name}
                {isYou && <Text style={styles.youLabel}>  (tu)</Text>}
              </Text>
              {player.isAdmin && (
                <Text style={styles.adminBadge}>ADMIN</Text>
              )}
            </View>
          );
        })}

        {Array.from({ length: game.maxPlayers - players.length }).map((_, i) => (
          <View key={`empty-${i}`} style={styles.playerRowEmpty}>
            <View style={styles.playerDotEmpty} />
            <Text style={styles.playerNameEmpty}>À espera de jogador...</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={handleLeave}
        >
          <Text style={styles.secondaryButtonText}>SAIR</Text>
        </Pressable>

        {isAdmin ? (
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
              (!canStart || advancing) && styles.disabled,
            ]}
            onPress={handleStart}
            disabled={!canStart || advancing}
          >
            <Text style={styles.primaryButtonText}>
              {canStart ? 'COMEÇAR →' : 'PRECISA DE 2+ JOGADORES'}
            </Text>
          </Pressable>
        ) : (
          <View style={[styles.primaryButton, styles.disabled]}>
            <Text style={styles.primaryButtonText}>À ESPERA DO ADMIN...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function getPlayerColorHex(color: string): string {
  const colors: Record<string, string> = {
    green: '#4ade80',
    orange: '#fb923c',
    blue: '#60a5fa',
    purple: '#c084fc',
    red: '#f87171',
    yellow: '#fbbf24',
    pink: '#f472b6',
    cyan: '#22d3ee',
  };
  return colors[color] ?? '#71717a';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  loading: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.heading,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  codeRow: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  codeLabel: {
    ...Typography.caption,
    color: Colors.primary,
    letterSpacing: 2,
    marginBottom: 4,
  },
  code: {
    ...Typography.heading,
    color: Colors.text,
    fontSize: 28,
    letterSpacing: 2,
  },
  counter: {
    ...Typography.caption,
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  playerList: {
    flex: 1,
  },
  playerListContent: {
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerRowEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    opacity: 0.5,
  },
  playerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  playerDotEmpty: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.textMuted,
  },
  playerName: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
  },
  playerNameEmpty: {
    ...Typography.body,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  youLabel: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  adminBadge: {
    ...Typography.caption,
    color: Colors.primary,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  primaryButton: {
    flex: 2,
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