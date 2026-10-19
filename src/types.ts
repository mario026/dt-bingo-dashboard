export interface Change { start: number; end: number; gained: number }
export interface BossData { metric: string; kills: Change; rank: Change; ehb: Change }
export interface Player { id: number; username: string; displayName: string; [key: string]: unknown }
interface Participation {
  playerId: number;
  teamName: string | null;
  player: Player;
  createdAt: string;
  updatedAt: string;
}
export interface Competition {
  id: number; title: string; startsAt: string; endsAt: string;
  participantCount: number; participations: Participation[];
  [key: string]: unknown;
}
export interface Gains {
  startsAt: string | null; endsAt: string | null;
  data: { bosses: Record<string, BossData>; skills?: { overall?: { experience: Change } } };
}
export interface PlayerExport {
  player: Player;
  participation: { createdAt: string; updatedAt: string };
  status: 'ok' | 'error';
  snapshotRange: { startsAt: string | null; endsAt: string | null } | null;
  bosses: Record<string, BossData> | null;
  overallExperience?: Change | null;
  error?: string;
}
export interface ExportResult {
  generatedAt: string;
  competition: Pick<Competition, 'id' | 'title' | 'startsAt' | 'endsAt'> & Record<string, unknown>;
  requestedRange: { startsAt: string; endsAt: string };
  interim: boolean;
  complete: boolean;
  playerCount: number;
  successfulPlayers: number;
  failedPlayers: number;
  teams: { name: string | null; players: Record<string, PlayerExport> }[];
}
