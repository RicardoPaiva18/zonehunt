import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { playProximitySound, playDetectionSound } from '../../lib/soundService';
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Circle,
  MapView,
  Marker,
  PROVIDER_GOOGLE,
  Polygon,
} from "../../components/PlatformMap";
import { Spacing, Typography, GameConfig } from '../../constants/theme';
import {
  computeDetectionRadius,
  distanceBetween,
  leaveGame,
  subscribeToAllDolls,
  subscribeToGame,
  subscribeToMyDolls,
  subscribeToPlayers,
  updatePlayerLocation,
} from "../../lib/gameService";
import { getPlayerId } from "../../lib/playerIdentity";
import type { Doll, Game, Player } from "../../types/game";
import { useTheme } from "../../context/ThemeContext";
import { logEvent } from '../../lib/analyticsService';

type LocationCoords = {
  latitude: number;
  longitude: number;
};

export default function PlayScreen() {
  const { colors, mapStyle } = useTheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [allDolls, setAllDolls] = useState<Doll[]>([]);
  const [myDolls, setMyDolls] = useState<Doll[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myLocation, setMyLocation] = useState<LocationCoords | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [nearestDoll, setNearestDoll] = useState<{ doll: Doll; distance: number } | null>(null);
  const [detectionRadius, setDetectionRadius] = useState(15);
  const lastHapticRef = useRef<number>(0);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    getPlayerId().then(setCurrentUserId);
  }, []);

  useEffect(() => {
    if (!code) return;
    const unsubGame = subscribeToGame(code, setGame);
    const unsubPlayers = subscribeToPlayers(code, setPlayers);
    const unsubAllDolls = subscribeToAllDolls(code, setAllDolls);

    let unsubMyDolls: (() => void) | null = null;
    subscribeToMyDolls(code, setMyDolls).then((fn) => { unsubMyDolls = fn; });

    return () => {
      unsubGame();
      unsubPlayers();
      unsubAllDolls();
      unsubMyDolls?.();
    };
  }, [code]);

  useEffect(() => {
    if (game?.area && game.area.length >= 3) {
      setDetectionRadius(computeDetectionRadius(game.area));
    }
  }, [game?.area]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') return;
      let watcher: Location.LocationSubscription | null = null;

      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setPermissionDenied(true);
          return;
        }

        const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setMyLocation({ latitude: initial.coords.latitude, longitude: initial.coords.longitude });

        watcher = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1, timeInterval: 2000 },
          (pos) => {
            const newCoords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setMyLocation(newCoords);
            if (code) updatePlayerLocation(code, newCoords).catch(console.error);
          },
        );
      })();

      return () => { watcher?.remove(); };
    }, [code])
  );

  const opponentsInRange = allDolls.filter((d) => {
    if (d.ownerId === currentUserId) return false;
    if (d.capturedBy) return false;
    if (!myLocation) return false;
    return distanceBetween(myLocation, d.location) <= detectionRadius;
  });

  const hasOpponentsInRange = opponentsInRange.length > 0;

  useEffect(() => {
    if (!myLocation || !currentUserId || opponentsInRange.length === 0) {
      setNearestDoll(null);
      return;
    }

    let nearest: { doll: Doll; distance: number } | null = null;
    for (const doll of opponentsInRange) {
      const d = distanceBetween(myLocation, doll.location);
      if (!nearest || d < nearest.distance) nearest = { doll, distance: d };
    }
    setNearestDoll(nearest);

    if (!nearest) return;
    const now = Date.now();
    const cooldown = 2000;

    if (nearest.distance <= GameConfig.CAPTURE_RADIUS_METERS) {
      if (now - lastHapticRef.current > cooldown) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        playDetectionSound().catch(() => {});
        logEvent(code!, 'doll_detected', { distance: Math.round(nearest.distance) }).catch(() => {});
        lastHapticRef.current = now;
      }
    } else if (nearest.distance <= GameConfig.PROXIMITY_ALERT_METERS) {
      if (now - lastHapticRef.current > cooldown) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        playProximitySound().catch(() => {});
        lastHapticRef.current = now;
      }
    }
  }, [myLocation, opponentsInRange, currentUserId]);

  const confirmLeave = () => {
    const performLeave = async () => {
      if (code) await leaveGame(code);
      router.replace("/");
    };
    if (Platform.OS === "web") {
      if (window.confirm("Tens a certeza que queres sair?")) performLeave();
      return;
    }
    Alert.alert("Sair do jogo", "Tens a certeza?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: performLeave },
    ]);
  };

  const handleDollTap = (doll: Doll) => {
    if (!myLocation) return;
    const distance = distanceBetween(myLocation, doll.location);
    if (distance > GameConfig.CAPTURE_RADIUS_METERS) {
      logEvent(code!, 'capture_too_far', { distance: Math.round(distance) }).catch(() => {});
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
      Alert.alert(
        "Demasiado longe",
        `Estás a ${Math.round(distance)}m. Aproxima-te até menos de ${GameConfig.CAPTURE_RADIUS_METERS}m para capturar.`,
      );
      return;
    }
    logEvent(code!, 'capture_attempted', { distance: Math.round(distance) }).catch(() => {});
    router.push(`/game/camera?code=${code}&dollId=${doll.id}`);
  };

  // Loading states
  if (!code || !game) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>A carregar jogo...</Text>
      </View>
    );
  }
  if (permissionDenied) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.error }]}>Sem permissão de localização</Text>
        <Pressable style={[styles.errorButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={confirmLeave}>
          <Text style={[styles.errorButtonText, { color: colors.text }]}>SAIR</Text>
        </Pressable>
      </View>
    );
  }
  if (Platform.OS === "web") {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.error }]}>Modo Demo (Web)</Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
          O ecrã de jogo precisa de GPS real. Acompanha o jogo a partir do telemóvel.
        </Text>
        <Pressable style={[styles.errorButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={confirmLeave}>
          <Text style={[styles.errorButtonText, { color: colors.text }]}>SAIR</Text>
        </Pressable>
      </View>
    );
  }
  if (!myLocation) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>A obter localização...</Text>
      </View>
    );
  }

  const me = players.find((p) => p.id === currentUserId);
  const myColor = me ? getPlayerColorHex(me.color) : colors.primary;
  const canCapture = !!(nearestDoll && nearestDoll.distance <= GameConfig.CAPTURE_RADIUS_METERS);
  const isClose = !!(nearestDoll && nearestDoll.distance <= GameConfig.PROXIMITY_ALERT_METERS);

  const circleColor = hasOpponentsInRange ? "rgba(251, 146, 60, 0.8)" : "rgba(74, 222, 128, 0.4)";
  const circleFillColor = hasOpponentsInRange ? "rgba(251, 146, 60, 0.15)" : "rgba(74, 222, 128, 0.05)";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>A jogar</Text>
        <Text style={[styles.counter, { color: colors.primary }]}>
          {me?.capturedColors?.length ?? 0}/{Math.max(0, players.length - 1)}
        </Text>
      </View>

      <View style={[
        styles.proximityBar,
        { backgroundColor: colors.surface },
        canCapture && styles.proximityBarClose,
        !canCapture && isClose && styles.proximityBarNear,
      ]}>
        <Text style={[styles.proximityText, { color: colors.text }]}>
          {nearestDoll
            ? canCapture
              ? `A ${Math.round(nearestDoll.distance)}m — PRONTO A CAPTURAR`
              : isClose
                ? `A ${Math.round(nearestDoll.distance)}m — Boneco adversário perto`
                : `Boneco adversário detetado a ${Math.round(nearestDoll.distance)}m`
            : `Procura por bonecos — raio: ${Math.round(detectionRadius)}m`}
        </Text>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: myLocation.latitude,
          longitude: myLocation.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={mapStyle}
      >
        {game.area && game.area.length >= 3 && (
          <Polygon
            coordinates={game.area}
            strokeColor={colors.primary}
            strokeWidth={2}
            fillColor="rgba(74, 222, 128, 0.05)"
          />
        )}

        <Circle
          center={myLocation}
          radius={detectionRadius}
          strokeColor={circleColor}
          strokeWidth={hasOpponentsInRange ? 3 : 1.5}
          fillColor={circleFillColor}
        />

        {myDolls.map((d) => (
          <Marker key={d.id} coordinate={d.location} pinColor={myColor} title="Teu boneco" />
        ))}

        {opponentsInRange.map((d) => (
          <Marker
            key={d.id}
            coordinate={d.location}
            pinColor={getPlayerColorHex(d.ownerColor)}
            title="Boneco adversário"
            onPress={() => handleDollTap(d)}
          />
        ))}

        {players
          .filter((p) => p.location && p.id !== currentUserId)
          .map((p) => (
            <Marker key={p.id} coordinate={p.location!} title={p.name} pinColor={getPlayerColorHex(p.color)} />
          ))}
      </MapView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
          onPress={confirmLeave}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>SAIR</Text>
        </Pressable>

        <View style={[
          styles.hintBox,
          { backgroundColor: colors.surface, borderColor: colors.border },
          canCapture && styles.hintBoxReady,
        ]}>
          <Text style={[styles.hintText, { color: colors.text }]}>
            {canCapture
              ? "✦ TOCA NO BONECO PARA CAPTURAR"
              : nearestDoll
                ? "APROXIMA-TE DO BONECO"
                : "PROCURA POR BONECOS"}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function getPlayerColorHex(color: string): string {
  const map: Record<string, string> = {
    green: "#4ade80", orange: "#fb923c", blue: "#60a5fa", purple: "#c084fc",
    red: "#f87171", yellow: "#fbbf24", pink: "#f472b6", cyan: "#22d3ee",
  };
  return map[color] ?? "#71717a";
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1, justifyContent: "center", alignItems: "center",
    padding: Spacing.lg, gap: Spacing.md,
  },
  loadingText: { ...Typography.body, marginTop: Spacing.md },
  errorTitle: { ...Typography.heading, textAlign: "center" },
  errorMessage: { ...Typography.body, textAlign: "center" },
  errorButton: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderRadius: 8, borderWidth: 1, marginTop: Spacing.lg,
  },
  errorButtonText: { ...Typography.label, letterSpacing: 1 },
  header: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", padding: Spacing.lg, paddingBottom: 0,
  },
  title: { ...Typography.heading },
  counter: { ...Typography.heading, fontSize: 18 },
  proximityBar: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  proximityBarNear: { backgroundColor: "rgba(245, 158, 11, 0.2)" },
  proximityBarClose: { backgroundColor: "rgba(74, 222, 128, 0.3)" },
  proximityText: { ...Typography.caption, textAlign: "center", letterSpacing: 1 },
  map: { flex: 1 },
  footer: { flexDirection: "row", gap: Spacing.sm, padding: Spacing.lg },
  hintBox: {
    flex: 2, paddingVertical: Spacing.md, borderRadius: 8,
    alignItems: "center", justifyContent: "center", borderWidth: 1,
  },
  hintBoxReady: { backgroundColor: "rgba(74, 222, 128, 0.2)", borderColor: "#4ade80" },
  hintText: { ...Typography.label, letterSpacing: 1, textAlign: "center" },
  secondaryButton: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: 8,
    alignItems: "center", justifyContent: "center", borderWidth: 1,
  },
  secondaryButtonText: { ...Typography.label, letterSpacing: 1 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});