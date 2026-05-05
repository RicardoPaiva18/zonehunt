import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors, Spacing, Typography } from "../../constants/theme";
import { db } from "../../lib/firebase";
import {
  angleDifference,
  bearingTo,
  distanceBetween,
} from "../../lib/gameService";
import type { Doll } from "../../types/game";

export default function CameraScreen() {
  const { code, dollId } = useLocalSearchParams<{
    code: string;
    dollId: string;
  }>();
  const [permission, requestPermission] = useCameraPermissions();

  const [doll, setDoll] = useState<Doll | null>(null);
  const [myLocation, setMyLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [heading, setHeading] = useState<number>(0);

  // Pedir permissão de câmara
  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  // Subscrever ao boneco específico no Firestore
  useEffect(() => {
    if (!code || !dollId) return;
    const unsub = onSnapshot(
      doc(db, "games", code, "dolls", dollId),
      (snap) => {
        if (snap.exists()) {
          setDoll({ id: snap.id, ...snap.data() } as Doll);
        }
      },
    );
    return () => unsub();
  }, [code, dollId]);

  // Localização do jogador + heading da bússola
  useEffect(() => {
    if (Platform.OS === "web") return;

    let locWatcher: Location.LocationSubscription | null = null;
    let headingWatcher: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      // Localização inicial
      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setMyLocation({
        latitude: initial.coords.latitude,
        longitude: initial.coords.longitude,
      });

      // Update GPS contínuo
      locWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 1,
          timeInterval: 1000,
        },
        (pos) => {
          setMyLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
      );

      // Update heading (bússola) contínuo
      headingWatcher = await Location.watchHeadingAsync((h) => {
        // 'trueHeading' é mais preciso quando disponível; senão usar 'magHeading'
        const value = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        setHeading(value);
      });
    })();

    return () => {
      locWatcher?.remove();
      headingWatcher?.remove();
    };
  }, []);

  const handleClose = () => {
    router.back();
  };

  // Em web não há câmara
  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Câmara não disponível em web</Text>
        <Pressable style={styles.button} onPress={handleClose}>
          <Text style={styles.buttonText}>FECHAR</Text>
        </Pressable>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Sem permissão de câmara</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>PEDIR PERMISSÃO</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.buttonSecondary]}
          onPress={handleClose}
        >
          <Text style={styles.buttonText}>VOLTAR</Text>
        </Pressable>
      </View>
    );
  }

  // Calcular distância, bearing e diferença
  const distance =
    doll && myLocation ? distanceBetween(myLocation, doll.location) : null;
  const bearing =
    doll && myLocation ? bearingTo(myLocation, doll.location) : null;
  const angleDiff = bearing !== null ? angleDifference(heading, bearing) : null;

  return (
    <View style={styles.fullscreen}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable style={styles.closeButton} onPress={handleClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
        <View style={styles.recIndicator}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>REC</Text>
        </View>
      </View>

      {/* Brackets centrais */}
      <View style={styles.cornerTopLeft} />
      <View style={styles.cornerTopRight} />
      <View style={styles.cornerBottomLeft} />
      <View style={styles.cornerBottomRight} />

      {/* Painel de info AR */}
      <View style={styles.infoPanel}>
        <Text style={styles.infoLabel}>OBJETO DETETADO</Text>
        <Text style={styles.infoValue}>ITEM OCULTO #{dollId?.slice(-4) ?? '????'}</Text>
      </View>

      {/* Debug overlay */}
      <View style={styles.debugPanel}>
        <Text style={styles.debugText}>
          Status: {!myLocation ? '⏳ GPS' : !doll ? '⏳ Boneco' : '✓ Pronto'}
        </Text>
        <Text style={styles.debugText}>
          Distância: {distance !== null ? `${distance.toFixed(1)}m` : '—'}
        </Text>
        <Text style={styles.debugText}>
          Heading (bússola): {heading.toFixed(0)}°
        </Text>
        <Text style={styles.debugText}>
          Bearing (para boneco): {bearing !== null ? `${bearing.toFixed(0)}°` : '—'}
        </Text>
        <Text style={[
          styles.debugText,
          angleDiff !== null && Math.abs(angleDiff) <= 15 && styles.debugTextLocked,
        ]}>
          Diferença: {angleDiff !== null ? `${angleDiff.toFixed(0)}°` : '—'}
          {angleDiff !== null && Math.abs(angleDiff) <= 15 && '  🎯'}
        </Text>
      </View>

      {/* Botão de captura placeholder */}
      <View style={styles.captureButtonContainer}>
        <View style={styles.captureButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  fullscreen: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  errorTitle: {
    ...Typography.heading,
    color: Colors.text,
    textAlign: "center",
  },
  errorMessage: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    marginTop: Spacing.md,
  },
  buttonSecondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonText: {
    ...Typography.label,
    color: Colors.background,
    letterSpacing: 1,
  },
  topBar: {
    position: "absolute",
    top: Spacing.xxl,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
  },
  recIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  recText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  cornerTopLeft: {
    position: "absolute",
    top: "20%",
    left: "10%",
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: Colors.primary,
  },
  cornerTopRight: {
    position: "absolute",
    top: "20%",
    right: "10%",
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: Colors.primary,
  },
  cornerBottomLeft: {
    position: "absolute",
    bottom: "30%",
    left: "10%",
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: Colors.primary,
  },
  cornerBottomRight: {
    position: "absolute",
    bottom: "30%",
    right: "10%",
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: Colors.primary,
  },
  infoPanel: {
    position: "absolute",
    bottom: 140,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: "rgba(10, 10, 10, 0.85)",
    borderRadius: 8,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: "center",
  },
  infoLabel: {
    ...Typography.caption,
    color: Colors.primary,
    letterSpacing: 2,
    marginBottom: 4,
  },
  infoValue: {
    ...Typography.label,
    color: Colors.text,
    letterSpacing: 1,
  },
  debugPanel: {
    position: "absolute",
    top: 100,
    left: Spacing.lg,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 8,
    padding: Spacing.sm,
    gap: 2,
  },
  debugText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  debugTextLocked: {
    color: Colors.primary,
    fontWeight: "bold",
  },
  captureButtonContainer: {
    position: "absolute",
    bottom: Spacing.xl,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#fff",
    borderWidth: 4,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
});
