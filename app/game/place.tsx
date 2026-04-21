import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, Platform, ToastAndroid } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
} from '../../lib/gameService';
import { getPlayerId } from '../../lib/playerIdentity';
import { Colors, Spacing, Typography } from '../../constants/theme';
import type { Game, Player, Doll } from '../../types/game';

type LocationCoords = {
  latitude: number;
  longitude: number;
};

export default function PlaceDollsScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myDolls, setMyDolls] = useState<Doll[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myLocation, setMyLocation] = useState<LocationCoords | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const mapRef = useRef<any>(null);

  // ID do jogador
  useEffect(() => {
    getPlayerId().then(setCurrentUserId);
  }, []);

  // Subscrever ao jogo, jogadores e bonecos próprios
  useEffect(() => {
    if (!code) return;
    const unsubGame = subscribeToGame(code, setGame);
    const unsubPlayers = subscribeToPlayers(code, setPlayers);

    let unsubDolls: (() => void) | null = null;
    subscribeToMyDolls(code, setMyDolls).then((fn) => {
      unsubDolls = fn;
    });

    return () => {
      unsubGame();
      unsubPlayers();
      unsubDolls?.();
    };
  }, [code]);

  // GPS (só em mobile)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let watcher: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
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

      // Centrar no centro da área (se já houver), senão na localização
      if (game?.area && game.area.length > 0) {
        const center = centerOfPolygon(game.area);
        mapRef.current?.animateToRegion({
          ...center,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, 1000);
      } else {
        mapRef.current?.animateToRegion({
          ...coords,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, 1000);
      }

      watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 2,
          timeInterval: 3000,
        },
        (pos) => {
          const newCoords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          setMyLocation(newCoords);
          if (code) {
            updatePlayerLocation(code, newCoords).catch(console.error);
          }
        }
      );
    })();

    return () => {
      watcher?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const showFeedback = (message: string) => {
    setFeedback(message);
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
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

    // Validar se está dentro da área
    if (!game.area || !isPointInPolygon(point, game.area)) {
      showFeedback('Fora da área de jogo');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
      return;
    }

    try {
      await placeDoll(code, point);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
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
      if (window.confirm('Tens a certeza que queres sair do jogo?')) {
        performLeave();
      }
      return;
    }

    Alert.alert(
      'Sair do jogo',
      'Tens a certeza que queres sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: performLeave },
      ],
    );
  };

  // Estados de loading/erro (iguais ao outro ecrã)
  if (!code || !game) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>A carregar jogo...</Text>
      </View>
    );
  }

  if (permissionDenied) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Sem permissão de localização</Text>
        <Pressable style={styles.errorButton} onPress={confirmLeave}>
          <Text style={styles.errorButtonText}>SAIR DO JOGO</Text>
        </Pressable>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Mapa não disponível em web</Text>
        <Text style={styles.errorMessage}>Abre a app num telemóvel para continuar.</Text>
        <Pressable style={styles.errorButton} onPress={confirmLeave}>
          <Text style={styles.errorButtonText}>SAIR DO JOGO</Text>
        </Pressable>
      </View>
    );
  }

  if (!myLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>A obter localização...</Text>
      </View>
    );
  }

  const totalDolls = game.dollsPerPlayer;
  const me = players.find((p) => p.id === currentUserId);
  const myColor = me ? getPlayerColorHex(me.color) : Colors.primary;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Colocar Bonecos</Text>
        <Text style={styles.counter}>
          {myDolls.length}/{totalDolls}
        </Text>
      </View>

      <View style={styles.instructionBar}>
        <Text style={styles.instructionText}>
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
        customMapStyle={darkMapStyle}
        onPress={handleMapPress}
      >
        {/* Polígono da área */}
        {game.area && game.area.length >= 3 && (
          <Polygon
            coordinates={game.area}
            strokeColor={Colors.primary}
            strokeWidth={2}
            fillColor="rgba(74, 222, 128, 0.1)"
          />
        )}

        {/* Bonecos do próprio jogador */}
        {myDolls.map((doll) => (
          <Marker
            key={doll.id}
            coordinate={doll.location}
            pinColor={myColor}
            title="Teu boneco"
          />
        ))}

        {/* Pins dos outros jogadores */}
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
      </MapView>

      {/* Feedback overlay */}
      {feedback && Platform.OS !== 'android' && (
        <View style={styles.feedbackOverlay}>
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      )}

      {/* Lista de progresso dos outros jogadores */}
      <View style={styles.progressSection}>
        {players.map((p) => (
          <View key={p.id} style={styles.progressRow}>
            <View style={[styles.colorDot, { backgroundColor: getPlayerColorHex(p.color) }]} />
            <Text style={styles.progressName}>
              {p.id === currentUserId ? 'Tu' : p.name}
            </Text>
            <Text style={styles.progressCount}>
              {p.dollsPlaced ?? 0}/{totalDolls}
              {(p.dollsPlaced ?? 0) >= totalDolls && '  ✓'}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={confirmLeave}
        >
          <Text style={styles.secondaryButtonText}>SAIR</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.smallButton,
            pressed && styles.pressed,
            myDolls.length === 0 && styles.disabled,
          ]}
          onPress={handleUndo}
          disabled={myDolls.length === 0}
        >
          <Text style={styles.smallButtonText}>← DESFAZER</Text>
        </Pressable>
      </View>
    </View>
  );
}

function centerOfPolygon(polygon: LocationCoords[]): LocationCoords {
  const sum = polygon.reduce(
    (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
    { latitude: 0, longitude: 0 }
  );
  return {
    latitude: sum.latitude / polygon.length,
    longitude: sum.longitude / polygon.length,
  };
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

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0a0a0a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#27272a' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  loadingText: { ...Typography.body, color: Colors.textSecondary, marginTop: Spacing.md },
  errorTitle: { ...Typography.heading, color: Colors.error, textAlign: 'center' },
  errorMessage: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  errorButton: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.lg,
  },
  errorButtonText: { ...Typography.label, color: Colors.text, letterSpacing: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingBottom: 0,
  },
  title: { ...Typography.heading, color: Colors.text },
  counter: {
    ...Typography.heading,
    color: Colors.primary,
    fontSize: 18,
  },
  instructionBar: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  instructionText: {
    ...Typography.caption,
    color: Colors.primary,
    letterSpacing: 1,
    textAlign: 'center',
  },
  map: { flex: 1 },
  feedbackOverlay: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    padding: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  feedbackText: {
    color: Colors.text,
    ...Typography.label,
    letterSpacing: 1,
  },
  progressSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  progressName: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  progressCount: { ...Typography.caption, color: Colors.text, fontWeight: 'bold' },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  smallButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  smallButtonText: { ...Typography.label, color: Colors.text, letterSpacing: 1 },
  secondaryButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: { ...Typography.label, color: Colors.text, letterSpacing: 1 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});