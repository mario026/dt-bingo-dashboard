import { describe, expect, it } from 'vitest';
import { competitionStatistics, summarize } from '../statistics.ts';
import { people, parseExport } from '../analytics.ts';
import { readFileSync } from 'node:fs';
import type { ExportResult } from '../types.ts';
const data = JSON.parse(readFileSync(new URL('../../output/competition-160537-bosses.json', import.meta.url), 'utf8')) as ExportResult;

describe('statistics overview', () => {
  it('totals gained XP once per player and preserves missing and zero values', () => {
    const base = people(data)[0];
    const player = (gained: number) => ({ ...base, overallExperience: { start: 100, end: 100 + gained, gained } });
    expect(summarize([player(1_250_000), player(2_500_000), player(0)], 'xp')).toEqual({ value: 3_750_000, available: 3, players: 3 });
    expect(summarize([{ ...base, overallExperience: null }, player(-1), { ...player(100), status: 'error' }], 'xp')).toEqual({ value: null, available: 0, players: 3 });
    expect(summarize([player(0), { ...base, overallExperience: undefined }], 'xp')).toEqual({ value: 0, available: 1, players: 2 });
  });
  it('includes every boss, sums team totals, and keeps the requested team order', () => {
    const stats = competitionStatistics(data);
    expect(stats.teams).toEqual(['Team Groen', 'Team Blauw', 'Team rood', 'Team Oranje', 'Team Geel']);
    expect(stats.bosses).toHaveLength(71);
    for (const row of [...stats.summary, ...stats.bosses]) {
      if (row.total.value !== null) expect(row.teams.reduce((sum, cell) => sum + (cell.value ?? 0), 0)).toBeCloseTo(row.total.value, 6);
    }
  });
  it('shows tied individual leaders and rejects malformed XP', () => {
    const tied = structuredClone(data);
    for (const team of tied.teams) for (const player of Object.values(team.players)) player.overallExperience = { start: 0, end: 100, gained: 100 };
    const xp = competitionStatistics(tied).summary.find(row => row.id === 'xp')!;
    expect(xp.best).toBe(100); expect(xp.leaders).toHaveLength(77);
    Object.values(tied.teams[0].players)[0].overallExperience!.gained = NaN;
    expect(() => parseExport(tied)).toThrow();
  });
});
