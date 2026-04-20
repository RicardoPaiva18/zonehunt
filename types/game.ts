export type PlayerColor = 'green' | 'orange' | 'blue' | 'purple' | 'red' | 'yellow' | 'pink' | 'cyan';

export type GameStatus = 'waiting' | 'placing' | 'playing' | 'finished';

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type Player = {
  id: string;
  name: string;
  color: PlayerColor;
  location: Coordinate | null;
  dollsPlaced: number;
  capturedColors: PlayerColor[];
  isAdmin: boolean;
  joinedAt: number;
};

export type Doll = {
  id: string;
  ownerId: string;
  ownerColor: PlayerColor;
  location: Coordinate;
  capturedBy: string | null;
  capturedAt: number | null;
};

export type Game = {
  id: string;
  code: string;
  name: string;
  status: GameStatus;
  adminId: string;
  maxPlayers: number;
  dollsPerPlayer: number;
  area: Coordinate[] | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  winnerId: string | null;
};