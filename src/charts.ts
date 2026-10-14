import type { EChartsOption } from 'echarts';
import { number, total, value, bossValue, type Person, type Metric } from './analytics.ts';
import { bossName } from './catalog.ts';
const axis = { axisLine: { lineStyle: { color: '#33413b' } }, axisLabel: { color: '#a7b7af' }, splitLine: { lineStyle: { color: '#25332c' } } };
export function bars(labels: string[], values: (number | null)[], colors: string[], metric: Metric): EChartsOption {
  return { grid: { left: 125, right: 40, top: 15, bottom: 25 }, tooltip: { trigger: 'axis', valueFormatter: n => number(Number(n), metric) }, xAxis: { type: 'value', ...axis }, yAxis: { type: 'category', inverse: true, data: labels, ...axis, axisLabel: { color: '#c9d4cd', width: 112, overflow: 'truncate' } }, series: [{ type: 'bar', barMaxWidth: 22, data: values.map((n, i) => ({ value: n, itemStyle: { color: colors[i], borderRadius: [0, 5, 5, 0] } })) }] };
}
export function scatter(ps: Person[], keys?: string[]): EChartsOption {
  return { grid: { left: 65, right: 30, top: 45, bottom: 50 }, tooltip: { trigger: 'item', renderMode: 'richText' }, legend: { textStyle: { color: '#b1c1b8' }, top: 0 }, xAxis: { type: 'value', name: 'Recorded kills', nameLocation: 'middle', nameGap: 30, ...axis }, yAxis: { type: 'value', name: 'Gained EHB', ...axis }, series: [...new Set(ps.map(p => p.team))].map(team => ({ type: 'scatter', name: team, symbolSize: 11, itemStyle: { color: ps.find(p => p.team === team)!.color, opacity: .85 }, data: ps.filter(p => p.team === team && value(p, 'kills', keys) !== null && value(p, 'ehb', keys) !== null).map(p => ({ name: p.player.displayName, value: [value(p, 'kills', keys)!, value(p, 'ehb', keys)!] })) })) };
}
export function heatmap(ps: Person[], keys: string[], metric: Metric): EChartsOption {
  const cells = ps.flatMap((p, i) => keys.map((k, j) => [j, i, bossValue(p, k, metric)]).filter(c => c[2] !== null));
  return { grid: { left: 115, right: 15, top: 15, bottom: 135 }, tooltip: { position: 'top', renderMode: 'richText' }, xAxis: { type: 'category', data: keys.map(bossName), axisLabel: { color: '#a7b7af', rotate: 45, width: 90, overflow: 'truncate' }, splitArea: { show: true } }, yAxis: { type: 'category', data: ps.map(p => p.player.displayName), axisLabel: { color: (name?: string | number) => ps.find(p => p.player.displayName === name)?.color ?? '#fff' } }, visualMap: { min: 0, max: Math.max(1, ...cells.map(c => c[2] as number)), calculable: true, orient: 'horizontal', left: 'center', bottom: 0, textStyle: { color: '#a7b7af' }, inRange: { color: ['#172720', '#2b7156', '#e9b96b'] } }, series: [{ type: 'heatmap', data: cells as number[][], emphasis: { itemStyle: { borderColor: '#fff', borderWidth: 1 } } }] };
}
export const sortedBosses = (ps: Person[], keys: string[], metric: Metric) => [...keys].sort((a, b) => (total(ps, metric, [b]) ?? -1) - (total(ps, metric, [a]) ?? -1));
