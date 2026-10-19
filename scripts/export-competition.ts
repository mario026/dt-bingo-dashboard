import { mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

import type { Competition, ExportResult, PlayerExport, Gains } from '../src/types.ts';
export type { Change, BossData, PlayerExport, ExportResult } from '../src/types.ts';

export interface ExportOptions {
  outputPath?: string;
  userAgent?: string;
  apiKey?: string;
  onProgress?: (message: string) => void;
  /** Supply a client for testing. The default client enforces the API rate limit. */
  request?: <T>(path: string) => Promise<T>;
}

/** Serializes requests, with >=3.1 seconds between starts (<=20 in any 60s). */
export function createApiClient(options: Pick<ExportOptions, 'userAgent' | 'apiKey' | 'onProgress'> = {}) {
  let nextRequestAt = 0;
  let queue: Promise<unknown> = Promise.resolve();
  const perform = async <T>(path: string): Promise<T> => {
    for (let attempt = 0; attempt < 6; attempt++) {
      await sleep(Math.max(0, nextRequestAt - Date.now()));
      nextRequestAt = Date.now() + 3_100;
      let response: Response;
      try {
        response = await fetch(`https://api.wiseoldman.net/v2${path}`, {
          headers: {
            Accept: 'application/json',
            'User-Agent': options.userAgent ?? 'wom-competition-boss-export/1.0 (competition 160537)',
            ...(options.apiKey ? { 'x-api-key': options.apiKey } : {}),
          },
          signal: AbortSignal.timeout(30_000),
        });
      } catch (error) {
        if (attempt === 5) throw error;
        nextRequestAt = Math.max(nextRequestAt, Date.now() + 2 ** attempt * 1_000);
        continue;
      }
      if (response.headers.get('RateLimit-Remaining') === '0') {
        const reset = Number(response.headers.get('RateLimit-Reset'));
        nextRequestAt = Math.max(nextRequestAt, Date.now() + (Number.isFinite(reset) && reset > 0 ? reset * 1_000 + 1_000 : 61_000));
      }
      if (response.ok) return await response.json() as T;
      const body = await response.text();
      if ((response.status === 429 || response.status >= 500) && attempt < 5) {
        const retryAfter = response.headers.get('Retry-After');
        const seconds = retryAfter === null ? NaN : Number(retryAfter);
        const retryMs = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(retryAfter ?? '') - Date.now();
        const delay = response.status === 429
          ? Math.max(61_000, Number.isFinite(retryMs) ? retryMs + 1_000 : 0)
          : 2 ** attempt * 1_000;
        nextRequestAt = Math.max(nextRequestAt, Date.now() + delay);
        options.onProgress?.(`HTTP ${response.status}: retrying after ${Math.ceil(delay / 1_000)}s`);
        continue;
      }
      throw new Error(`HTTP ${response.status} for ${path}: ${body.slice(0, 500)}`);
    }
    throw new Error('Request retries exhausted');
  };
  return <T>(path: string): Promise<T> => {
    const result = queue.then(() => perform<T>(path));
    queue = result.catch(() => undefined);
    return result;
  };
}

/** Fetch all tracked boss deltas for every current competition participant. */
export async function exportCompetitionBossData(competitionId: number, options: ExportOptions = {}): Promise<ExportResult> {
  if (!Number.isSafeInteger(competitionId) || competitionId <= 0) throw new Error('Competition ID must be a positive integer');
  const request = options.request ?? createApiClient(options);
  const competition = await request<Competition>(`/competitions/${competitionId}`);
  if (!Array.isArray(competition.participations)
      || !Number.isFinite(Date.parse(competition.startsAt))
      || !Number.isFinite(Date.parse(competition.endsAt))
      || Date.parse(competition.startsAt) >= Date.parse(competition.endsAt)) {
    throw new Error('Invalid competition response or date range');
  }
  if (competition.participations.length !== competition.participantCount) {
    throw new Error('Competition participant count does not match the returned roster');
  }
  const { participations, ...metadata } = competition;
  const result: ExportResult = {
    generatedAt: new Date().toISOString(), competition: metadata,
    requestedRange: { startsAt: competition.startsAt, endsAt: competition.endsAt },
    interim: Date.now() < Date.parse(competition.endsAt), complete: false,
    playerCount: participations.length, successfulPlayers: 0, failedPlayers: 0, teams: [],
  };
  const query = new URLSearchParams({ startDate: competition.startsAt, endDate: competition.endsAt });
  // Checkpoint atomically after each player so an interrupted run leaves useful JSON.
  const save = async () => {
    if (!options.outputPath) return;
    const destination = resolve(options.outputPath);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(`${destination}.tmp`, JSON.stringify(result, null, 2) + '\n');
    await rename(`${destination}.tmp`, destination);
  };
  await save();
  for (const [index, participation] of participations.entries()) {
    const { player, teamName, createdAt, updatedAt } = participation;
    let team = result.teams.find(t => t.name === teamName);
    if (!team) { team = { name: teamName, players: Object.create(null) }; result.teams.push(team); }
    const entry: PlayerExport = {
      player, participation: { createdAt, updatedAt }, status: 'error', snapshotRange: null, bosses: null,
    };
    team.players[player.username] = entry;
    try {
      const gains = await request<Gains>(`/players/${encodeURIComponent(player.username)}/gained?${query}`);
      if (!gains.data?.bosses || typeof gains.data.bosses !== 'object' || Array.isArray(gains.data.bosses)) {
        throw new Error('Missing bosses in gains response');
      }
      entry.bosses = gains.data.bosses;
      entry.overallExperience = gains.data.skills?.overall?.experience ?? null;
      entry.snapshotRange = { startsAt: gains.startsAt, endsAt: gains.endsAt };
      entry.status = 'ok';
      result.successfulPlayers++;
    } catch (error) {
      entry.error = error instanceof Error ? error.message : String(error);
      result.failedPlayers++;
    }
    options.onProgress?.(`[${index + 1}/${participations.length}] ${teamName ?? 'No team'} / ${player.displayName}: ${entry.status}`);
    await save();
  }
  result.complete = result.failedPlayers === 0;
  result.generatedAt = new Date().toISOString();
  await save();
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const id = Number(process.argv[2] ?? '160537');
  const outputPath = process.argv[3] ?? `output/competition-${id}-bosses.json`;
  exportCompetitionBossData(id, {
    outputPath, userAgent: process.env.WOM_USER_AGENT, apiKey: process.env.WOM_API_KEY,
    onProgress: message => console.error(message),
  }).then(result => {
    console.log(`Saved ${result.successfulPlayers}/${result.playerCount} players across ${result.teams.length} teams to ${outputPath}`);
    if (!result.complete) process.exitCode = 1;
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
