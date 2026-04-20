import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const STORAGE_KEY = 'zonehunt_player_id';

let cachedId: string | null = null;

/**
 * Obtém o ID único deste dispositivo/jogador.
 * Gera um novo UUID na primeira vez e persiste em AsyncStorage.
 */
export async function getPlayerId(): Promise<string> {
  if (cachedId) return cachedId;

  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored) {
    cachedId = stored;
    return stored;
  }

  const newId = Crypto.randomUUID();
  await AsyncStorage.setItem(STORAGE_KEY, newId);
  cachedId = newId;
  return newId;
}

/**
 * Remove o ID persistido. Só para testes / reset manual.
 */
export async function resetPlayerId(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  cachedId = null;
}