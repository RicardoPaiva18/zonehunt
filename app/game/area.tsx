import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
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
  MapView,
  Marker,
  PROVIDER_GOOGLE,
  Polygon,
} from "../../components/PlatformMap";
import * as Location from "expo-location";
import { Spacing, Typography } from "../../constants/theme";
import {
  confirmGameArea,
  leaveGame,
  subscribeToGame,
  subscribeToPlayers,
  updateGameArea,
  updatePlayerLocation,
} from "../../lib/gameService";
import { getPlayerId } from "../../lib/playerIdentity";
import type { Game, Player } from "../../types/game";
import { useTheme } from "../../context/ThemeContext";

const MIN_AREA_POINTS = 3;
const MAX_AREA_POINTS = 8;

type LocationCoords = {
  latitude: number;
  longitude: number;
};

export default function AreaScreen() {
  const { colors, mapStyle } = useTheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myLocation, setMyLocation] = useState<LocationCoords | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [draftArea, setDraftArea] = useState<LocationCoords[]>([]);
  const [saving, setSaving] = useState(false);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    getPlayerId().then(setCurrentUserId);
  }, []);

  useEffect(() => {
    if (!code) return;
    const unsubGame = subscribeToGame(code, (g) => {
      setGame(g);
      if (g?.areaConfirmed && code) {
        router.replace(`/game/place?code=${code}`);
      }
    });
    const unsubPlayers = subscribeToPlayers(code, setPlayers);
    return () => {
      unsubGame();
      unsubPlayers();
    };
  }, [code]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let watcher: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setPermissionDenied(true);
        return;
      }

      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coords = {
        latitude: initial.coords.latitude,
        longitude: initial.coords.longitude,
      };
      setMyLocation(coords);
      mapRef.current?.animateToRegion(
        { ...coords, latitudeDelta: 0.005, longitudeDelta: 0.005 },
        1000,
      );

      watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 2, timeInterval: 3000 },
        (pos) => {
          const newCoords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          setMyLocation(newCoords);
          if (code) updatePlayerLocation(code, newCoords).catch(console.error);
        },
      );
    })();

    return () => { watcher?.remove(); };
  }, [code]);

  const isAdmin = game?.adminId === currentUserId;
  const areaDefined = !!game?.areaConfirmed;
  const polygonToShow = isAdmin && !areaDefined ? draftArea : (game?.area ?? []);

  const handleMapPress = (event: any) => {
    if (!isAdmin || areaDefined) return;
    if (draftArea.length >= MAX_AREA_POINTS) return;
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const newArea = [...draftArea, { latitude, longitude }];
    setDraftArea(newArea);
    if (code) updateGameArea(code, newArea).catch(console.error);
  };

  const handleUndo = () => {
    if (draftArea.length === 0) return;
    const newArea = draftArea.slice(0, -1);
    setDraftArea(newArea);
    if (code) updateGameArea(code, newArea.length > 0 ? newArea : null).catch(console.error);
  };

  const handleClear = () => {
    setDraftArea([]);
    if (code) updateGameArea(code, null).catch(console.error);
  };

  const handleConfirmArea = async () => {
    if (draftArea.length < MIN_AREA_POINTS || !code) return;
    setSaving(true);
    try {
      await confirmGameArea(code);
    } catch (error: any) {
      Alert.alert("Erro", error.message ?? "Não foi possível confirmar a área.");
      setSaving(false);
    }
  };

  const confirmLeave = () => {
    const performLeave = async () => {
      if (code) await leaveGame(code);
      router.replace("/");
    };
    if (Platform.OS === "web") {
      if (window.confirm("Tens a certeza que queres sair do jogo?")) performLeave();
      return;
    }
    Alert.alert("Sair do jogo", "Tens a certeza que queres sair?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: performLeave },
    ]);
  };

  if (!code || !game) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          A carregar jogo...
        </Text>
      </View>
    );
  }

  if (permissionDenied) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.error }]}>
          Sem permissão de localização
        </Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
          O ZoneHunt precisa da tua localização para funcionar.
        </Text>
        <Pressable style={[styles.errorButton, {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }]} onPress={confirmLeave}>
          <Text style={[styles.errorButtonText, { color: colors.text }]}>SAIR DO JOGO</Text>
        </Pressable>
      </View>
    );
  }

  if (Platform.OS === "web") {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.error }]}>
          Mapa não disponível em web
        </Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
          Esta fase do jogo requer GPS e mapa nativo.
        </Text>
        <Pressable style={[styles.errorButton, {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }]} onPress={confirmLeave}>
          <Text style={[styles.errorButtonText, { color: colors.text }]}>SAIR DO JOGO</Text>
        </Pressable>
      </View>
    );
  }

  if (!myLocation) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          A obter localização...
        </Text>
      </View>
    );
  }

  let instruction = "";
  if (isAdmin) {
    if (draftArea.length === 0) {
      instruction = "TOCA NO MAPA PARA DEFINIR OS VÉRTICES DA ÁREA";
    } else if (draftArea.length < MIN_AREA_POINTS) {
      instruction = `PRECISAS DE PELO MENOS ${MIN_AREA_POINTS} PONTOS  (${draftArea.length}/${MIN_AREA_POINTS})`;
    } else if (draftArea.length < MAX_AREA_POINTS) {
      instruction = `${draftArea.length} PONTOS — CONFIRMA OU ADICIONA MAIS`;
    } else {
      instruction = `MÁXIMO DE ${MAX_AREA_POINTS} PONTOS ATINGIDO`;
    }
  } else {
    instruction = "À ESPERA QUE O ADMIN DEFINA A ÁREA";
  }

  const canConfirm = isAdmin && draftArea.length >= MIN_AREA_POINTS;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Definir Área</Text>
        {isAdmin && (
          <Text style={[styles.adminBadge, { color: colors.primary }]}>ADMIN</Text>
        )}
      </View>

      <View style={styles.instructionBar}>
        <Text style={[styles.instructionText, { color: colors.primary }]}>
          {instruction}
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
        onPress={handleMapPress}
      >
        {players
          .filter((p) => p.location && p.id !== currentUserId)
          .map((p) => (
            <Marker
              key={p.id}
              coordinate={p.location!}
              title={p.name}
              pinColor={getPlayerColorHex(p.color)}
            />
          ))}

        {polygonToShow.map((point, index) => (
          <Marker
            key={`v-${index}`}
            coordinate={point}
            pinColor={colors.primary}
            title={`Vértice ${index + 1}`}
          />
        ))}

        {polygonToShow.length >= MIN_AREA_POINTS && (
          <Polygon
            coordinates={polygonToShow}
            strokeColor={colors.primary}
            strokeWidth={2}
            fillColor="rgba(74, 222, 128, 0.2)"
          />
        )}
      </MapView>

      <View style={styles.footer}>
        {isAdmin && !areaDefined && (
          <View style={styles.adminButtons}>
            <Pressable
              style={({ pressed }) => [
                styles.smallButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
                draftArea.length === 0 && styles.disabled,
              ]}
              onPress={handleUndo}
              disabled={draftArea.length === 0}
            >
              <Text style={[styles.smallButtonText, { color: colors.text }]}>
                ← DESFAZER
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.smallButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
                draftArea.length === 0 && styles.disabled,
              ]}
              onPress={handleClear}
              disabled={draftArea.length === 0}
            >
              <Text style={[styles.smallButtonText, { color: colors.text }]}>
                ✕ LIMPAR
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.mainButtons}>
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

          {isAdmin ? (
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
                (!canConfirm || saving) && styles.disabled,
              ]}
              onPress={handleConfirmArea}
              disabled={!canConfirm || saving}
            >
              <Text style={[styles.primaryButtonText, { color: colors.background }]}>
                {canConfirm ? "CONFIRMAR ÁREA →" : "DEFINE ÁREA PRIMEIRO"}
              </Text>
            </Pressable>
          ) : (
            <View style={[styles.primaryButton, { backgroundColor: colors.primary }, styles.disabled]}>
              <Text style={[styles.primaryButtonText, { color: colors.background }]}>
                AGUARDAR ADMIN...
              </Text>
            </View>
          )}
        </View>
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
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  loadingText: { ...Typography.body, marginTop: Spacing.md },
  errorTitle: { ...Typography.heading, textAlign: "center" },
  errorMessage: { ...Typography.body, textAlign: "center" },
  errorButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
  errorButtonText: { ...Typography.label, letterSpacing: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    paddingBottom: 0,
  },
  title: { ...Typography.heading },
  adminBadge: { ...Typography.caption, letterSpacing: 1, fontWeight: "bold" },
  instructionBar: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  instructionText: { ...Typography.caption, letterSpacing: 1, textAlign: "center" },
  map: { flex: 1 },
  footer: { padding: Spacing.lg, gap: Spacing.sm },
  adminButtons: { flexDirection: "row", gap: Spacing.sm },
  smallButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  smallButtonText: { ...Typography.caption, letterSpacing: 1 },
  mainButtons: { flexDirection: "row", gap: Spacing.sm },
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