import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { people, total, value, bossValue, average, rank, share, diversity, parseExport, scenarioExpected, scenarioKey, readScenarios, teamColors, type Person } from '../analytics.ts';
import { allTiles, crypts, componentEstimate, tileMetrics } from '../catalog.ts';
import type { ExportResult } from '../types.ts';
const dataset = JSON.parse(readFileSync(new URL('../../output/competition-160537-bosses.json', import.meta.url), 'utf8')) as ExportResult;
const ps = people(dataset);
function fake(kills: number, ehb = 2): Person {
  return { ...ps[0], bosses: { sarachnis: { metric: 'sarachnis', kills: { start: 10, end: 10 + kills, gained: kills }, ehb: { start: 1, end: 1 + ehb, gained: ehb }, rank: { start: 20, end: 10, gained: -10 } } } };
}
describe('competition analytics', () => {
  it('validates the real export and retains all participants', () => {
    expect(parseExport(dataset)).toBe(dataset);
    expect(ps).toHaveLength(77);
    expect(new Set(ps.map(p => p.team)).size).toBe(5);
    expect(ps.every(p => Object.keys(p.bosses!).length === 71)).toBe(true);
    expect(total(ps, 'kills')).toBeGreaterThan(0);
    expect(total(ps, 'ehb')).toBeGreaterThan(0);
  });
  it('aggregates kills and EHB separately and filters sources', () => {
    expect(total([fake(100), fake(200, 4)], 'kills', ['sarachnis'])).toBe(300);
    expect(total([fake(100), fake(200, 4)], 'ehb')).toBe(6);
    expect(total([fake(100)], 'kills', ['kraken'])).toBeNull();
    expect(diversity(fake(100))).toBe(1);
  });
  it('preserves zeroes and distinguishes unknown counts and failed players', () => {
    const unknown = fake(0); unknown.bosses!.sarachnis.kills = { start: -1, end: -1, gained: 0 };
    const failed = { ...fake(0), status: 'error' as const, bosses: null };
    expect(value(fake(0), 'kills')).toBe(0);
    expect(bossValue(unknown, 'sarachnis', 'kills')).toBeNull();
    expect(total([unknown, failed], 'kills')).toBeNull();
    expect(average([failed], 'ehb')).toBeNull();
    expect(average([fake(100), failed], 'kills')).toBe(50);
    unknown.bosses!.sarachnis.kills = { start: -1, end: 10, gained: 10 };
    expect(value(unknown, 'kills')).toBe(10);
  });
  it('excludes negative anomalies without suppressing the other metric', () => {
    expect(value(fake(-1), 'kills')).toBeNull();
    expect(value(fake(-1), 'ehb')).toBe(2);
  });
  it('uses competition ranks with ties and safe contribution denominators', () => {
    const a = fake(100); expect(rank([a, fake(100), fake(200)], a, 'kills')).toBe(2);
    expect(share(25, 100)).toBe(25); expect(share(0, 0)).toBeNull(); expect(share(null, 100)).toBeNull();
  });
  it('retains stable team colors independently of ranking', () => {
    for (const p of ps) expect(p.color).toBe(teamColors[p.team]);
  });
  it('rejects malformed imports, duplicate players, and count mismatches', () => {
    for (const x of [null, {}, [], { ...dataset, playerCount: 0 }]) expect(() => parseExport(x)).toThrow();
    const bad = structuredClone(dataset); const player = Object.values(bad.teams[0].players)[0]; player.bosses!.sarachnis.kills.gained = NaN;
    expect(() => parseExport(bad)).toThrow();
    const duplicate = structuredClone(dataset); duplicate.teams[1].players = duplicate.teams[0].players;
    expect(() => parseExport(duplicate)).toThrow();
  });
});
describe('bingo catalog and estimates', () => {
  it('has six crypts and exactly 54 unique numbered tiles with preserved rules', () => {
    expect(crypts).toHaveLength(6); expect(crypts.every(c => c.tiles.length === 9)).toBe(true);
    expect(new Set(allTiles.map(t => t.id)).size).toBe(54);
    expect(allTiles.map(t => t.id)).toEqual(Array.from({ length: 18 }, (_, i) => 'ABCDEFGHIJKLMNOPQR'[i]).flatMap(row => [1, 2, 3].map(n => row + n)));
    expect(allTiles.find(t => t.id === 'D1')!.components[0].required).toBe(3);
    expect(allTiles.find(t => t.id === 'D3')!.components[0].required).toBe(3);
    expect(allTiles.find(t => t.id === 'M3')!.components[0].required).toBe(4);
    expect(allTiles.every(t => !/[✅□]/.test(t.name))).toBe(true);
  });
  it('calculates expected drops without dividing by the tile requirement', () => {
    const component = allTiles.find(t => t.id === 'N1')!.components[0];
    expect(componentEstimate(component, [fake(384)]).expected).toBe(1);
    expect(component.required).toBe(2);
    expect(componentEstimate(component, [fake(0)]).expected).toBe(0);
  });
  it('sums fixed multiple sources and respects allowed source restrictions', () => {
    const tile = allTiles.find(t => t.id === 'H1')!;
    expect(tileMetrics(tile)).toEqual(['kalphite_queen', 'king_black_dragon']);
    const p = fake(0); const base = p.bosses!.sarachnis;
    p.bosses = { kalphite_queen: { ...base, kills: { start: 0, end: 400, gained: 400 } }, king_black_dragon: { ...base, kills: { start: 0, end: 1000, gained: 1000 } } };
    expect(componentEstimate(tile.components[0], [p]).expected).toBe(2);
  });
  it('combines alternative pieces once and never adds Noxious rates three times', () => {
    const noxious = allTiles.find(t => t.id === 'D1')!.components[0];
    expect(noxious.alternatives).toHaveLength(3); expect(noxious.sources).toHaveLength(1);
    expect(componentEstimate(noxious, ps).expected).toBeNull();
    const virtus = allTiles.find(t => t.id === 'A3')!.components[0];
    expect(virtus.sources.find(s => s.metric === 'vardorvis')!.rate).toContain('3/3264');
  });
  it('keeps partial components, unsupported sources, and missing coverage visible', () => {
    const boots = allTiles.find(t => t.id === 'R3')!;
    expect(boots.components[0].sources[0].rate).toBe('1/520');
    expect(boots.components[1].sources).toHaveLength(0);
    expect(componentEstimate(boots.components[1], ps).expected).toBeNull();
    const ring = allTiles.find(t => t.id === 'G2')!.components[0];
    expect(componentEstimate(ring, ps).partial).toBe(true);
    expect(tileMetrics(allTiles.find(t => t.id === 'A1')!)).toEqual([]);
    const cudgel = allTiles.find(t => t.id === 'N1')!.components[0];
    expect(componentEstimate(cudgel, [fake(384), { ...fake(0), status: 'error', bosses: null }])).toEqual({ expected: 1, partial: true });
  });
  it('does not estimate eligibility from shared, perfect, or conditional kill counts', () => {
    for (const id of ['A3', 'B1', 'C1', 'C2', 'D1', 'E2', 'F3', 'I2', 'I3', 'K1', 'K3', 'M3', 'O3', 'R2']) {
      const tile = allTiles.find(t => t.id === id)!;
      expect(tile.components.every(c => c.sources.every(s => s.mode === 'scenario'))).toBe(true);
      expect(tile.components.every(c => componentEstimate(c, ps).expected === null)).toBe(true);
    }
  });
});
describe('local scenarios', () => {
  it('requires complete, valid assumptions and preserves zero results', () => {
    expect(scenarioExpected({ rolls: 100, probability: .01, quantity: 2 })).toBe(2);
    expect(scenarioExpected({ rolls: 0, probability: .01, quantity: 1 })).toBe(0);
    for (const s of [{ rolls: null, probability: .1, quantity: 1 }, { rolls: 10, probability: 2, quantity: 1 }, { rolls: 1.5, probability: .1, quantity: 1 }, { rolls: 10, probability: .1, quantity: 0 }]) expect(scenarioExpected(s)).toBeNull();
  });
  it('isolates scenarios by competition and tile, recovers corrupt storage, and resets', () => {
    const map = new Map<string, string>(); const storage = { getItem: (key: string) => map.get(key) ?? null };
    map.set(scenarioKey(1, 'D1'), JSON.stringify({ red: { rolls: 100, probability: .1, quantity: 1 } }));
    expect(readScenarios(storage, 1, 'D1').red.rolls).toBe(100);
    expect(readScenarios(storage, 2, 'D1')).toEqual({}); expect(readScenarios(storage, 1, 'D2')).toEqual({});
    map.delete(scenarioKey(1, 'D1')); expect(readScenarios(storage, 1, 'D1')).toEqual({});
    map.set(scenarioKey(1, 'D1'), 'bad JSON'); expect(readScenarios(storage, 1, 'D1')).toEqual({});
  });
});
