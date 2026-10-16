import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { allTiles, tileMetrics } from '../catalog.ts';
import { people, type Person } from '../analytics.ts';
import { bossTiles, completionChance, defaultSettings, modelSources, predictTile, predictCompetition, leaderboard, restoreSettings, predictionStorageKey } from '../predictions.ts';
import type { ExportResult } from '../types.ts';
const data = JSON.parse(readFileSync(new URL('../../output/competition-160537-bosses.json', import.meta.url), 'utf8')) as ExportResult;
const base = people(data)[0];
function person(kills: Record<string, number> = {}): Person {
  return { ...base, bosses: Object.fromEntries(Object.keys(base.bosses!).map(metric => [metric, {
    metric, kills: { start: 100, end: 100 + (kills[metric] ?? 0), gained: kills[metric] ?? 0 },
    ehb: { start: 10, end: 10, gained: 0 }, rank: { start: 10, end: 10, gained: 0 },
  }])) };
}
const tile = (id: string) => allTiles.find(t => t.id === id)!;
const predict = (id: string, kills: Record<string, number>) => predictTile(tile(id), 'Test team', [person(kills)], defaultSettings());
describe('drop completion probabilities', () => {
  it('requires enough drops rather than treating the expected count as completion', () => {
    expect(completionChance([{ mean: 1, quantity: 1 }], 1)).toBeCloseTo(1 - Math.exp(-1));
    expect(completionChance([{ mean: 1, quantity: 1 }], 2)).toBeCloseTo(1 - 2 * Math.exp(-1));
    expect(completionChance([{ mean: 0, quantity: 1 }], 2)).toBe(0);
    expect(completionChance([{ mean: 10000, quantity: 1 }], 4)).toBe(1);
  });
  it('models bundled drops as one event and combines different quantities correctly', () => {
    expect(completionChance([{ mean: .1, quantity: 7 }], 2)).toBeCloseTo(1 - Math.exp(-.1));
    const p = completionChance([{ mean: .5, quantity: 1 }, { mean: .5, quantity: 2 }], 2);
    expect(p).toBeCloseTo(1 - Math.exp(-1) * 1.5);
    expect(() => completionChance([{ mean: -1, quantity: 1 }], 1)).toThrow();
  });
  it('handles multi-component and multi-quantity tile requirements', () => {
    const r = predict('C3', { kraken: 512, zulrah: 512 });
    expect(r.components.map(c => c.expected)).toEqual([1, 1]);
    expect(r.probability).toBeCloseTo((1 - Math.exp(-1)) ** 2);
    expect(r.expectedPoints).toBeCloseTo(r.probability! * 2);
    const cudgel = predict('N1', { sarachnis: 384 });
    expect(cudgel.components[0].expected).toBe(1);
    expect(cudgel.probability).toBeLessThan(.5);
    expect(predict('N1', { sarachnis: 3840 }).probability).toBeGreaterThan(cudgel.probability!);
  });
  it('counts alternative components once and combines valid boss sources', () => {
    expect(predict('D1', { araxxor: 400 }).components[0].expected).toBe(2);
    expect(predict('D3', { general_graardor: 762 }).components[0].expected).toBe(3);
    expect(predict('H1', { kalphite_queen: 400, king_black_dragon: 1000 }).components[0].expected).toBe(2);
    expect(predict('H1', { callisto: 10000 }).components[0].expected).toBe(0);
  });
  it('keeps untracked required components out of whole-tile predictions', () => {
    const r = predict('R3', { cerberus: 520 });
    expect(r.components[0].expected).toBe(1);
    expect(r.components[1].expected).toBeNull();
    expect(r.probability).toBeNull(); expect(r.expectedPoints).toBeNull();
    expect(r.guess).toBe('Insufficient data');
  });
});
describe('explicit prediction assumptions', () => {
  it('has a typed model for every source of every boss tile', () => {
    expect(bossTiles).toHaveLength(allTiles.filter(t => tileMetrics(t).length).length);
    expect(modelSources).toHaveLength(bossTiles.reduce((n, t) => n + t.components.reduce((s, c) => s + c.sources.length, 0), 0));
    expect(modelSources.every(s => s.probability >= 0 && s.probability <= 1)).toBe(true);
    const noxious = modelSources.filter(s => s.tileId === 'D1'); expect(noxious).toHaveLength(1);
    expect(modelSources.find(s => s.tileId === 'C1' && s.metric === 'chambers_of_xeric')!.probability).toBeCloseTo(30000 / 867600 * 12 / 60);
  });
  it('adjusts group contribution, loot choices, and perfect kills without changing observed KC', () => {
    const nex = predict('I2', { nex: 430 });
    expect(nex.components[0].expected).toBe(1);
    expect(nex.kills).toBe(430);
    const titans = predict('C2', { the_royal_titans: 300 });
    expect(titans.components.map(c => c.expected)).toEqual([1, 1]);
    const duke = predict('I3', { duke_sucellus: 100 });
    expect(duke.components[0].expected).toBe(3.5);
    expect(duke.probability).toBeCloseTo(1 - Math.exp(-.5));
  });
  it('supports strict unknown coverage and never converts failed or missing data to zero', () => {
    const p = person(); p.bosses!.sarachnis.kills = { start: -1, end: -1, gained: 0 };
    const baseline = predictTile(tile('N1'), p.team, [p], defaultSettings());
    expect(baseline.probability).toBe(0); expect(baseline.assumed).toBe(true); expect(baseline.partial).toBe(true);
    const strict = { ...defaultSettings(), unknownAsZero: false };
    expect(predictTile(tile('N1'), p.team, [p], strict).probability).toBeNull();
    expect(predictTile(tile('N1'), p.team, [{ ...p, status: 'error', bosses: null }], defaultSettings()).probability).toBeNull();
    delete p.bosses!.sarachnis;
    expect(predictTile(tile('N1'), p.team, [p], defaultSettings()).probability).toBeNull();
  });
  it('recalculates using explicit overrides and rejects invalid settings', () => {
    const source = modelSources.find(s => s.tileId === 'N1')!;
    const settings = defaultSettings(); settings.overrides[source.key] = { probability: 0, eligibleFraction: 1, quantity: 1 };
    expect(predictTile(tile('N1'), base.team, [person({ sarachnis: 1000 })], settings).probability).toBe(0);
    settings.overrides[source.key].probability = NaN;
    expect(predictTile(tile('N1'), base.team, [person({ sarachnis: 1000 })], settings).probability).toBeNull();
    expect(restoreSettings('{broken')).toEqual(defaultSettings());
    expect(restoreSettings(JSON.stringify(settings)).overrides).toEqual({});
    expect(predictionStorageKey(1)).not.toBe(predictionStorageKey(2));
  });
});
describe('comparable predicted leaderboard', () => {
  it('covers all teams and boss tiles and bounds score by available tile points', () => {
    const predictions = predictCompetition(data); expect(predictions).toHaveLength(bossTiles.length * data.teams.length);
    const rows = leaderboard(data, predictions); expect(rows).toHaveLength(data.teams.length);
    expect(new Set(rows.map(r => r.assessed)).size).toBe(1);
    for (const row of rows) {
      expect(row.score).not.toBeNull(); expect(row.score!).toBeGreaterThanOrEqual(0); expect(row.score!).toBeLessThanOrEqual(row.possiblePoints);
      const own = predictions.filter(p => p.team === row.team && p.probability !== null);
      expect(row.score).toBeCloseTo(own.reduce((n, p) => n + p.expectedPoints!, 0));
    }
  });
  it('uses a common scoring set, excludes partial tiles, and supports filtered tile rankings', () => {
    const predictions = predictCompetition(data);
    const damaged = predictions.map(p => p.tile.id === 'N1' && p.team === data.teams[0].name ? { ...p, probability: null, expectedPoints: null } : p);
    const all = leaderboard(data, predictions, ['N1']); expect(all.every(r => r.assessed === 1)).toBe(true);
    expect(leaderboard(data, damaged, ['N1']).every(r => r.score === null && r.assessed === 0)).toBe(true);
    expect(leaderboard(data, predictions, ['R3']).every(r => r.score === null)).toBe(true);
    expect(leaderboard(data, predictions, []).every(r => r.rank === null)).toBe(true);
  });
});
