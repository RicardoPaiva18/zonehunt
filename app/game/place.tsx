import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, Platform, ToastAndroid } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapView, Marker, PROVIDER_GOOGLE, Polygon } from '../../components/PlatformMap';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import {
  subscribeToGame,
  subscribeToPlayers,
  subscribeToMyDolls,
  leaveGame,
  updatePlayerLocation,
  placeDoll,
  undoLastDoll,
  isPointInPolygon,
  updateGameStatus,
  randomPointInPolygon,
} from '../../lib/gameService';
import { getPlayerId } from '../../lib/playerIdentity';
import { Spacing, Typography } from '../../constants/theme';
import type { Game, Player, Doll } from '../../types/game';
import { useTheme } from '../../context/ThemeContext';
import { logEvent } from '../../lib/analyticsService';

type LocationCoords = {
  latitude: number;
  longitude: number;
};

export default function PlaceDollsScreen() {
  const { colors, mapStyle } = useTheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myDolls, setMyDolls] = useState<Doll[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myLocation, setMyLocation] = useState<LocationCoords | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const mapRef = useRef<any>(null);
  const autoPlacedRef = useRef(false);

  useEffect(() => {
    getPlayerId().then(setCurrentUserId);
  }, []);

  useEffect(() => {
    if (!code) return;
    const unsubGame = subscribeToGame(code, (g) => {
      setGame(g);
      if (g?.status === 'playing' && code) {
        router.replace(`/game/play?code=${code}`);
      }
    });
    const unsubPlayers = subscribeToPlayers(code, setPlayers);

    let unsubDolls: (() => void) | null = null;
    subscribeToMyDolls(code, setMyDolls).then((fn) => { unsubDolls = fn; });

    return () => {
      unsubGame();
      unsubPlayers();
      unsubDolls?.();
    };
  }, [code]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let watcher: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        return;
      }

      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: initial.coords.latitude, longitude: initial.coords.longitude };
      setMyLocation(coords);

      if (game?.area && game.area.length > 0) {
        const center = centerOfPolygon(game.area);
        mapRef.current?.animateToRegion({ ...center, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 1000);
      } else {
        mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 1000);
      }

      watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 2, timeInterval: 3000 },
        (pos) => {
          const newCoords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setMyLocation(newCoords);
          if (code) updatePlayerLocation(code, newCoords).catch(console.error);
        }
      );
    })();

    return () => { watcher?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!code || !game || !currentUserId) return;
    if (!game.area || game.area.length < 3) return;
    if (autoPlacedRef.current) return;
    if (myDolls.length >= game.dollsPerPlayer) return;

    autoPlacedRef.current = true;

    (async () => {
      const remaining = game.dollsPerPlayer - myDolls.length;
      for (let i = 0; i < remaining; i++) {
        const point = randomPointInPolygon(game.area!);
        if (!point) continue;
        try {
          await placeDoll(code, point);
          await new Promise((r) => setTimeout(r, 200));
        } catch (e) {
          console.error('Erro a colocar boneco automaticamente:', e);
        }
      }
    })();
  }, [code, game, currentUserId, myDolls.length]);

  const showFeedback = (message: string) => {
    setFeedback(message);
    if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleMapPress = async (event: any) => {
    if (!code || !game) return;
    const totalDolls = game.dollsPerPlayer;
    if (myDolls.length >= totalDolls) {
      showFeedback('Já colocaste todos os bonecos');
      return;
    }
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const point = { latitude, longitude };
    if (!game.area || !isPointInPolygon(point, game.area)) {
      showFeedback('Fora da área de jogo');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    try {
      await placeDoll(code, point);
      logEvent(code, 'doll_placed').catch(() => {});
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error: any) {
      Alert.alert('Erro', error.message ?? 'Não foi possível colocar o boneco.');
    }
  };

  const handleUndo = async () => {
    if (!code || myDolls.length === 0) return;
    try {
      await undoLastDoll(code);
    } catch (error: any) {
      Alert.alert('Erro', error.message ?? 'Não foi possível desfazer.');
    }
  };

  const confirmLeave = () => {
    const performLeave = async () => {
      if (code) await leaveGame(code);
      router.replace('/');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Tens a certeza que queres sair do jogo?')) performLeave();
      return;
    }
    Alert.alert('Sair do jogo', 'Tens a certeza que queres sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: performLeave },
    ]);
  };

  const isAdmin = () => game?.adminId === currentUserId;
  const allPlayersReady =
    players.length >= 2 &&
    players.every((p) => (p.dollsPlaced ?? 0) >= (game?.dollsPerPlayer ?? 2));

  const handleStartGame = async () => {
    if (!code) return;
    try {
      await updateGameStatus(code, 'playing');
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível começar.');
    }
  };

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
          <Text style={[styles.errorButtonText, { color: colors.text }]}>SAIR DO JOGO</Text>
        </Pressable>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.error }]}>Modo Demo (Web)</Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
          Os teus bonecos foram colocados automaticamente em posições aleatórias dentro da área.
          {myDolls.length > 0 && `\n\nColocados: ${myDolls.length}/${game.dollsPerPlayer}`}
        </Text>
        <Pressable style={[styles.errorButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={confirmLeave}>
          <Text style={[styles.errorButtonText, { color: colors.text }]}>SAIR DO JOGO</Text>
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

  const totalDolls = game.dollsPerPlayer;
  const me = players.find((p) => p.id === currentUserId);
  const myColor = me ? getPlayerColorHex(me.color) : colors.primary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Colocar Bonecos</Text>
        <Text style={[styles.counter, { color: colors.primary }]}>
          {myDolls.length}/{totalDolls}
        </Text>
      </View>

      <View style={styles.instructionBar}>
        <Text style={[styles.instructionText, { color: colors.primary }]}>
          {myDolls.length < totalDolls
            ? 'TOCA DENTRO DA ÁREA PARA COLOCAR UM BONECO'
            : 'JÁ COLOCASTE TODOS OS BONECOS — AGUARDAR OUTROS'}
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
        {game.area && game.area.length >= 3 && (
          <Polygon
            coordinates={game.area}
            strokeColor={colors.primary}
            strokeWidth={2}
            fillColor="rgba(74, 222, 128, 0.1)"
          />
        )}

        {myDolls.map((doll) => (
          <Marker key={doll.id} coordinate={doll.location} pinColor={myColor} title="Teu boneco" />
        ))}

        {players
          .filter((p) => p.location && p.id !== currentUserId)
          .map((p) => (
            <Marker key={p.id} coordinate={p.location!} title={p.name} pinColor={getPlayerColorHex(p.color)} />
          ))}
      </MapView>

      {feedback && Platform.OS !== 'android' && (
        <View style={styles.feedbackOverlay}>
          <Text style={[styles.feedbackText, { color: colors.text }]}>{feedback}</Text>
        </View>
      )}

      <View style={styles.progressSection}>
        {players.map((p) => (
          <View key={p.id} style={styles.progressRow}>
            <View style={[styles.colorDot, { backgroundColor: getPlayerColorHex(p.color) }]} />
            <Text style={[styles.progressName, { color: colors.textSecondary }]}>
              {p.id === currentUserId ? 'Tu' : p.name}
            </Text>
            <Text style={[styles.progressCount, { color: colors.text }]}>
              {p.dollsPlaced ?? 0}/{totalDolls}
              {(p.dollsPlaced ?? 0) >= totalDolls && '  ✓'}
            </Text>
          </View>
        ))}
      </View>

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

        <Pressable
          style={({ pressed }) => [
            styles.smallButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
            myDolls.length === 0 && styles.disabled,
          ]}
          onPress={handleUndo}
          disabled={myDolls.length === 0}
        >
          <Text style={[styles.smallButtonText, { color: colors.text }]}>← DESFAZER</Text>
        </Pressable>

        {isAdmin() && allPlayersReady && (
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
            onPress={handleStartGame}
          >
            <Text style={[styles.primaryButtonText, { color: colors.background }]}>COMEÇAR →</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function centerOfPolygon(polygon: LocationCoords[]): LocationCoords {
  const sum = polygon.reduce(
    (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
    { latitude: 0, longitude: 0 }
  );
  return { latitude: sum.latitude / polygon.length, longitude: sum.longitude / polygon.length };
}

function getPlayerColorHex(color: string): string {
  const map: Record<string, string> = {
    green: '#4ade80', orange: '#fb923c', blue: '#60a5fa', purple: '#c084fc',
    red: '#f87171', yellow: '#fbbf24', pink: '#f472b6', cyan: '#22d3ee',
  };
  return map[color] ?? '#71717a';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: Spacing.lg, gap: Spacing.md,
  },
  loadingText: { ...Typography.body, marginTop: Spacing.md },
  errorTitle: { ...Typography.heading, textAlign: 'center' },
  errorMessage: { ...Typography.body, textAlign: 'center' },
  errorButton: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderRadius: 8, borderWidth: 1, marginTop: Spacing.lg,
  },
  errorButtonText: { ...Typography.label, letterSpacing: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: Spacing.lg, paddingBottom: 0,
  },
  title: { ...Typography.heading },
  counter: { ...Typography.heading, fontSize: 18 },
  instructionBar: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  instructionText: { ...Typography.caption, letterSpacing: 1, textAlign: 'center' },
  map: { flex: 1 },
  feedbackOverlay: {
    position: 'absolute', top: '50%', left: 20, right: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    padding: Spacing.md, borderRadius: 8, alignItems: 'center',
  },
  feedbackText: { ...Typography.label, letterSpacing: 1 },
  progressSection: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  progressName: { ...Typography.caption, flex: 1 },
  progressCount: { ...Typography.caption, fontWeight: 'bold' },
  footer: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg },
  smallButton: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: 8,
    alignItems: 'center', borderWidth: 1,
  },
  smallButtonText: { ...Typography.label, letterSpacing: 1 },
  primaryButton: {
    flex: 2, paddingVertical: Spacing.md, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryButtonText: { ...Typography.label, letterSpacing: 1 },
  secondaryButton: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: 8,
    alignItems: 'center', borderWidth: 1,
  },
  secondaryButtonText: { ...Typography.label, letterSpacing: 1 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});