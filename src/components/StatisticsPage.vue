<script setup lang="ts">
import { computed, ref } from 'vue';
import InputText from 'primevue/inputtext';
import { colorFor } from '../analytics.ts';
import { competitionStatistics, type Statistic } from '../statistics.ts';
import type { ExportResult } from '../types.ts';
const props = defineProps<{ dataset: ExportResult }>();
const search = ref('');
const activeOnly = ref(false);
const statistics = computed(() => competitionStatistics(props.dataset));
const rows = computed(() => statistics.value.bosses.filter(row => row.label.toLowerCase().includes(search.value.trim().toLowerCase()) && (!activeOnly.value || (row.total.value ?? 0) > 0)));
const format = (value: number | null, metric: Statistic) => value === null ? '—' : new Intl.NumberFormat('nl-NL', { minimumFractionDigits: metric === 'kills' ? 0 : 2, maximumFractionDigits: metric === 'kills' ? 0 : 2 }).format(metric === 'xp' ? value / 1_000_000 : value);
const coverage = (cell: { available: number; players: number }) => `${cell.available}/${cell.players} players with available data`;
</script>

<template>
  <section class="panel statistics-page" aria-labelledby="statistics-title">
    <div class="section-heading"><div><span class="eyebrow">COMPETITION TOTALS</span><h2 id="statistics-title">Bosses, EHB &amp; XP per team</h2><p class="muted">All competition gains in one overview, with the leading individual for each stat.</p></div></div>
    <div class="statistics-controls"><InputText v-model="search" placeholder="Find a boss…" aria-label="Search statistics bosses" /><label class="toggle-label"><input v-model="activeOnly" type="checkbox"> Only bosses with kills</label><span class="muted">{{ rows.length }} / {{ statistics.bosses.length }} bosses</span></div>
    <p class="footnote">XP is total gained XP divided by 1,000,000. EHB and total kills cover all bosses, including those hidden by search. * = partial player coverage; — = unavailable. Hover over a value to see coverage.</p>
    <div class="table-scroll statistics-table" tabindex="0" role="region" aria-label="Team statistics table, scroll horizontally for all columns">
      <table>
        <thead><tr><th scope="col">Stat / boss</th><th v-for="team in statistics.teams" :key="team" scope="col" :style="{ color: colorFor(team) }">{{ team.replace(/^Team /i, '') }}</th><th scope="col" class="statistics-total">Total</th><th scope="col">Individual leader</th><th scope="col">Amount</th></tr></thead>
        <tbody>
          <tr v-for="row in [...statistics.summary, ...rows]" :key="row.id" :class="{ 'statistics-summary': ['kills', 'ehb', 'xp'].includes(row.id) }" :data-stat="row.id">
            <th scope="row">{{ row.label }}</th>
            <td v-for="(cell, index) in row.teams" :key="statistics.teams[index]" :title="coverage(cell)">{{ format(cell.value, row.metric) }}<sup v-if="cell.value !== null && cell.available < cell.players" aria-label="partial coverage">*</sup></td>
            <td class="statistics-total" :title="coverage(row.total)">{{ format(row.total.value, row.metric) }}<sup v-if="row.total.value !== null && row.total.available < row.total.players" aria-label="partial coverage">*</sup></td>
            <td class="statistics-leaders">{{ row.leaders.join(' / ') || '—' }}</td><td>{{ format(row.best, row.metric) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="!rows.length" class="empty-state">No bosses match these filters.</p>
    </div>
  </section>
</template>
