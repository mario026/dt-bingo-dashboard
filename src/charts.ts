import type { EChartsOption } from 'echarts';
import { number, total, value, bossValue, type Person, type Metric } from './analytics.ts';
import { bossName } from './catalog.ts';
const axis = { axisLine: { lineStyle: { color: '#33413b' } }, axisLabel: { color: '#a7b7af' }, splitLine: { lineStyle: { color: '#25332c' } } };
export function bars(labels: string[], values: (number | null)[], colors: string[], metric: Metric | 'expected'): EChartsOption {
  return { grid: { left: 125, right: 40, top: 15, bottom: 25 }, tooltip: { trigger: 'axis', valueFormatter: n => number(Number(n), metric) }, xAxis: { type: 'value', ...axis }, yAxis: { type: 'category', inverse: true, data: labels, ...axis, axisLabel: { color: '#c9d4cd', width: 112, overflow: 'truncate' } }, series: [{ type: 'bar', barMaxWidth: 22, data: values.map((n, i) => ({ value: n, itemStyle: { color: colors[i], borderRadius: [0, 5, 5, 0] } })) }] };
}
export function scatter(ps: Person[], keys?: string[]): EChartsOption {
  const points = ps.flatMap(player => {
    const kills = value(player, 'kills', keys);
    const ehb = value(player, 'ehb', keys);
    return kills === null || ehb === null ? [] : [{ player, kills, ehb }];
  });
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const series: EChartsOption['series'] = [...new Set(ps.map(p => p.team))].map(team => ({
    type: 'scatter', name: team, symbolSize: 11,
    itemStyle: { color: ps.find(p => p.team === team)!.color, opacity: .85 },
    data: points.filter(point => point.player.team === team).map(({ player, kills, ehb }) => ({ name: player.player.displayName, value: [kills, ehb] })),
  }));
  if (points.length) {
    const kills = median(points.map(point => point.kills));
    const ehb = median(points.map(point => point.ehb));
    series.push({
      type: 'scatter', data: [], silent: true, tooltip: { show: false },
      markLine: {
        silent: true, symbol: 'none', lineStyle: { type: 'dashed', width: 1.5, color: '#d9b77d' },
        label: { position: 'insideEndTop', color: '#ecdfc4', backgroundColor: '#17211c', padding: [4, 6], borderRadius: 3, fontSize: 10 },
        data: [
          { xAxis: kills, label: { formatter: `Median KC: ${number(kills, Number.isInteger(kills) ? 'kills' : 'expected')}` } },
          { yAxis: ehb, label: { formatter: `Median EHB: ${number(ehb, 'ehb')}` } },
        ],
      },
    });
  }
  return { grid: { left: 65, right: 30, top: 45, bottom: 50 }, tooltip: { trigger: 'item', renderMode: 'richText' }, legend: { textStyle: { color: '#b1c1b8' }, top: 0 }, xAxis: { type: 'value', name: 'Recorded kills', nameLocation: 'middle', nameGap: 30, ...axis }, yAxis: { type: 'value', name: 'Gained EHB', ...axis }, series };
}
export function heatmap(ps: Person[], keys: string[], metric: Metric): EChartsOption {
  const cells = ps.flatMap((p, i) => keys.map((k, j) => [j, i, bossValue(p, k, metric)]).filter(c => c[2] !== null));
  return { grid: { left: 115, right: 15, top: 15, bottom: 135 }, tooltip: { position: 'top', renderMode: 'richText' }, xAxis: { type: 'category', data: keys.map(bossName), axisLabel: { color: '#a7b7af', rotate: 45, width: 90, overflow: 'truncate' }, splitArea: { show: true } }, yAxis: { type: 'category', data: ps.map(p => p.player.displayName), axisLabel: { color: (name?: string | number) => ps.find(p => p.player.displayName === name)?.color ?? '#fff' } }, visualMap: { min: 0, max: Math.max(1, ...cells.map(c => c[2] as number)), calculable: true, orient: 'horizontal', left: 'center', bottom: 0, textStyle: { color: '#a7b7af' }, inRange: { color: ['#172720', '#2b7156', '#e9b96b'] } }, series: [{ type: 'heatmap', data: cells as number[][], emphasis: { itemStyle: { borderColor: '#fff', borderWidth: 1 } } }] };
}
export const sortedBosses = (ps: Person[], keys: string[], metric: Metric) => [...keys].sort((a, b) => (total(ps, metric, [b]) ?? -1) - (total(ps, metric, [a]) ?? -1));
