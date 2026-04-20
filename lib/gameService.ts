import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { getPlayerId } from './playerIdentity';
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
  const userId = await getPlayerId();

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
    adminId: userId,
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
  await setDoc(doc(db, 'games', code, 'players', userId), {
    id: userId,
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
  const userId = await getPlayerId();

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
  if (existingPlayers.some((p) => p.id === userId)) {
    return;
  }

  // Escolher a próxima cor disponível
  const usedColors = new Set(existingPlayers.map((p) => p.color));
  const nextColor = PLAYER_COLOR_ORDER.find((c) => !usedColors.has(c));
  if (!nextColor) {
    throw new Error('Sem cores disponíveis.');
  }

  await setDoc(doc(db, 'games', normalizedCode, 'players', userId), {
    id: userId,
    name: playerName,
    color: nextColor,
    location: null,
    dollsPlaced: 0,
    capturedColors: [],
    isAdmin: false,
    joinedAt: Date.now(),
  });
}

/**
 * Muda o estado do jogo (ex: waiting -> placing).
 * Só deve ser chamado pelo admin.
 */
export async function updateGameStatus(code: string, status: GameStatus): Promise<void> {
  await updateDoc(doc(db, 'games', code), { status });
}

/**
 * Remove o jogador atual do jogo.
 * Se o admin sair, o jogo fica órfão (trataremos disto mais tarde).
 */
export async function leaveGame(code: string): Promise<void> {
  const userId = await getPlayerId();
  await deleteDoc(doc(db, 'games', code, 'players', userId));
}

/**
 * Encontra um jogo ativo (não terminado) onde o utilizador atual é jogador.
 * Retorna null se não houver nenhum.
 *
 * Nota: o Firestore não permite queries a subcoleções diferentes em simultâneo
 * com uma API direta. Em vez disso, vamos iterar sobre jogos não terminados
 * e verificar se o utilizador é jogador. Para o volume académico, isto é aceitável.
 */
export async function findActiveGameForUser(): Promise<Game | null> {
  const userId = await getPlayerId();

  // Procurar jogos que ainda não terminaram
  const q = query(
    collection(db, 'games'),
    where('status', 'in', ['waiting', 'placing', 'playing']),
    limit(20)
  );

  const gamesSnap = await getDocs(q);

  for (const gameDoc of gamesSnap.docs) {
    const playerDoc = await getDoc(doc(db, 'games', gameDoc.id, 'players', userId));
    if (playerDoc.exists()) {
      return { id: gameDoc.id, ...gameDoc.data() } as Game;
    }
  }

  return null;
}

/**
 * Decide para onde o utilizador deve ser redirecionado, com base no estado do jogo.
 */
export function getRouteForGameStatus(game: Game): string {
  switch (game.status) {
    case 'waiting':
      return `/game/lobby?code=${game.code}`;
    case 'placing':
      return `/game/area?code=${game.code}`;
    case 'playing':
      return `/game/area?code=${game.code}`; // substituiremos por /game/play quando existir
    default:
      return '/';
  }
}