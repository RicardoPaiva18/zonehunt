import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  collection,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import type { Game, GameStatus, PlayerColor } from '../types/game';

/**
 * Gera um código de jogo legível no formato G-XXX-XXXX.
 * Evita caracteres ambíguos (0/O, 1/I/L).
 */
function generateGameCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const random = (length: number) =>
    Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `G-${random(3)}-${random(4)}`;
}

/**
 * Cores disponíveis para jogadores, atribuídas por ordem de entrada.
 */
const PLAYER_COLOR_ORDER: PlayerColor[] = [
  'green', 'orange', 'blue', 'purple', 'red', 'yellow', 'pink', 'cyan',
];

/**
 * Cria um novo jogo no Firestore e adiciona o criador como primeiro jogador (admin).
 * Retorna o código do jogo para partilhar.
 */
export async function createGame(
  gameName: string,
  maxPlayers: number,
  playerName: string
): Promise<{ code: string; gameId: string }> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Utilizador não autenticado');
  }

  // Tenta gerar um código único (até 5 tentativas, para evitar colisões raras)
  let code = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateGameCode();
    const existing = await getDoc(doc(db, 'games', candidate));
    if (!existing.exists()) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    throw new Error('Não foi possível gerar um código único. Tenta de novo.');
  }

  // Criar o documento do jogo
  const gameData: Omit<Game, 'id'> = {
    code,
    name: gameName,
    status: 'waiting' as GameStatus,
    adminId: user.uid,
    maxPlayers,
    dollsPerPlayer: 2,
    area: null,
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    winnerId: null,
  };

  await setDoc(doc(db, 'games', code), gameData);

  // Adicionar o criador como primeiro jogador (com cor verde)
  await setDoc(doc(db, 'games', code, 'players', user.uid), {
    id: user.uid,
    name: playerName,
    color: PLAYER_COLOR_ORDER[0],
    location: null,
    dollsPlaced: 0,
    capturedColors: [],
    isAdmin: true,
    joinedAt: Date.now(),
  });

  return { code, gameId: code };
}