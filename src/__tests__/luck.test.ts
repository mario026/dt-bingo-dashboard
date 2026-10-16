import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { predictCompetition, type TilePrediction } from '../predictions.ts';
import { compareLuck, lootStorageKey, restoreLoot } from '../luck.ts';
import type { ExportResult } from '../types.ts';
const data = JSON.parse(readFileSync(new URL('../../output/competition-160537-bosses.json', import.meta.url), 'utf8')) as ExportResult;
const original = predictCompetition(data).find(p => p.tile.id === 'N1')!;
const key = 'N1:0:sarachnis';
function fixture(mean = 2, quantity = 1): TilePrediction[] {
  return ['A', 'B', 'C'].map(team => {
    const p = structuredClone(original); p.team = team;
    p.components[0].sources[0].eventMean = mean;
    p.components[0].sources[0].expected = mean * quantity;
    p.components[0].sources[0].input.quantity = quantity;
    return p;
  });
}
describe('observed boss loot comparisons', () => {
  it('does not infer luck from KC or absent loot', () => {
    expect(compareLuck(fixture(), {}, ['A', 'B'], ['N1']).rows).toEqual([]);
    expect(compareLuck(fixture(), { [key]: { A: 0 } }, ['A', 'B'], ['N1']).common).toEqual([]);
  });
  it('recognizes explicit zero and ranks negative and positive deviations', () => {
    const result = compareLuck(fixture(), { [key]: { A: 0, B: 5, C: 2 } }, ['A', 'B', 'C'], ['N1']);
    expect(result.driest).toEqual(['A']); expect(result.spooned).toEqual(['B']);
    expect(result.rows[0].score).toBeCloseTo(3 / Math.sqrt(2));
    expect(result.rows[0].ratio).toBe(2.5);
  });
  it('does not name a driest team above expectation or a spooned team below it', () => {
    expect(compareLuck(fixture(), { [key]: { A: 3, B: 4 } }, ['A', 'B'], ['N1']).driest).toEqual([]);
    expect(compareLuck(fixture(), { [key]: { A: 0, B: 1 } }, ['A', 'B'], ['N1']).spooned).toEqual([]);
    expect(compareLuck(fixture(), { [key]: { A: 0 } }, ['A'], ['N1']).driest).toEqual([]);
  });
  it('preserves ties and compound-event variance for bundled item quantities', () => {
    const result = compareLuck(fixture(2, 7), { [key]: { A: 0, B: 0, C: 21 } }, ['A', 'B', 'C'], ['N1']);
    expect(result.driest).toEqual(['A', 'B']);
    expect(result.rows[0].expected).toBe(14);
    expect(result.rows[0].variance).toBe(98);
    expect(result.rows[0].score).toBeCloseTo(7 / Math.sqrt(98));
  });
  it('excludes missing models, invalid counts, unmatched filters and contradictory zero means', () => {
    const loot = { [key]: { A: 0, B: 1 } };
    expect(compareLuck(fixture(0), loot, ['A', 'B'], ['N1']).inconsistent).toEqual([key]);
    expect(compareLuck(fixture(0), loot, ['A', 'B'], ['N1']).rows).toEqual([]);
    expect(compareLuck(fixture(0), { [key]: { A: 0, B: 0 } }, ['A', 'B'], ['N1']).rows).toEqual([]);
    const missing = fixture(); missing[0].components[0].sources[0].eventMean = null;
    expect(compareLuck(missing, loot, ['A', 'B'], ['N1']).rows).toEqual([]);
    expect(compareLuck(fixture(), { [key]: { A: -1, B: 1 } }, ['A', 'B'], ['N1']).rows).toEqual([]);
    expect(compareLuck(fixture(), loot, ['A', 'B'], ['C3']).rows).toEqual([]);
    expect(compareLuck(fixture(), loot, ['A', 'B'], ['N1'], 'kraken').rows).toEqual([]);
  });
  it('sums independent source means and variances on a shared set only', () => {
    const second = fixture(1).map(p => {
      p.components[0].sources[0].model.key = 'extra';
      p.components[0].sources[0].model.metric = 'kraken';
      return p;
    });
    const result = compareLuck([...fixture(), ...second], { [key]: { A: 0, B: 5 }, extra: { A: 1, B: 2 } }, ['A', 'B'], ['N1']);
    expect(result.rows[0].expected).toBe(3); expect(result.rows[0].variance).toBe(3);
    expect(result.rows[0].observed).toBe(7); expect(result.common).toHaveLength(2);
  });
  it('validates saved loot and isolates competition snapshots', () => {
    expect(restoreLoot(JSON.stringify({ [key]: { A: 0, B: 2, C: -1, D: 1.5, E: '2', Unknown: 3 }, bad: { A: 1 } }), ['A', 'B', 'C', 'D', 'E'])).toEqual({ [key]: { A: 0, B: 2 } });
    for (const value of ['null', '[]', '{broken']) expect(restoreLoot(value, ['A'])).toEqual({});
    expect(lootStorageKey(1, 'today')).not.toBe(lootStorageKey(1, 'tomorrow'));
    expect(lootStorageKey(1, 'today')).not.toBe(lootStorageKey(2, 'today'));
  });
});
