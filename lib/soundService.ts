import { Platform } from 'react-native';

function generateWavBase64(
  notes: { freq: number; duration: number; volume?: number }[]
): string {
  const sampleRate = 8000;
  const totalSamples = notes.reduce(
    (acc, n) => acc + Math.floor(sampleRate * n.duration / 1000), 0
  );

  const buffer = new ArrayBuffer(44 + totalSamples);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + totalSamples, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeStr(36, 'data');
  view.setUint32(40, totalSamples, true);

  let offset = 44;
  for (const note of notes) {
    const numSamples = Math.floor(sampleRate * note.duration / 1000);
    const vol = note.volume ?? 0.7;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const fade = Math.max(0, 1 - (i / numSamples) * 1.5);
      const sample = Math.sin(2 * Math.PI * note.freq * t) * vol * fade;
      view.setUint8(offset + i, Math.floor((sample + 1) * 127.5));
    }
    offset += numSamples;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function playSound(
  notes: { freq: number; duration: number; volume?: number }[]
) {
  if (Platform.OS === 'web') return;

  try {
    const ExpoAudio = require('expo-audio');
    const base64 = generateWavBase64(notes);
    const uri = `data:audio/wav;base64,${base64}`;

    // Tentar useAudioPlayer (hook) não funciona fora de componente
    // Usar Sound diretamente se disponível, senão Audio do expo-av como fallback
    if (ExpoAudio.Sound) {
      const sound = new ExpoAudio.Sound();
      await sound.loadAsync({ uri });
      await sound.playAsync();
    } else if (ExpoAudio.createAudioPlayer) {
      const player = ExpoAudio.createAudioPlayer({ uri });
      player.play();
    } else {
      // Fallback para expo-av se expo-audio não tiver a API esperada
      const { Audio } = require('expo-av');
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    }
  } catch (e) {
    console.warn('Som não disponível:', e);
  }
}

export async function playProximitySound() {
  await playSound([
    { freq: 440, duration: 80, volume: 0.4 },
    { freq: 660, duration: 100, volume: 0.5 },
  ]);
}

export async function playDetectionSound() {
  await playSound([
    { freq: 660, duration: 80, volume: 0.5 },
    { freq: 880, duration: 120, volume: 0.6 },
  ]);
}

export async function playCaptureSound() {
  await playSound([
    { freq: 523, duration: 100, volume: 0.7 },
    { freq: 659, duration: 100, volume: 0.7 },
    { freq: 784, duration: 200, volume: 0.8 },
  ]);
}

export async function playVictorySound() {
  await playSound([
    { freq: 523, duration: 120, volume: 0.7 },
    { freq: 659, duration: 120, volume: 0.7 },
    { freq: 784, duration: 120, volume: 0.7 },
    { freq: 1047, duration: 350, volume: 0.8 },
  ]);
}

export async function playGameStartSound() {
  await playSound([
    { freq: 330, duration: 100, volume: 0.6 },
    { freq: 494, duration: 100, volume: 0.6 },
    { freq: 659, duration: 200, volume: 0.7 },
  ]);
}