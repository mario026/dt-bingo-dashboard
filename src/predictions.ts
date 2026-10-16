import { allTiles, crypts, tileMetrics, wiki, type Tile, type Source } from './catalog.ts';
import { bossValue, colorFor, people, total, validGain, type Person } from './analytics.ts';
import type { ExportResult } from './types.ts';

export interface DropAssumption { probability: number; eligibleFraction: number; quantity: number }
export interface ModelSource extends DropAssumption {
  key: string; tileId: string; component: string; metric: string;
  assumed: boolean; explanation: string; wiki: string;
}
export interface PredictionSettings { unknownAsZero: boolean; overrides: Record<string, DropAssumption> }
const baseline = (probability: number, explanation: string, eligibleFraction = 1, quantity = 1, page?: string) => ({ probability, explanation, eligibleFraction, quantity, page });
// Explicit hypotheses, not inferred raid performance. Wiki rates checked 17 October 2026.
const hypotheses: Record<string, ReturnType<typeof baseline>> = {
  'A3:vardorvis': baseline(3/3264, 'All recorded kills assumed normal mode; any of three Virtus pieces.'),
  'A3:duke_sucellus': baseline(3/2160, 'All recorded kills assumed normal mode; any of three Virtus pieces.'),
  'A3:the_whisperer': baseline(3/1536, 'All recorded kills assumed normal mode; any of three Virtus pieces.'),
  'A3:the_leviathan': baseline(3/2304, 'All recorded kills assumed normal mode; any of three Virtus pieces.'),
  'B1:the_hueycoatl': baseline(1/105/3, 'Assumes three equal contributors: full-contribution wand chance divided by three.'),
  'B3:the_leviathan': baseline(1/206, 'Uses the listed base quartz rate; ignores personal dry protection and awakened kills.'),
  'C1:chambers_of_xeric': baseline(30000/867600*12/60, 'Assumes 30,000 personal points per completion; 1% purple chance per 8,676 points; Ancestral weight 12/60.', 1, 1, 'Ancient chest'),
  'C1:chambers_of_xeric_challenge_mode': baseline(40000/867600*12/56, 'Assumes 40,000 personal points per Challenge Mode completion; Ancestral weight 12/56.', 1, 1, 'Ancient chest'),
  'C2:the_royal_titans': baseline(1/75/2, 'Assumes two equal contributors and half of completions looted for each titan; no sacrifice/page-only rewards.', .5, 1, 'Royal Titans'),
  'D1:araxxor': baseline(1/200, 'Assumes every corpse harvested. Any component counts; the 1/200 chance is used once, not once per piece.'),
  'E2:yama': baseline(3/600/2, 'Assumes equal duo contribution with no contracts; base any-Oathplate chance divided by two.'),
  'F3:doom_of_mokhaiotl': baseline(1/1350, 'Assumes full nine-delve runs: six of nine kills eligible (delves 4–9). Uses minimum eligible rate; no lost rewards.', 6/9),
  'G2:venenatis': baseline(1/512/3, 'Assumes three equal loot shares; personal chance is encounter chance divided by three.'),
  'I2:nex': baseline(3/258/5, 'Assumes five equal contributors and no MVP bonus; any-Torva encounter chance divided by five.'),
  'I3:duke_sucellus': baseline(1/100, 'Assumes 50% perfect kills and seven platelegs per qualifying drop. One drop satisfies the tile.', .5, 7),
  'K1:tombs_of_amascut': baseline(20000/650000*6/24, 'Assumes raid level 200 and 20,000 personal reward points; Masori weight 6/24. Entry runs below level 150 excluded by this hypothesis.', 1, 1, 'Chest (Tombs of Amascut)'),
  'K1:tombs_of_amascut_expert': baseline(25000/450000*6/24, 'Assumes raid level 300 and 25,000 personal reward points; Masori weight 6/24. Higher invocation weights are not assumed.', 1, 1, 'Chest (Tombs of Amascut)'),
  'K3:maggot_king': baseline(1/340, 'Assumes every corpse looted for items rather than taking eggs.'),
  'M2:nightmare': baseline(3/420/5, 'Assumes a five-player party with equal loot shares and one unique roll; any-Inquisitor encounter chance divided by five.'),
  'M3:lunar_chests': baseline(1/56, 'Assumes Blood Moon defeated in every chest. Any Blood Moon equipment piece counts; distinct pieces are not required.', 1, 1, 'Lunar Chest'),
  'N2:zalcano': baseline(1/8000, 'Assumes all recorded completions qualify for an onyx loot roll.'),
  'O1:callisto': baseline(1/512/3, 'Assumes three equal loot shares; personal chance is encounter chance divided by three.'),
  'O3:obor': baseline(1/118, 'Assumes one key-gated reward chest opened per recorded Obor kill.', 1, 1, "Chest (Obor's lair)"),
  'R2:theatre_of_blood': baseline((1/9.1)*(6/19)/4, 'Assumes four equal contributors, no deaths; 1/9.1 team purple chance and current Justiciar weight 6/19.', 1, 1, 'Monumental chest'),
  'R2:theatre_of_blood_hard_mode': baseline((1/7.7)*(6/18)/4, 'Assumes four equal contributors, no deaths; 1/7.7 team purple chance and current Justiciar weight 6/18.', 1, 1, 'Monumental chest'),
};
export const sourceKey = (tile: Tile, componentIndex: number, source: Source) => `${tile.id}:${componentIndex}:${source.metric}`;
export const bossTiles = allTiles.filter(tile => tileMetrics(tile).length > 0);
export const modelSources: ModelSource[] = bossTiles.flatMap(tile => tile.components.flatMap((component, i) => component.sources.map(source => {
  const h = source.mode === 'scenario' ? hypotheses[`${tile.id}:${source.metric}`] : undefined;
  if (source.mode === 'scenario' && !h) throw new Error(`Missing prediction hypothesis: ${tile.id}:${source.metric}`);
  return {
    key: sourceKey(tile, i, source), tileId: tile.id, component: component.name, metric: source.metric,
    probability: h?.probability ?? source.probability!, eligibleFraction: h?.eligibleFraction ?? 1,
    quantity: h?.quantity ?? source.quantity ?? 1, assumed: Boolean(h),
    explanation: h?.explanation ?? `Verified fixed rate: ${source.rate}. ${source.note}`,
    wiki: h?.page ? wiki(h.page) : source.wiki,
  };
})));
export const defaultSettings = (): PredictionSettings => ({ unknownAsZero: true, overrides: {} });
export function validAssumption(s: DropAssumption): boolean {
  return Boolean(s) && validGain(s.probability) && s.probability <= 1 && validGain(s.eligibleFraction) && s.eligibleFraction <= 1 && Number.isInteger(s.quantity) && s.quantity > 0 && s.quantity <= 1000;
}

/** Compound Poisson: a seven-item drop is one successful event, not seven events. */
export function completionChance(events: { mean: number; quantity: number }[], required: number): number {
  if (!Number.isInteger(required) || required < 1 || events.some(e => !validGain(e.mean) || !Number.isInteger(e.quantity) || e.quantity < 1)) throw new Error('Invalid drop distribution');
  const lambda = events.reduce((s, e) => s + e.mean, 0);
  const probabilities = [Math.exp(-lambda)];
  for (let k = 1; k < required; k++) {
    probabilities[k] = events.reduce((s, event) => event.quantity <= k ? s + event.quantity * event.mean * probabilities[k - event.quantity] : s, 0) / k;
  }
  return Math.max(0, Math.min(1, 1 - probabilities.reduce((s, p) => s + p, 0)));
}

export interface SourcePrediction {
  model: ModelSource; input: DropAssumption; kills: number | null; eligible: number | null;
  eventMean: number | null; expected: number | null; partial: boolean; assumed: boolean;
}
export interface ComponentPrediction {
  name: string; required: number; expected: number | null; probability: number | null;
  sources: SourcePrediction[]; missing: boolean; partial: boolean; assumed: boolean;
}
export interface TilePrediction {
  tile: Tile; crypt: string; team: string; components: ComponentPrediction[];
  probability: number | null; expectedPoints: number | null; kills: number | null; ehb: number | null;
  partial: boolean; assumed: boolean; guess: string;
}
function sourcePrediction(model: ModelSource, ps: Person[], settings: PredictionSettings): SourcePrediction {
  const input = settings.overrides[model.key] ?? model;
  let kills = 0; let missing = false; let assumedZero = false;
  for (const p of ps) {
    const n = bossValue(p, model.metric, 'kills');
    if (n !== null) kills += n;
    else {
      const raw = p.status === 'ok' ? p.bosses?.[model.metric] : null;
      if (settings.unknownAsZero && raw && raw.kills.gained === 0 && raw.kills.start < 0 && raw.kills.end < 0) assumedZero = true;
      else missing = true;
    }
  }
  const count = ps.length && !missing ? kills : null;
  const eligible = count !== null && validAssumption(input) ? count * input.eligibleFraction : null;
  const eventMean = eligible === null ? null : eligible * input.probability;
  return { model, input, kills: count, eligible, eventMean, expected: eventMean === null ? null : eventMean * input.quantity,
    partial: missing || assumedZero, assumed: model.assumed || Boolean(settings.overrides[model.key]) || assumedZero };
}
export function predictTile(tile: Tile, team: string, ps: Person[], settings: PredictionSettings): TilePrediction {
  const components = tile.components.map((component, i): ComponentPrediction => {
    const sources = component.sources.map(source => sourcePrediction(modelSources.find(s => s.key === sourceKey(tile, i, source))!, ps, settings));
    const missing = !sources.length || sources.some(s => s.eventMean === null);
    const available = sources.filter(s => s.eventMean !== null);
    return { name: component.name, required: component.required, sources, missing,
      expected: available.length ? available.reduce((s, e) => s + e.expected!, 0) : null,
      probability: missing ? null : completionChance(sources.map(s => ({ mean: s.eventMean!, quantity: s.input.quantity })), component.required),
      partial: missing || sources.some(s => s.partial), assumed: sources.some(s => s.assumed) };
  });
  const probability = components.some(c => c.probability === null) ? null : components.reduce((s, c) => s * c.probability!, 1);
  return { tile, team, components, probability, expectedPoints: probability === null ? null : probability * tile.points,
    crypt: crypts.find(c => c.tiles.some(t => t.id === tile.id))!.name,
    kills: total(ps, 'kills', tileMetrics(tile)), ehb: total(ps, 'ehb', tileMetrics(tile)),
    partial: components.some(c => c.partial), assumed: components.some(c => c.assumed),
    guess: probability === null ? 'Insufficient data' : probability >= .8 ? 'Likely finished' : probability >= .5 ? 'Leaning finished' : probability >= .2 ? 'Uncertain' : 'Unlikely finished' };
}
export function predictCompetition(data: ExportResult, settings: PredictionSettings = defaultSettings()): TilePrediction[] {
  const ps = people(data);
  return bossTiles.flatMap(tile => data.teams.map(team => {
    const name = team.name ?? 'No team'; return predictTile(tile, name, ps.filter(p => p.team === name), settings);
  }));
}
export function leaderboard(data: ExportResult, predictions: TilePrediction[], tileIds = bossTiles.map(t => t.id)) {
  // Every team is ranked on the same complete set, even when comparison columns are hidden.
  const comparable = tileIds.filter(id => data.teams.every(t => predictions.some(p => p.team === (t.name ?? 'No team') && p.tile.id === id && p.probability !== null)));
  const possiblePoints = bossTiles.filter(t => comparable.includes(t.id)).reduce((s, t) => s + t.points, 0);
  const ps = people(data);
  const rows = data.teams.map(team => {
    const name = team.name ?? 'No team'; const own = predictions.filter(p => p.team === name && comparable.includes(p.tile.id));
    return { team: name, color: colorFor(name), score: own.length ? own.reduce((s, p) => s + p.expectedPoints!, 0) : null,
      expectedTiles: own.length ? own.reduce((s, p) => s + p.probability!, 0) : null,
      likely: own.filter(p => p.probability! >= .5).length, assessed: own.length, possiblePoints,
      kills: total(ps.filter(p => p.team === name), 'kills'), ehb: total(ps.filter(p => p.team === name), 'ehb') };
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.team.localeCompare(b.team));
  return rows.map(row => ({ ...row, rank: row.score === null ? null : 1 + rows.filter(other => other.score !== null && other.score > row.score!).length }));
}
export const predictionStorageKey = (id: number) => `darkturbo:results:v1:${id}`;
export function restoreSettings(raw: string | null): PredictionSettings {
  try {
    const parsed = JSON.parse(raw ?? '{}');
    if (!parsed || typeof parsed !== 'object') return defaultSettings();
    const overrides = Object.fromEntries(Object.entries(parsed.overrides ?? {}).filter(([key, input]) => modelSources.some(s => s.key === key) && validAssumption(input as DropAssumption)));
    return { unknownAsZero: typeof parsed.unknownAsZero === 'boolean' ? parsed.unknownAsZero : true, overrides: overrides as Record<string, DropAssumption> };
  } catch { return defaultSettings(); }
}
