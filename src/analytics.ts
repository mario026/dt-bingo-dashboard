import type { BossData, ExportResult, PlayerExport } from './types.ts';

export type Metric = 'kills' | 'ehb';
export interface Person extends PlayerExport { team: string; color: string }
export const teamColors: Record<string, string> = {
  'Team rood': '#f87171', 'Team Groen': '#4ade80', 'Team Oranje': '#fb923c',
  'Team Geel': '#facc15', 'Team Blauw': '#60a5fa',
};
export const colorFor = (team: string) => teamColors[team] ?? '#c4b5fd';
export function people(data: ExportResult): Person[] {
  return data.teams.flatMap(t => Object.values(t.players).map(p => ({ ...p, team: t.name ?? 'No team', color: colorFor(t.name ?? '') })));
}
export const validGain = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
export function bossValue(p: Person, key: string, metric: Metric): number | null {
  const boss = p.status === 'ok' ? p.bosses?.[key] : undefined;
  if (!boss || !validGain(boss[metric].gained)) return null;
  if (metric === 'kills' && boss.kills.start < 0 && boss.kills.end < 0) return null;
  return boss[metric].gained;
}
export function value(p: Person, metric: Metric, keys?: string[]): number | null {
  if (p.status !== 'ok' || !p.bosses) return null;
  const values = (keys ?? Object.keys(p.bosses)).map(k => bossValue(p, k, metric)).filter((n): n is number => n !== null);
  return values.length ? values.reduce((s, n) => s + n, 0) : null;
}
export function total(ps: Person[], metric: Metric, keys?: string[]): number | null {
  const values = ps.map(p => value(p, metric, keys)).filter((n): n is number => n !== null);
  return values.length ? values.reduce((s, n) => s + n, 0) : null;
}
export const share = (part: number | null, whole: number | null) => part !== null && whole !== null && whole > 0 ? part / whole * 100 : null;
export const average = (ps: Person[], metric: Metric, keys?: string[]) => { const n = total(ps, metric, keys); return n === null || !ps.length ? null : n / ps.length; };
export function rank(ps: Person[], person: Person, metric: Metric, keys?: string[]) {
  const current = value(person, metric, keys);
  return current === null ? null : 1 + ps.filter(p => (value(p, metric, keys) ?? -1) > current).length;
}
export const diversity = (p: Person) => Object.keys(p.bosses ?? {}).filter(k => (bossValue(p, k, 'kills') ?? 0) > 0).length;
export const bossKeys = (data: ExportResult) => [...new Set(people(data).flatMap(p => Object.keys(p.bosses ?? {})))].sort();
export const number = (n: number | null | undefined, metric: Metric | 'expected' = 'kills') => n == null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('en-GB', { minimumFractionDigits: metric === 'kills' ? 0 : 2, maximumFractionDigits: metric === 'kills' ? 0 : 2 }).format(n);
export const date = (s: string | null | undefined) => s && Number.isFinite(Date.parse(s)) ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s)) : 'Unavailable';

/** Validate before replacing a working dataset; never silently accept malformed counts. */
export function parseExport(input: unknown): ExportResult {
  const fail = (): never => { throw new Error('Invalid competition export. Import JSON created by the competition exporter.'); };
  if (!input || typeof input !== 'object') return fail();
  const x = input as ExportResult;
  if (!x.competition || !Number.isSafeInteger(x.competition.id) || !x.requestedRange || !Array.isArray(x.teams)) return fail();
  for (const s of [x.generatedAt, x.requestedRange.startsAt, x.requestedRange.endsAt]) if (typeof s !== 'string' || !Number.isFinite(Date.parse(s))) return fail();
  if (Date.parse(x.requestedRange.startsAt) >= Date.parse(x.requestedRange.endsAt)) return fail();
  if (typeof x.interim !== 'boolean' || typeof x.complete !== 'boolean') return fail();
  const ids = new Set<number>(); const names = new Set<string | null>(); let success = 0;
  for (const t of x.teams) {
    if ((t.name !== null && typeof t.name !== 'string') || names.has(t.name) || !t.players || typeof t.players !== 'object' || Array.isArray(t.players)) return fail();
    names.add(t.name);
    for (const [username, p] of Object.entries(t.players)) {
      if (!p.player || !Number.isSafeInteger(p.player.id) || ids.has(p.player.id) || p.player.username !== username || typeof p.player.displayName !== 'string') return fail();
      ids.add(p.player.id);
      if (p.status !== 'ok' && p.status !== 'error') return fail();
      if (p.status === 'error') continue;
      success++;
      if (!p.bosses || typeof p.bosses !== 'object' || Array.isArray(p.bosses)) return fail();
      for (const [key, b] of Object.entries(p.bosses) as [string, BossData][]) {
        if (!b || b.metric !== key) return fail();
        for (const field of ['kills', 'ehb', 'rank'] as const) {
          if (!b[field] || !['start', 'end', 'gained'].every(k => typeof b[field][k as keyof typeof b.kills] === 'number' && Number.isFinite(b[field][k as keyof typeof b.kills]))) return fail();
        }
      }
      if (!p.snapshotRange || [p.snapshotRange.startsAt, p.snapshotRange.endsAt].some(s => s !== null && (typeof s !== 'string' || !Number.isFinite(Date.parse(s))))) return fail();
    }
  }
  if (x.playerCount !== ids.size || x.successfulPlayers !== success || x.failedPlayers !== ids.size - success || (x.complete && success !== ids.size)) return fail();
  return x;
}

export interface Scenario { rolls: number | null; probability: number | null; quantity: number | null }
export function scenarioExpected(s: Scenario): number | null {
  return validGain(s.rolls) && Number.isInteger(s.rolls) && validGain(s.probability) && s.probability <= 1 && typeof s.quantity === 'number' && s.quantity > 0 && Number.isFinite(s.quantity) ? s.rolls * s.probability * s.quantity : null;
}
export const scenarioKey = (competition: number, tile: string) => `darkturbo:scenario:v1:${competition}:${tile}`;
export function readScenarios(storage: Pick<Storage, 'getItem'>, competition: number, tile: string): Record<string, Scenario> {
  try {
    const x = JSON.parse(storage.getItem(scenarioKey(competition, tile)) ?? '{}');
    if (!x || typeof x !== 'object' || Array.isArray(x)) return {};
    return Object.fromEntries(Object.entries(x).filter(([, s]) => s && typeof s === 'object').map(([k, s]) => {
      const entry = s as Scenario;
      return [k, { rolls: validGain(entry.rolls) && Number.isInteger(entry.rolls) ? entry.rolls : null,
        probability: validGain(entry.probability) && entry.probability <= 1 ? entry.probability : null,
        quantity: validGain(entry.quantity) && entry.quantity > 0 ? entry.quantity : 1 }];
    }));
  } catch { return {}; }
}
