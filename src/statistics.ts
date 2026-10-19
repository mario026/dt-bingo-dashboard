import { bossKeys, bossValue, people, validGain, value, type Person } from './analytics.ts';
import { bossName } from './catalog.ts';
import type { ExportResult } from './types.ts';

export type Statistic = 'kills' | 'ehb' | 'xp';
export function statisticValue(player: Person, metric: Statistic, boss?: string): number | null {
  if (metric !== 'xp') return boss ? bossValue(player, boss, metric) : value(player, metric);
  const xp = player.overallExperience?.gained;
  return player.status === 'ok' && validGain(xp) ? xp : null;
}
export function summarize(players: Person[], metric: Statistic, boss?: string) {
  const values = players.map(player => statisticValue(player, metric, boss));
  const known = values.filter((n): n is number => n !== null);
  return { value: known.length ? known.reduce((sum, n) => sum + n, 0) : null, available: known.length, players: players.length };
}
export function competitionStatistics(data: ExportResult) {
  const players = people(data);
  const order = ['Team Groen', 'Team Blauw', 'Team rood', 'Team Oranje', 'Team Geel'];
  const teams = data.teams.map(team => team.name ?? 'No team').sort((a, b) => {
    const ai = order.indexOf(a); const bi = order.indexOf(b);
    return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi) || a.localeCompare(b);
  });
  function row(id: string, label: string, metric: Statistic, boss?: string) {
    const contributions = players.map(player => ({ name: player.player.displayName, value: statisticValue(player, metric, boss) }));
    const known = contributions.filter((entry): entry is { name: string; value: number } => entry.value !== null);
    const best = known.length ? Math.max(...known.map(entry => entry.value)) : null;
    return { id, label, metric, teams: teams.map(team => summarize(players.filter(player => player.team === team), metric, boss)),
      total: summarize(players, metric, boss), best: best !== null && best > 0 ? best : null,
      leaders: best !== null && best > 0 ? known.filter(entry => entry.value === best).map(entry => entry.name) : [] };
  }
  return { teams, summary: [row('kills', 'Total kills / completions', 'kills'), row('ehb', 'EHB', 'ehb'), row('xp', 'XP (million)', 'xp')],
    bosses: bossKeys(data).sort((a, b) => bossName(a).localeCompare(bossName(b))).map(key => row(key, bossName(key), 'kills', key)) };
}
