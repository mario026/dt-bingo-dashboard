<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import { bossName } from '../catalog.ts';
import { colorFor, number } from '../analytics.ts';
import { modelSources, type TilePrediction } from '../predictions.ts';
import { compareLuck, lootStorageKey, restoreLoot, type LootCounts } from '../luck.ts';
const props = defineProps<{ predictions: TilePrediction[]; teams: string[]; allTeams: string[]; tileIds: string[]; competitionId: number; snapshot: string }>();
const loot = ref<LootCounts>({});
const warning = ref('');
const selected = ref('N1:0:sarachnis');
const storageKey = computed(() => lootStorageKey(props.competitionId, props.snapshot));
watch(storageKey, key => {
  try { loot.value = restoreLoot(localStorage.getItem(key), props.allTeams); }
  catch { loot.value = {}; warning.value = 'Loot counts cannot be saved in this browser.'; }
}, { immediate: true });
watch(loot, value => { try { localStorage.setItem(storageKey.value, JSON.stringify(value)); } catch { warning.value = 'Loot counts will last for this session only.'; } }, { deep: true });
const sources = computed(() => modelSources.filter(s => props.tileIds.includes(s.tileId)).map(s => ({ ...s, label: `${s.tileId} · ${s.component} · ${bossName(s.metric)}` })));
watch(sources, value => { if (!value.some(s => s.key === selected.value)) selected.value = value[0]?.key ?? ''; });
const comparison = computed(() => compareLuck(props.predictions, loot.value, props.teams, props.tileIds));
const bosses = computed(() => [...new Set(sources.value.map(s => s.metric))].map(metric => ({ metric, ...compareLuck(props.predictions, loot.value, props.teams, props.tileIds, metric) })).filter(b => b.common.length || b.inconsistent.length));
function update(team: string, value: number | null) {
  const counts = { ...loot.value[selected.value] };
  if (value !== null && Number.isSafeInteger(value) && value >= 0) counts[team] = value;
  else delete counts[team];
  loot.value = { ...loot.value, [selected.value]: counts };
}
function reset() { loot.value = {}; }
function download() {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ competitionId: props.competitionId, snapshot: props.snapshot, loot: loot.value }, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `competition-${props.competitionId}-observed-loot.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
</script>

<template>
  <section class="panel boss-luck">
    <div class="section-heading"><div><span class="eyebrow">ACTUAL LOOT VS EXPECTATION</span><h2>Driest &amp; most spooned at bosses</h2></div><Button label="Clear loot counts" severity="secondary" size="small" @click="reset" /></div>
    <p class="muted">Wise Old Man records kills, not loot. Enter actual item quantities to measure luck. Kill counts alone cannot tell who was dry or spooned. These rankings cover entered boss-drop categories only, and do not confirm bingo completion.</p>
    <div class="luck-highlights">
      <article><h3>Driest team</h3><strong v-if="comparison.driest.length"><span v-for="team in comparison.driest" :key="team" :style="{ color: colorFor(team) }">{{ team }} </span></strong><p v-else>{{ comparison.rows.length ? 'No comparable team below expectation' : 'Awaiting actual loot counts' }}</p></article>
      <article><h3>Most spooned team</h3><strong v-if="comparison.spooned.length"><span v-for="team in comparison.spooned" :key="team" :style="{ color: colorFor(team) }">{{ team }} </span></strong><p v-else>{{ comparison.rows.length ? 'No comparable team above expectation' : 'Awaiting actual loot counts' }}</p></article>
    </div>
    <p class="footnote">{{ comparison.common.length }} shared categories · current crypt/search and selected-team filters apply. Every compared team needs an explicit count for a category; blank means unknown, 0 means no drops. At least two teams with nonzero model variance are needed for winners.</p>
    <p v-if="comparison.inconsistent.length" role="status" class="warning">{{ comparison.inconsistent.length }} categories excluded: entered drops contradict a zero expectation. Check the loot, kill coverage, and source assumptions.</p>
    <div v-if="comparison.rows.length" class="table-scroll luck-ranking"><table><thead><tr><th>Team</th><th>Actual items</th><th>Expected items</th><th>Actual / expected</th><th>Luck deviation</th><th>Model coverage</th></tr></thead><tbody><tr v-for="row in comparison.rows" :key="row.team"><th :style="{ color: colorFor(row.team) }">{{ row.team }}</th><td>{{ number(row.observed) }}</td><td>{{ number(row.expected, 'expected') }}</td><td>{{ number(row.ratio, 'expected') }}×</td><td>{{ number(row.score, 'expected') }} σ</td><td>{{ row.assumed ? 'Assumption-based' : 'Fixed-rate model' }}{{ row.partial ? ' · partial coverage' : '' }}</td></tr></tbody></table></div>
    <details class="luck-entry"><summary>Enter actual boss drops</summary><p>Use all qualifying items obtained during this export's recorded competition window, including duplicates beyond the tile requirement. Attribute them to the boss that dropped them. For “any piece” categories, enter the combined total of eligible pieces; for bundled drops, count items, not successful events. These entries are local to this browser and this exact export snapshot. A data refresh starts a fresh ledger.</p>
      <Select v-model="selected" :options="sources" option-label="label" option-value="key" filter aria-label="Loot source category" placeholder="Choose a boss drop" class="loot-source-select" />
      <div v-if="selected" class="prediction-inputs"><label v-for="team in teams" :key="team"><span :style="{ color: colorFor(team) }">{{ team }} actual items</span><InputNumber :model-value="loot[selected]?.[team] ?? null" :min="0" :max="Number.MAX_SAFE_INTEGER" :max-fraction-digits="0" :aria-label="`${team} actual loot`" @update:model-value="value => update(team, value)" /></label></div>
      <p v-if="!sources.length" class="empty-state">No boss drop categories match these filters.</p><Button label="Export entered loot" icon="pi pi-download" severity="secondary" size="small" @click="download" /><p v-if="warning" role="status" class="warning">{{ warning }}</p>
    </details>
    <details><summary>Luck calculation and boss comparisons</summary><p>Luck deviation = (actual − expected items) ÷ √variance. Lower values are drier; higher values are more spooned. For each source, expected = eligible kill credits × effective probability × items per drop; compound-Poisson variance = eligible credits × probability × items per drop². Totals sum these quantities across shared entered categories.</p><p class="footnote">This is a descriptive model score, not an exact significance test. It uses the same source assumptions as the predictions below, including shared-loot adjustments and uncertain eligibility. Categories are assumed independent; mutually exclusive drops can violate that assumption. Only tracked bingo-drop categories count, so this is not an all-loot ranking.</p>
      <section v-for="boss in bosses" :key="boss.metric" class="luck-boss"><h3>{{ bossName(boss.metric) }}</h3><p class="muted">Driest: {{ boss.driest.join(', ') || 'Unavailable / none below expectation' }} · Most spooned: {{ boss.spooned.join(', ') || 'Unavailable / none above expectation' }}</p><div class="table-scroll"><table><thead><tr><th>Team</th><th>Actual items</th><th>Expected items</th><th>Actual / expected</th><th>Luck deviation</th></tr></thead><tbody><tr v-for="row in boss.rows" :key="row.team"><th :style="{ color: colorFor(row.team) }">{{ row.team }}</th><td>{{ number(row.observed) }}</td><td>{{ number(row.expected, 'expected') }}</td><td>{{ number(row.ratio, 'expected') }}×</td><td>{{ number(row.score, 'expected') }} σ</td></tr></tbody></table></div></section>
      <p v-if="!bosses.length" class="empty-state">Enter comparable loot counts to see boss-by-boss luck.</p>
    </details>
  </section>
</template>
