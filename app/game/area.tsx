import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MapView, Marker, PROVIDER_GOOGLE, Polygon } from '../../components/PlatformMap';
import * as Location from 'expo-location';
import {
  subscribeToGame,
  subscribeToPlayers,
  leaveGame,
  updatePlayerLocation,
  updateGameArea,
  confirmGameArea,        
} from '../../lib/gameService';
import { getPlayerId } from '../../lib/playerIdentity';
import { Colors, Spacing, Typography } from '../../constants/theme';
import type { Game, Player } from '../../types/game';

const MIN_AREA_POINTS = 3;
const MAX_AREA_POINTS = 8;

type LocationCoords = {
  latitude: number;
  longitude: number;
};

export default function AreaScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myLocation, setMyLocation] = useState<LocationCoords | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [draftArea, setDraftArea] = useState<LocationCoords[]>([]);
  const [saving, setSaving] = useState(false);
  const mapRef = useRef<any>(null);

  // Carregar o ID do jogador
  useEffect(() => {
    getPlayerId().then(setCurrentUserId);
  }, []);

  // Subscrever ao jogo e jogadores
  useEffect(() => {
    if (!code) return;
    const unsubGame = subscribeToGame(code, setGame);
    const unsubPlayers = subscribeToPlayers(code, setPlayers);
    return () => {
      unsubGame();
      unsubPlayers();
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
      mapRef.current?.animateToRegion({
        ...coords,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);

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
  }, [code]);

  const isAdmin = game?.adminId === currentUserId;
  const areaDefined = !!game?.areaConfirmed;

  // O polígono que aparece no mapa é o que está no Firestore (sincronizado entre todos)
  // Para o admin enquanto desenha, é o draft local
  const polygonToShow = isAdmin && !areaDefined ? draftArea : (game?.area ?? []);

  // Admin toca no mapa → adiciona vértice
  const handleMapPress = (event: any) => {
    if (!isAdmin || areaDefined) return;
    if (draftArea.length >= MAX_AREA_POINTS) return;

    const { latitude, longitude } = event.nativeEvent.coordinate;
    const newArea = [...draftArea, { latitude, longitude }];
    setDraftArea(newArea);

    // Publicar em tempo real para os outros verem
    if (code) {
      updateGameArea(code, newArea).catch(console.error);
    }
  };

  const handleUndo = () => {
    if (draftArea.length === 0) return;
    const newArea = draftArea.slice(0, -1);
    setDraftArea(newArea);
    if (code) {
      updateGameArea(code, newArea.length > 0 ? newArea : null).catch(console.error);
    }
  };

  const handleClear = () => {
    setDraftArea([]);
    if (code) {
      updateGameArea(code, null).catch(console.error);
    }
  };

  const handleConfirmArea = async () => {
    if (draftArea.length < MIN_AREA_POINTS || !code) return;
    setSaving(true);
    try {
      await confirmGameArea(code);
      // Ficar no mesmo ecrã por agora — a próxima fase (colocar bonecos)
      // vem a seguir. O botão vai ficar desativado a partir deste ponto.
    } catch (error: any) {
      Alert.alert('Erro', error.message ?? 'Não foi possível confirmar a área.');
      setSaving(false);
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

  // Estados de carregamento
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
        <Text style={styles.errorMessage}>
          O ZoneHunt precisa da tua localização para funcionar. Ativa nas definições do telemóvel.
        </Text>
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
        <Text style={styles.errorMessage}>
          Esta fase do jogo requer GPS e mapa nativo. Abre a app num telemóvel para continuar.
        </Text>
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

  // Instrução contextual para o admin
  let instruction = '';
  if (isAdmin) {
    if (draftArea.length === 0) {
      instruction = 'TOCA NO MAPA PARA DEFINIR OS VÉRTICES DA ÁREA';
    } else if (draftArea.length < MIN_AREA_POINTS) {
      instruction = `PRECISAS DE PELO MENOS ${MIN_AREA_POINTS} PONTOS  (${draftArea.length}/${MIN_AREA_POINTS})`;
    } else if (draftArea.length < MAX_AREA_POINTS) {
      instruction = `${draftArea.length} PONTOS — CONFIRMA OU ADICIONA MAIS`;
    } else {
      instruction = `MÁXIMO DE ${MAX_AREA_POINTS} PONTOS ATINGIDO`;
    }
  } else {
    instruction = 'À ESPERA QUE O ADMIN DEFINA A ÁREA';
  }

  const canConfirm = isAdmin && draftArea.length >= MIN_AREA_POINTS;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Definir Área</Text>
        {isAdmin && <Text style={styles.adminBadge}>ADMIN</Text>}
      </View>

      <View style={styles.instructionBar}>
        <Text style={styles.instructionText}>{instruction}</Text>
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

        {/* Vértices da área a desenhar */}
        {polygonToShow.map((point, index) => (
          <Marker
            key={`v-${index}`}
            coordinate={point}
            pinColor={Colors.primary}
            title={`Vértice ${index + 1}`}
          />
        ))}

        {/* O polígono em si, quando há >= 3 pontos */}
        {polygonToShow.length >= MIN_AREA_POINTS && (
          <Polygon
            coordinates={polygonToShow}
            strokeColor={Colors.primary}
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
                pressed && styles.pressed,
                draftArea.length === 0 && styles.disabled,
              ]}
              onPress={handleUndo}
              disabled={draftArea.length === 0}
            >
              <Text style={styles.smallButtonText}>← DESFAZER</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.smallButton,
                pressed && styles.pressed,
                draftArea.length === 0 && styles.disabled,
              ]}
              onPress={handleClear}
              disabled={draftArea.length === 0}
            >
              <Text style={styles.smallButtonText}>✕ LIMPAR</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.mainButtons}>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={confirmLeave}
          >
            <Text style={styles.secondaryButtonText}>SAIR</Text>
          </Pressable>

          {isAdmin ? (
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                (!canConfirm || saving) && styles.disabled,
              ]}
              onPress={handleConfirmArea}
              disabled={!canConfirm || saving}
            >
              <Text style={styles.primaryButtonText}>
                {canConfirm ? 'CONFIRMAR ÁREA →' : 'DEFINE ÁREA PRIMEIRO'}
              </Text>
            </Pressable>
          ) : (
            <View style={[styles.primaryButton, styles.disabled]}>
              <Text style={styles.primaryButtonText}>AGUARDAR ADMIN...</Text>
            </View>
          )}
        </View>
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
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  errorTitle: {
    ...Typography.heading,
    color: Colors.error,
    textAlign: 'center',
  },
  errorMessage: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.lg,
  },
  errorButtonText: {
    ...Typography.label,
    color: Colors.text,
    letterSpacing: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingBottom: 0,
  },
  title: {
    ...Typography.heading,
    color: Colors.text,
  },
  adminBadge: {
    ...Typography.caption,
    color: Colors.primary,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  instructionBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  instructionText: {
    ...Typography.caption,
    color: Colors.primary,
    letterSpacing: 1,
    textAlign: 'center',
  },
  map: { flex: 1 },
  footer: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  adminButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  smallButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  smallButtonText: {
    ...Typography.caption,
    color: Colors.text,
    letterSpacing: 1,
  },
  mainButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
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