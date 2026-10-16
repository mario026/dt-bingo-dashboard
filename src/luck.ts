import { modelSources, type TilePrediction } from './predictions.ts';

/** Item quantities obtained in this snapshot's time window, grouped by source and team. */
export type LootCounts = Record<string, Record<string, number>>;
export const lootStorageKey = (id: number, snapshot: string) => `darkturbo:loot:v1:${id}:${snapshot}`;
export function restoreLoot(raw: string | null, teams: string[]): LootCounts {
  try {
    const parsed = JSON.parse(raw ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([key, values]) => modelSources.some(s => s.key === key) && values && typeof values === 'object' && !Array.isArray(values)).map(([key, values]) => [key, Object.fromEntries(Object.entries(values as object).filter(([team, count]) => teams.includes(team) && Number.isSafeInteger(count) && (count as number) >= 0))]));
  } catch { return {}; }
}
export interface LuckRow {
  team: string; observed: number; expected: number; variance: number;
  score: number; ratio: number; categories: number; assumed: boolean; partial: boolean;
}
export function compareLuck(predictions: TilePrediction[], loot: LootCounts, teams: string[], tileIds: string[], metric?: string) {
  const sources = teams.map(team => predictions.filter(p => p.team === team && tileIds.includes(p.tile.id)).flatMap(p => p.components.flatMap(c => c.sources)).filter(s => !metric || s.model.metric === metric));
  const candidates = [...new Set(sources.flatMap(ss => ss.map(s => s.model.key)))];
  // Never compare teams on different categories or silently interpret absent loot as zero.
  const common = candidates.filter(key => teams.length > 0 && teams.every((team, i) => {
    const source = sources[i].find(s => s.model.key === key);
    const count = loot[key]?.[team];
    return source && source.eventMean !== null && source.expected !== null && Number.isSafeInteger(count) && count >= 0;
  }));
  const inconsistent = common.filter(key => teams.some((team, i) => sources[i].find(s => s.model.key === key)!.expected === 0 && loot[key][team] > 0));
  const usable = common.filter(key => !inconsistent.includes(key));
  const rows: LuckRow[] = teams.flatMap((team, i) => {
    const own = sources[i].filter(s => usable.includes(s.model.key));
    const expected = own.reduce((sum, s) => sum + s.expected!, 0);
    // Compound Poisson variance: bundled quantities are correlated within each drop event.
    const variance = own.reduce((sum, s) => sum + s.eventMean! * s.input.quantity ** 2, 0);
    if (!variance) return [];
    const observed = own.reduce((sum, s) => sum + loot[s.model.key][team], 0);
    return [{ team, observed, expected, variance, score: (observed - expected) / Math.sqrt(variance), ratio: observed / expected, categories: own.length, assumed: own.some(s => s.assumed), partial: own.some(s => s.partial) }];
  }).sort((a, b) => b.score - a.score || a.team.localeCompare(b.team));
  const eligible = rows.length === teams.length && teams.length >= 2;
  const top = rows[0]?.score ?? 0, bottom = rows.at(-1)?.score ?? 0;
  return { rows, common: usable, inconsistent,
    spooned: eligible && top > 0 ? rows.filter(r => Math.abs(r.score - top) < 1e-10).map(r => r.team) : [],
    driest: eligible && bottom < 0 ? rows.filter(r => Math.abs(r.score - bottom) < 1e-10).map(r => r.team) : [] };
}
