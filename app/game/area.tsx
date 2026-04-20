import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MapView, Marker, PROVIDER_GOOGLE } from '../../components/PlatformMap';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import {
  subscribeToGame,
  subscribeToPlayers,
  leaveGame,
  updatePlayerLocation,
} from '../../lib/gameService';
import { getPlayerId } from '../../lib/playerIdentity';
import { Colors, Spacing, Typography } from '../../constants/theme';
import type { Game, Player } from '../../types/game';

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
  const mapRef = useRef<any>(null);
  
  // Carregar o ID do jogador atual
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

  // Pedir permissão de localização e começar a seguir
  useEffect(() => {
    let watcher: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        return;
      }

      // Obter primeira localização
      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coords = {
        latitude: initial.coords.latitude,
        longitude: initial.coords.longitude,
      };
      setMyLocation(coords);

      // Centrar o mapa na localização inicial
      mapRef.current?.animateToRegion({
        ...coords,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);

      // Subscrever a updates contínuos
      watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 2,      // emite update se se moveu 2+ metros
          timeInterval: 3000,       // ou a cada 3 segundos
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

  const handleLeave = () => {
    const performLeave = async () => {
      if (code) await leaveGame(code);
      router.replace('/');
    };

    if (Platform.OS === 'web') {
      // Alert.alert não funciona em web — usar confirm nativo do browser
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
        {
          text: 'Sair',
          style: 'destructive',
          onPress: performLeave,
        },
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
        <Pressable style={styles.errorButton} onPress={handleLeave}>
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

    // Em web, mostrar mensagem de que o mapa requer telemóvel
  if (Platform.OS === 'web') {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Mapa não disponível em web</Text>
        <Text style={styles.errorMessage}>
          Esta fase do jogo requer GPS e mapa nativo. Abre a app num telemóvel para continuar.
        </Text>
        <Pressable style={styles.errorButton} onPress={handleLeave}>
          <Text style={styles.errorButtonText}>SAIR DO JOGO</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Definir Área</Text>
        {isAdmin && <Text style={styles.adminBadge}>ADMIN</Text>}
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
      </MapView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={handleLeave}
        >
          <Text style={styles.secondaryButtonText}>SAIR</Text>
        </Pressable>

        <View style={[styles.primaryButton, styles.disabled]}>
          <Text style={styles.primaryButtonText}>
            {isAdmin ? 'DEFINIR ÁREA (em breve)' : 'À ESPERA DO ADMIN...'}
          </Text>
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

// Estilo escuro para o Google Maps (inspirado no Figma)
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
  map: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
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