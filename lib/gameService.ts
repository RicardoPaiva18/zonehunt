import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  collection,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import type { Game, GameStatus, PlayerColor, Player } from '../types/game';


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



/**
 * Subscreve às mudanças de um jogo em tempo real.
 * Retorna uma função para cancelar a subscrição quando já não for necessária.
 */
export function subscribeToGame(
  code: string,
  onUpdate: (game: Game | null) => void
) {
  return onSnapshot(
    doc(db, 'games', code),
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate({ id: snapshot.id, ...snapshot.data() } as Game);
    },
    (error) => {
      console.error('Erro a subscrever ao jogo:', error);
      onUpdate(null);
    }
  );
}

/**
 * Subscreve à lista de jogadores de um jogo em tempo real.
 */
export function subscribeToPlayers(
  code: string,
  onUpdate: (players: Player[]) => void
) {
  return onSnapshot(
    collection(db, 'games', code, 'players'),
    (snapshot) => {
      const players = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Player);
      onUpdate(players);
    },
    (error) => {
      console.error('Erro a subscrever aos jogadores:', error);
      onUpdate([]);
    }
  );
}

/**
 * Adiciona o utilizador atual como jogador num jogo existente.
 * Falha se o jogo não existir, já estiver a decorrer, ou estiver cheio.
 */
export async function joinGame(code: string, playerName: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Utilizador não autenticado');
  }

  const normalizedCode = code.trim().toUpperCase();
  const gameRef = doc(db, 'games', normalizedCode);
  const gameSnap = await getDoc(gameRef);

  if (!gameSnap.exists()) {
    throw new Error('Jogo não encontrado. Verifica o código.');
  }

  const game = gameSnap.data() as Game;

  if (game.status !== 'waiting') {
    throw new Error('Este jogo já começou.');
  }

  // Buscar jogadores existentes para escolher cor e validar lotação
  const playersSnap = await getDocs(collection(db, 'games', normalizedCode, 'players'));
  const existingPlayers = playersSnap.docs.map((d) => d.data() as Player);

  if (existingPlayers.length >= game.maxPlayers) {
    throw new Error('Este jogo já está cheio.');
  }

  // Se o utilizador já está no jogo, não adicionar outra vez
  if (existingPlayers.some((p) => p.id === user.uid)) {
    return;
  }

  // Escolher a próxima cor disponível
  const usedColors = new Set(existingPlayers.map((p) => p.color));
  const nextColor = PLAYER_COLOR_ORDER.find((c) => !usedColors.has(c));
  if (!nextColor) {
    throw new Error('Sem cores disponíveis.');
  }

  await setDoc(doc(db, 'games', normalizedCode, 'players', user.uid), {
    id: user.uid,
    name: playerName,
    color: nextColor,
    location: null,
    dollsPlaced: 0,
    capturedColors: [],
    isAdmin: false,
    joinedAt: Date.now(),
  });
}