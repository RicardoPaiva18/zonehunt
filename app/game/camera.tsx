import { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform,
  ActivityIndicator, Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { distanceBetween, bearingTo, angleDifference, captureDoll } from '../../lib/gameService';
import { Colors, Spacing, Typography, GameConfig } from '../../constants/theme';
import type { Doll } from '../../types/game';

const ANGLE_TOLERANCE = 15;

export default function CameraScreen() {
  const { code, dollId } = useLocalSearchParams<{ code: string; dollId: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [doll, setDoll] = useState<Doll | null>(null);
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const capturingRef = useRef(false);

  // Cálculos AR — antes de qualquer useEffect que os usa e antes dos early returns
  const distance = doll && myLocation ? distanceBetween(myLocation, doll.location) : null;
  const bearing = doll && myLocation ? bearingTo(myLocation, doll.location) : null;
  const angleDiff = bearing !== null ? angleDifference(heading, bearing) : null;
  const isVisible = angleDiff !== null && Math.abs(angleDiff) <= ANGLE_TOLERANCE;
  const canCapture = isVisible && distance !== null && distance <= GameConfig.CAPTURE_RADIUS_METERS;
  const dollSize = distance !== null ? Math.max(40, Math.min(120, 120 - (distance - 8) * 1.5)) : 60;
  const horizontalOffset = angleDiff !== null ? (angleDiff / ANGLE_TOLERANCE) * 40 : 0;

  // ─── TODOS OS HOOKS AQUI — antes de qualquer return condicional ───

  // Animação de pulsar
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Permissão câmara
  useEffect(() => {
    if (permission && !permission.granted) requestPermission();
  }, [permission]);

  // Subscrever ao boneco
  useEffect(() => {
    if (!code || !dollId) return;
    const unsub = onSnapshot(
      doc(db, 'games', code, 'dolls', dollId),
      (snap) => {
        if (snap.exists()) setDoll({ id: snap.id, ...snap.data() } as Doll);
      }
    );
    return () => unsub();
  }, [code, dollId]);

  // GPS + bússola
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let locWatcher: Location.LocationSubscription | null = null;
    let headingWatcher: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setMyLocation({ latitude: initial.coords.latitude, longitude: initial.coords.longitude });

      locWatcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1, timeInterval: 1000 },
        (pos) => setMyLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
      );

      headingWatcher = await Location.watchHeadingAsync((h) => {
        setHeading(h.trueHeading >= 0 ? h.trueHeading : h.magHeading);
      });
    })();

    return () => {
      locWatcher?.remove();
      headingWatcher?.remove();
    };
  }, []);

  // Fade in/out do boneco — usa isVisible calculado acima
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isVisible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    if (isVisible && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  }, [isVisible]);

  // ─── FUNÇÕES ───

  const handleClose = () => router.back();

  const handleCapture = async () => {
    if (capturingRef.current || !code || !dollId) return;
    capturingRef.current = true;
    setCapturing(true);

    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    try {
      const { won } = await captureDoll(code, dollId);
      setCaptured(true);
      setTimeout(() => {
        if (won) {
          router.replace(`/game/finish?code=${code}`);
        } else {
          router.back();
        }
      }, 1500);
    } catch (e: any) {
      console.error('Erro ao capturar:', e);
      capturingRef.current = false;
      setCapturing(false);
    }
  };

  // ─── EARLY RETURNS — só depois de todos os hooks ───

  if (Platform.OS === 'web') {
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
        <Pressable style={[styles.button, styles.buttonSecondary]} onPress={handleClose}>
          <Text style={styles.buttonText}>VOLTAR</Text>
        </Pressable>
      </View>
    );
  }

  // ─── RENDER PRINCIPAL ───

  return (
    <View style={styles.fullscreen}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* Flash de captura */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.flash, { opacity: flashAnim }]}
        pointerEvents="none"
      />

      {/* Overlay de captura confirmada */}
      {captured && (
        <View style={styles.capturedOverlay}>
          <Text style={styles.capturedEmoji}>✅</Text>
          <Text style={styles.capturedText}>BONECO CAPTURADO!</Text>
        </View>
      )}

      {/* Top bar */}
      {!captured && (
        <View style={styles.topBar}>
          <Pressable style={styles.closeButton} onPress={handleClose} disabled={capturing}>
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
          <View style={styles.recIndicator}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>REC</Text>
          </View>
        </View>
      )}

      {/* Brackets */}
      {!captured && (
        <>
          <View style={[styles.cornerTopLeft, canCapture && styles.cornerActive]} />
          <View style={[styles.cornerTopRight, canCapture && styles.cornerActive]} />
          <View style={[styles.cornerBottomLeft, canCapture && styles.cornerActive]} />
          <View style={[styles.cornerBottomRight, canCapture && styles.cornerActive]} />
        </>
      )}

      {/* Boneco overlay */}
      {!captured && (
        <Animated.View
          style={[
            styles.dollContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: pulseAnim }, { translateX: horizontalOffset }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.dollEmoji, { fontSize: dollSize }]}>🎯</Text>
          {distance !== null && (
            <View style={styles.dollDistanceBadge}>
              <Text style={styles.dollDistanceText}>{Math.round(distance)}m</Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* Painel de info */}
      {!captured && (
        <View style={styles.infoPanel}>
          <Text style={styles.infoLabel}>
            {isVisible ? 'OBJETO DETETADO' : 'ITEM OCULTO'}
          </Text>
          <Text style={styles.infoValue}>
            {isVisible
              ? canCapture
                ? 'PRONTO A CAPTURAR — TOCA NO BOTÃO'
                : `APROXIMA-TE — ${distance !== null ? Math.round(distance) : '?'}m`
              : 'PROCURA O BONECO À TUA VOLTA'}
          </Text>
        </View>
      )}

      {/* Debug (remover antes dos testes) */}
      {!captured && (
        <View style={styles.debugPanel}>
          <Text style={styles.debugText}>Heading: {heading.toFixed(0)}°</Text>
          <Text style={styles.debugText}>
            Bearing: {bearing !== null ? `${bearing.toFixed(0)}°` : '—'}
          </Text>
          <Text style={[styles.debugText, isVisible && styles.debugTextLocked]}>
            Δ: {angleDiff !== null ? `${angleDiff.toFixed(0)}°` : '—'}
            {isVisible ? '  🎯' : ''}
          </Text>
        </View>
      )}

      {/* Botão de captura */}
      {!captured && (
        <View style={styles.captureButtonContainer}>
          <Pressable
            style={[styles.captureButton, canCapture && !capturing && styles.captureButtonReady]}
            disabled={!canCapture || capturing}
            onPress={handleCapture}
          >
            {capturing
              ? <ActivityIndicator color={Colors.background} />
              : canCapture
              ? <Text style={styles.captureButtonIcon}>📸</Text>
              : null}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
    padding: Spacing.lg, gap: Spacing.md,
  },
  fullscreen: { flex: 1, backgroundColor: '#000' },
  errorTitle: { ...Typography.heading, color: Colors.text, textAlign: 'center' },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderRadius: 8, marginTop: Spacing.md,
  },
  buttonSecondary: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  buttonText: { ...Typography.label, color: Colors.background, letterSpacing: 1 },
  flash: { backgroundColor: '#ffffff' },
  capturedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 10, 0.85)',
    justifyContent: 'center', alignItems: 'center', gap: Spacing.md,
  },
  capturedEmoji: { fontSize: 72 },
  capturedText: { ...Typography.heading, color: Colors.primary, letterSpacing: 2 },
  topBar: {
    position: 'absolute', top: Spacing.xxl, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  closeButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
  },
  closeButtonText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  recIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: 6,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  recText: { color: '#fff', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  cornerTopLeft: {
    position: 'absolute', top: '20%', left: '10%',
    width: 30, height: 30, borderTopWidth: 3, borderLeftWidth: 3, borderColor: Colors.primary,
  },
  cornerTopRight: {
    position: 'absolute', top: '20%', right: '10%',
    width: 30, height: 30, borderTopWidth: 3, borderRightWidth: 3, borderColor: Colors.primary,
  },
  cornerBottomLeft: {
    position: 'absolute', bottom: '30%', left: '10%',
    width: 30, height: 30, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: Colors.primary,
  },
  cornerBottomRight: {
    position: 'absolute', bottom: '30%', right: '10%',
    width: 30, height: 30, borderBottomWidth: 3, borderRightWidth: 3, borderColor: Colors.primary,
  },
  cornerActive: { borderColor: '#ffffff' },
  dollContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  dollEmoji: { textAlign: 'center' },
  dollDistanceBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: Colors.primary,
  },
  dollDistanceText: { ...Typography.label, color: Colors.primary, letterSpacing: 1 },
  infoPanel: {
    position: 'absolute', bottom: 140, left: Spacing.lg, right: Spacing.lg,
    backgroundColor: 'rgba(10,10,10,0.85)', borderRadius: 8, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.primary, alignItems: 'center',
  },
  infoLabel: { ...Typography.caption, color: Colors.primary, letterSpacing: 2, marginBottom: 4 },
  infoValue: { ...Typography.label, color: Colors.text, letterSpacing: 1, textAlign: 'center' },
  debugPanel: {
    position: 'absolute', top: 100, left: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: Spacing.sm, gap: 2,
  },
  debugText: { color: '#fff', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  debugTextLocked: { color: Colors.primary, fontWeight: 'bold' },
  captureButtonContainer: {
    position: 'absolute', bottom: Spacing.xl, left: 0, right: 0, alignItems: 'center',
  },
  captureButton: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  captureButtonReady: { backgroundColor: Colors.primary, borderColor: '#fff' },
  captureButtonIcon: { fontSize: 28 },
});