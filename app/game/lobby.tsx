import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Spacing, Typography } from "../../constants/theme";
import {
  leaveGame,
  subscribeToGame,
  subscribeToPlayers,
  updateGameStatus,
} from "../../lib/gameService";
import { getPlayerId } from "../../lib/playerIdentity";
import type { Game, Player } from "../../types/game";
import { SafeAreaView } from 'react-native-safe-area-context';
import { playGameStartSound } from '../../lib/soundService';
import { useTheme } from '../../context/ThemeContext';

export default function LobbyScreen() {
  const { colors } = useTheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    getPlayerId().then(setCurrentUserId);
  }, []);

  useEffect(() => {
    if (!code) return;

    const unsubGame = subscribeToGame(code, (g) => {
      setGame(g);
      if (g?.status === 'placing') {
        router.replace(`/game/area?code=${code}`);
      }
      if (g?.status === 'playing') {
        playGameStartSound().catch(() => {});
        router.replace(`/game/play?code=${code}`);
      }
    });

    const unsubPlayers = subscribeToPlayers(code, setPlayers);

    return () => {
      unsubGame();
      unsubPlayers();
    };
  }, [code]);

  const isAdmin = game?.adminId === currentUserId;
  const canStart = players.length >= 2;

  const handleStart = async () => {
    if (!code || !canStart) return;
    setAdvancing(true);
    try {
      await updateGameStatus(code, "placing");
    } catch (error: any) {
      Alert.alert("Erro", error.message ?? "Não foi possível começar o jogo.");
      setAdvancing(false);
    }
  };

  const handleLeave = () => {
    const performLeave = async () => {
      if (code) await leaveGame(code);
      router.replace("/");
    };

    if (Platform.OS === "web") {
      if (window.confirm("Tens a certeza que queres sair do jogo?")) {
        performLeave();
      }
      return;
    }

    Alert.alert("Sair do jogo", "Tens a certeza que queres sair?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: performLeave },
    ]);
  };

  if (!code || !game) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.loading, { color: colors.textSecondary }]}>
          A carregar...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{game.name}</Text>
        <View style={[styles.codeRow, {
          backgroundColor: colors.surface,
          borderColor: colors.primary,
        }]}>
          <Text style={[styles.codeLabel, { color: colors.primary }]}>CÓDIGO</Text>
          <Text style={[styles.code, { color: colors.text }]}>{game.code}</Text>
        </View>
        <Text style={[styles.counter, { color: colors.textSecondary }]}>
          JOGADORES {players.length}/{game.maxPlayers}
        </Text>
      </View>

      <ScrollView
        style={styles.playerList}
        contentContainerStyle={styles.playerListContent}
      >
        {players.map((player) => {
          const colorHex = getPlayerColorHex(player.color);
          const isYou = player.id === currentUserId;
          return (
            <View key={player.id} style={[styles.playerRow, {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }]}>
              <View style={[styles.playerDot, { backgroundColor: colorHex }]} />
              <Text style={[styles.playerName, { color: colors.text }]}>
                {player.name}
                {isYou && (
                  <Text style={[styles.youLabel, { color: colors.textMuted }]}>
                    {' '}(tu)
                  </Text>
                )}
              </Text>
              {player.isAdmin && (
                <Text style={[styles.adminBadge, { color: colors.primary }]}>
                  ADMIN
                </Text>
              )}
            </View>
          );
        })}

        {Array.from({ length: game.maxPlayers - players.length }).map((_, i) => (
          <View key={`empty-${i}`} style={[styles.playerRowEmpty, {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }]}>
            <View style={[styles.playerDotEmpty, { borderColor: colors.textMuted }]} />
            <Text style={[styles.playerNameEmpty, { color: colors.textMuted }]}>
              À espera de jogador...
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
          onPress={handleLeave}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>SAIR</Text>
        </Pressable>

        {isAdmin ? (
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
              (!canStart || advancing) && styles.disabled,
            ]}
            onPress={handleStart}
            disabled={!canStart || advancing}
          >
            <Text style={[styles.primaryButtonText, { color: colors.background }]}>
              {canStart ? "COMEÇAR →" : "PRECISA DE 2+ JOGADORES"}
            </Text>
          </Pressable>
        ) : (
          <View style={[styles.primaryButton, { backgroundColor: colors.primary }, styles.disabled]}>
            <Text style={[styles.primaryButtonText, { color: colors.background }]}>
              À ESPERA DO ADMIN...
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function getPlayerColorHex(color: string): string {
  const map: Record<string, string> = {
    green: "#4ade80",
    orange: "#fb923c",
    blue: "#60a5fa",
    purple: "#c084fc",
    red: "#f87171",
    yellow: "#fbbf24",
    pink: "#f472b6",
    cyan: "#22d3ee",
  };
  return map[color] ?? "#71717a";
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg },
  loading: {
    ...Typography.body,
    textAlign: "center",
    marginTop: Spacing.xxl,
  },
  header: { marginBottom: Spacing.lg },
  title: { ...Typography.heading, marginBottom: Spacing.md },
  codeRow: {
    borderRadius: 8,
    padding: Spacing.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    alignItems: "center",
  },
  codeLabel: {
    ...Typography.caption,
    letterSpacing: 2,
    marginBottom: 4,
  },
  code: {
    ...Typography.heading,
    fontSize: 28,
    letterSpacing: 2,
  },
  counter: { ...Typography.caption, letterSpacing: 2 },
  playerList: { flex: 1 },
  playerListContent: { gap: Spacing.sm, paddingVertical: Spacing.sm },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderRadius: 8,
    padding: Spacing.md,
    borderWidth: 1,
  },
  playerRowEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderRadius: 8,
    padding: Spacing.md,
    borderWidth: 1,
    opacity: 0.5,
  },
  playerDot: { width: 16, height: 16, borderRadius: 8 },
  playerDotEmpty: { width: 16, height: 16, borderRadius: 8, borderWidth: 1 },
  playerName: { ...Typography.body, flex: 1 },
  playerNameEmpty: { ...Typography.body, fontStyle: "italic" },
  youLabel: { fontSize: 14 },
  adminBadge: { ...Typography.caption, letterSpacing: 1, fontWeight: "bold" },
  footer: { flexDirection: "row", gap: Spacing.sm, paddingBottom: Spacing.lg },
  primaryButton: {
    flex: 2,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { ...Typography.label, letterSpacing: 1 },
  secondaryButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  secondaryButtonText: { ...Typography.label, letterSpacing: 1 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});