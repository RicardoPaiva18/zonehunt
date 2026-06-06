import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Spacing, Typography } from "../../constants/theme";
import { useTheme } from "../../context/ThemeContext";
import { logEvent } from "../../lib/analyticsService";
import {
  subscribeToAllDolls,
  subscribeToGame,
  subscribeToPlayers,
} from "../../lib/gameService";
import { getPlayerId } from "../../lib/playerIdentity";
import { playVictorySound } from "../../lib/soundService";
import type { Doll, Game, Player } from "../../types/game";

export default function FinishScreen() {
  const { colors } = useTheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [allDolls, setAllDolls] = useState<Doll[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    getPlayerId().then(setCurrentUserId);
  }, []);

  useEffect(() => {
    if (!code) return;
    const unsubGame = subscribeToGame(code, setGame);
    const unsubPlayers = subscribeToPlayers(code, setPlayers);
    const unsubAllDolls = subscribeToAllDolls(code, setAllDolls);
    return () => {
      unsubGame();
      unsubPlayers();
      unsubAllDolls();
    };
  }, [code]);

  useEffect(() => {
    if (!currentUserId || !game?.winnerId) return;
    if (Platform.OS === "web") return;

    if (code && game.startedAt && game.finishedAt) {
      logEvent(code, "game_finished", {
        duration: game.finishedAt - game.startedAt,
        isWinner: game.winnerId === currentUserId,
      }).catch(() => {});
    }

    if (game.winnerId === currentUserId) {
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 0);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 300);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 600);
      playVictorySound().catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, [currentUserId, game?.winnerId]);

  if (!game || !currentUserId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  const iWon = game.winnerId === currentUserId;
  const winner = players.find((p) => p.id === game.winnerId);

  const scores = players
    .map((p) => ({
      player: p,
      captured: allDolls.filter((d) => d.capturedBy === p.id).length,
      isMe: p.id === currentUserId,
      isWinner: p.id === game.winnerId,
    }))
    .sort((a, b) => {
      if (a.isWinner) return -1;
      if (b.isWinner) return 1;
      return b.captured - a.captured;
    });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={styles.trophy}>{iWon ? "🏆" : "🎮"}</Text>
        <Text style={[styles.title, { color: colors.primary }]}>
          {iWon ? "PARABÉNS!" : "FIM DO JOGO"}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {iWon
            ? "Capturaste todos os bonecos adversários!"
            : `${winner?.name ?? "Alguém"} ganhou o jogo.`}
        </Text>
      </View>

      <View style={[styles.podium, {
        backgroundColor: colors.surface,
        borderColor: colors.border,
      }]}>
        <Text style={[styles.podiumTitle, { color: colors.textSecondary }]}>
          CLASSIFICAÇÃO
        </Text>
        {scores.map((entry, index) => (
          <View
            key={entry.player.id}
            style={[
              styles.podiumRow,
              entry.isWinner && [styles.podiumRowWinner, { borderColor: colors.primary }],
              entry.isMe && !entry.isWinner && { backgroundColor: "rgba(128,128,128,0.08)" },
            ]}
          >
            <Text style={styles.podiumPosition}>
              {entry.isWinner ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}º`}
            </Text>
            <View style={[styles.colorDot, { backgroundColor: getPlayerColorHex(entry.player.color) }]} />
            <Text style={[
              styles.podiumName,
              { color: colors.text },
              entry.isMe && { color: colors.primary, fontWeight: "bold" },
            ]}>
              {entry.isMe ? `${entry.player.name} (tu)` : entry.player.name}
            </Text>
            <Text style={[styles.podiumScore, { color: colors.textSecondary }]}>
              {entry.captured} boneco{entry.captured !== 1 ? "s" : ""}
            </Text>
          </View>
        ))}
      </View>

      {game.startedAt && game.finishedAt && (
        <Text style={[styles.duration, { color: colors.textSecondary }]}>
          Duração: {formatDuration(game.finishedAt - game.startedAt)}
        </Text>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.primary },
          pressed && styles.pressed,
        ]}
        onPress={() => router.dismissAll()}
      >
        <Text style={[styles.buttonText, { color: colors.background }]}>
          VOLTAR AO MENU
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
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
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  header: { alignItems: "center", gap: Spacing.sm },
  trophy: { fontSize: 64 },
  title: { ...Typography.heading, fontSize: 28, letterSpacing: 2 },
  subtitle: { ...Typography.body, textAlign: "center" },
  podium: {
    width: "100%",
    borderRadius: 12,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
  },
  podiumTitle: {
    ...Typography.caption,
    letterSpacing: 2,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  podiumRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
  },
  podiumRowWinner: {
    backgroundColor: "rgba(74, 222, 128, 0.15)",
    borderWidth: 1,
  },
  podiumPosition: { fontSize: 20, width: 32, textAlign: "center" },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  podiumName: { ...Typography.body, flex: 1 },
  podiumScore: { ...Typography.caption, letterSpacing: 1 },
  duration: { ...Typography.caption, letterSpacing: 1 },
  button: {
    width: "100%",
    paddingVertical: Spacing.md,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: { ...Typography.label, letterSpacing: 1 },
  pressed: { opacity: 0.7 },
});