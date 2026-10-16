<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import SelectButton from 'primevue/selectbutton';
import MultiSelect from 'primevue/multiselect';
import { bossName, crypts, type Tile } from '../catalog.ts';
import { colorFor, number, date } from '../analytics.ts';
import { bossTiles, defaultSettings, leaderboard, modelSources, predictCompetition, predictionStorageKey, restoreSettings, type ModelSource, type TilePrediction } from '../predictions.ts';
import type { ExportResult } from '../types.ts';
import { bars } from '../charts.ts';
import WikiImage from './WikiImage.vue';
import BossLuck from './BossLuck.vue';
const InsightChart = defineAsyncComponent(() => import('./InsightChart.vue'));
const props = defineProps<{ dataset: ExportResult }>();
defineEmits<{ tile: [tile: Tile] }>();
const settings = ref(defaultSettings());
const storageWarning = ref('');
const search = ref('');
const crypt = ref<string | null>(null);
const teamNames = computed(() => props.dataset.teams.map(t => t.name ?? 'No team'));
const selectedTeams = ref<string[]>([]);
const selectedTile = ref('N1');
const detailSection = ref<HTMLElement>();
const comparisonMetric = ref<'probability' | 'expectedPoints' | 'drops'>('probability');
const metricOptions = [{ label: 'Completion chance', value: 'probability' }, { label: 'Expected points', value: 'expectedPoints' }, { label: 'Expected drops', value: 'drops' }];
watch(() => props.dataset.competition.id, id => {
  try { settings.value = restoreSettings(localStorage.getItem(predictionStorageKey(id))); }
  catch { settings.value = defaultSettings(); storageWarning.value = 'Assumptions will last for this session only; browser storage is unavailable.'; }
  selectedTeams.value = [...teamNames.value];
}, { immediate: true });
watch(settings, v => {
  try { localStorage.setItem(predictionStorageKey(props.dataset.competition.id), JSON.stringify(v)); }
  catch { storageWarning.value = 'Could not save assumptions in this browser.'; }
}, { deep: true });
const predictions = computed(() => predictCompetition(props.dataset, settings.value));
const visibleTiles = computed(() => bossTiles.filter(tile => (!crypt.value || crypts.find(c => c.name === crypt.value)!.tiles.some(t => t.id === tile.id)) && `${tile.id} ${tile.name} ${tile.requirement}`.toLowerCase().includes(search.value.toLowerCase())));
const ranking = computed(() => leaderboard(props.dataset, predictions.value, visibleTiles.value.map(t => t.id)));
const comparedTeams = computed(() => teamNames.value.filter(t => selectedTeams.value.includes(t)));
const visibleRanking = computed(() => ranking.value.filter(t => comparedTeams.value.includes(t.team)));
const activeTile = computed(() => bossTiles.find(t => t.id === selectedTile.value) ?? bossTiles[0]);
const activePredictions = computed(() => comparedTeams.value.map(team => prediction(activeTile.value.id, team)));
const activeSources = computed(() => modelSources.filter(s => s.tileId === activeTile.value.id));
const selectedRow = computed(() => predictions.value.find(p => p.tile.id === activeTile.value.id));
const chart = computed(() => ({ ...bars(visibleRanking.value.map(t => t.team), visibleRanking.value.map(t => t.score), visibleRanking.value.map(t => t.color), 'expected'), animation: false }));
function prediction(id: string, team: string): TilePrediction { return predictions.value.find(p => p.tile.id === id && p.team === team)!; }
const percent = (p: number | null) => p === null ? '—' : `${number(p * 100, 'expected')}%`;
async function chooseTile(id: string) {
  selectedTile.value = id;
  await nextTick();
  detailSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function input(model: ModelSource, field: 'probability' | 'eligibleFraction' | 'quantity') {
  const value = (settings.value.overrides[model.key] ?? model)[field];
  return Number.isFinite(value) ? value : null;
}
function update(model: ModelSource, field: 'probability' | 'eligibleFraction' | 'quantity', value: number | null) {
  settings.value.overrides[model.key] = { ...(settings.value.overrides[model.key] ?? { probability: model.probability, eligibleFraction: model.eligibleFraction, quantity: model.quantity }), [field]: value ?? NaN };
}
function reset() {
  settings.value = defaultSettings();
  try { localStorage.removeItem(predictionStorageKey(props.dataset.competition.id)); } catch { /* Session reset still works. */ }
}
function download() {
  const content = { generatedAt: new Date().toISOString(), dataAsOf: props.dataset.generatedAt, competitionId: props.dataset.competition.id,
    method: 'Compound Poisson drop counts; independent components; same-tile-set probability-weighted points. Predictions only; no confirmed loot or unlocks.',
    settings: settings.value, modelSources, leaderboard: ranking.value, predictions: predictions.value };
  const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `competition-${props.dataset.competition.id}-predictions.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
</script>

<template>
  <div class="results-page">
    <section class="prediction-banner"><div><span class="eyebrow">PREDICTED RESULTS · NOT CONFIRMED LOOT</span><h2>Who is ahead on drop potential?</h2><p>Completion chances use the recorded kills and the drops required for each tile. Predicted points = tile points × the chance of obtaining <em>all</em> required components.</p><p>Data as of {{ date(dataset.generatedAt) }} · {{ dataset.interim ? 'competition still in progress' : 'competition export' }}. No future kills are projected. Crypt unlocks, non-boss tiles, and actual loot are not included.</p></div><Button label="Export predictions" icon="pi pi-download" severity="secondary" size="small" @click="download" /></section>
    <div class="filters panel results-filters"><div class="filter-controls"><Select v-model="crypt" :options="[{ label: 'All crypts', value: null }, ...crypts.map(c => ({ label: `${c.name}'s Crypt`, value: c.name }))]" option-label="label" option-value="value" aria-label="Results crypt filter" placeholder="All crypts" /><InputText v-model="search" placeholder="Find a tile or item…" aria-label="Search Results tiles" /></div><MultiSelect v-model="selectedTeams" :options="teamNames" :max-selected-labels="1" selected-items-label="{0} teams compared" placeholder="Choose teams to compare" aria-label="Results teams to compare" /></div>
    <div class="section-heading"><div><h2>Predicted leaderboard</h2><p class="muted">{{ ranking[0]?.assessed ?? 0 }} comparable tiles · {{ ranking[0]?.possiblePoints ?? 0 }} possible points · current crypt/search filters apply. Ranks always compare all teams on the same tiles.</p></div><Button label="Reset assumptions" icon="pi pi-refresh" severity="secondary" size="small" @click="reset" /></div>
    <div v-if="!comparedTeams.length" class="empty-state">Select at least one team to compare.</div>
    <section v-else class="prediction-leaders"><article v-for="row in visibleRanking" :key="row.team" class="prediction-leader" :style="{ '--team-color': row.color }"><div><span class="leader-rank">#{{ row.rank ?? '—' }}</span><strong>{{ row.team }}</strong></div><span class="predicted-score">{{ number(row.score, 'expected') }}<small>predicted points</small></span><p>{{ number(row.expectedTiles, 'expected') }} expected completed tiles</p><p>{{ row.likely }} tiles leaning/likely finished (≥50%)</p><footer><span>{{ number(row.kills) }} kills</span><span>{{ number(row.ehb, 'ehb') }} EHB</span></footer></article></section>
    <section v-if="visibleRanking.length" class="panel"><div class="section-heading"><h3>Probability-weighted tile points</h3><span class="chart-tag">BOSS-DROP POTENTIAL</span></div><InsightChart :option="chart" label="Predicted leaderboard by probability-weighted tile points" :height="280" /></section>
    <details class="panel prediction-method"><summary>How these predictions work and what is assumed</summary><p>Expected drop quantities are not proof of completion. The model approximates rare drop events with a compound Poisson distribution, then multiplies component completion chances. This assumes independent components and pooled team drops; shared loot, exclusive drops, and game-specific protections can differ.</p><p>All components must be tracked to score a whole tile. Partial tiles remain visible but contribute no predicted points. A tile is scored only if it can be estimated for every team. A ≥50% chance is “leaning finished”; ≥80% is “likely finished”. These labels do not confirm that a tile was unlocked or submitted.</p><p>Conditional sources use editable baseline hypotheses, shared across teams: normal DT2 kills; equal group contributions; assumed raid points/invocations; corpse loot choices; 50% perfect Duke kills; and an assumed eligible delve mix. Open a tile below to see each exact default and its Wiki source. Editing any source creates a custom scenario. Crafting supplies are assumed available; predictions concern rare-drop requirements. EHB is context, not a multiplier in drop calculations.</p><label class="toggle-label"><input v-model="settings.unknownAsZero" type="checkbox"> Assume unranked records with zero gained kills represent zero competition kills</label><p class="footnote">Enabled by default only for this predictive view. Unknown boundaries are flagged as partial coverage; missing/failed player records remain unavailable. Turn this off for strict coverage. Assumptions are stored locally per competition and do not alter the data or the Bingo page's fixed-rate estimates.</p><p v-if="storageWarning" role="status" class="warning">{{ storageWarning }}</p></details>

    <BossLuck :predictions="predictions" :teams="comparedTeams" :all-teams="teamNames" :tile-ids="visibleTiles.map(t => t.id)" :competition-id="dataset.competition.id" :snapshot="dataset.generatedAt" />

    <section class="panel prediction-comparison"><div class="section-heading"><div><h2>Every boss tile, side by side</h2><p class="muted">{{ visibleTiles.length }} of {{ bossTiles.length }} boss tiles · click a cell for component and source details</p></div><SelectButton v-model="comparisonMetric" :options="metricOptions" option-label="label" option-value="value" :allow-empty="false" aria-label="Results comparison metric" /></div>
      <div v-if="!visibleTiles.length" class="empty-state">No boss tiles match these filters.</div>
      <div v-else class="table-scroll prediction-matrix"><table><thead><tr><th>Tile / requirements</th><th v-for="team in comparedTeams" :key="team" :style="{ color: colorFor(team) }">{{ team }}</th></tr></thead><tbody><tr v-for="entry in visibleTiles" :key="entry.id" :class="{ 'active-prediction': activeTile.id === entry.id }"><th><button class="prediction-tile-label" @click="chooseTile(entry.id)"><WikiImage :title="entry.icon" :size="30" /><span><small>{{ entry.id }} · {{ entry.points }} pts</small>{{ entry.name }}<em>{{ entry.requirement }}</em></span></button></th><td v-for="team in comparedTeams" :key="team"><button class="prediction-cell" :aria-label="`${entry.id} ${team} prediction`" :style="{ '--team-color': colorFor(team) }" @click="chooseTile(entry.id)">
          <template v-if="comparisonMetric === 'drops'"><span v-for="component in prediction(entry.id, team).components" :key="component.name" class="expected-component"><strong>{{ number(component.expected, 'expected') }} / {{ component.required }}</strong><small>{{ component.name }}{{ component.missing ? ' · partial/unavailable' : '' }}</small></span></template>
          <template v-else><strong>{{ comparisonMetric === 'probability' ? percent(prediction(entry.id, team).probability) : number(prediction(entry.id, team).expectedPoints, 'expected') }}</strong><span>{{ prediction(entry.id, team).guess }}</span></template>
          <small>{{ prediction(entry.id, team).assumed ? 'Assumption-based' : 'Fixed-rate model' }}{{ prediction(entry.id, team).partial ? ' · partial coverage' : '' }}</small>
        </button></td></tr></tbody></table></div>
    </section>

    <section v-if="activeTile && comparedTeams.length" ref="detailSection" class="panel prediction-detail"><div class="section-heading"><div class="item-intro"><WikiImage :title="activeTile.icon" :size="50" /><div><span class="eyebrow">{{ activeTile.id }} · {{ activeTile.points }} POINTS</span><h2>{{ activeTile.name }}</h2><p class="muted">{{ activeTile.requirement }}</p></div></div><Button label="Open boss data" icon="pi pi-arrow-up-right" severity="secondary" size="small" @click="$emit('tile', activeTile)" /></div>
      <div class="table-scroll"><table><thead><tr><th>Team</th><th>Source kill credits</th><th>Source EHB</th><th>Completion chance</th><th>Predicted points</th><th>Guess</th></tr></thead><tbody><tr v-for="result in activePredictions" :key="result.team"><th :style="{ color: colorFor(result.team) }">{{ result.team }}</th><td>{{ number(result.kills) }}</td><td>{{ number(result.ehb, 'ehb') }}</td><td>{{ percent(result.probability) }}</td><td>{{ number(result.expectedPoints, 'expected') }}</td><td>{{ result.guess }}</td></tr></tbody></table></div>
      <section v-for="(component, ci) in selectedRow?.components ?? []" :key="component.name" class="prediction-component"><div class="section-heading"><h3>{{ component.name }}</h3><span class="chart-tag">REQUIRED {{ component.required }}</span></div><p v-if="!component.sources.length" class="no-data">no data provided for this tile — this component is untracked, so the whole tile cannot be predicted.</p><div class="table-scroll"><table><thead><tr><th>Team</th><th>Expected quantity</th><th>Required quantity</th><th>Chance of enough drops</th><th>Coverage</th></tr></thead><tbody><tr v-for="result in activePredictions" :key="result.team"><th :style="{ color: colorFor(result.team) }">{{ result.team }}</th><td>{{ number(result.components[ci].expected, 'expected') }}</td><td>{{ component.required }}</td><td>{{ percent(result.components[ci].probability) }}</td><td>{{ result.components[ci].missing ? 'Missing required data' : result.components[ci].partial ? 'Contains unranked boundaries' : 'Available' }}</td></tr></tbody></table></div></section>
      <details class="prediction-assumptions"><summary>Inspect or edit this tile's source assumptions</summary><p class="muted">Probability is per eligible recorded player credit (0–1), including contribution adjustments. Eligible fraction is the share of those credits that qualifies (0–1). Settings apply equally to every team. Fixed sources can also be overridden.</p>
        <section v-for="model in activeSources" :key="model.key" class="source-row"><div><strong>{{ model.component }} · {{ bossName(model.metric) }}</strong><a :href="model.wiki" target="_blank" rel="noopener noreferrer">Wiki source <i class="pi pi-external-link"></i></a></div><p>{{ model.explanation }}</p><p class="footnote">{{ model.assumed ? 'Conditional-rate baseline hypothesis' : 'Verified fixed-rate baseline' }} · default effective chance {{ (model.probability * 100).toPrecision(5) }}% · default eligible share {{ number(model.eligibleFraction * 100, 'expected') }}% · {{ model.quantity }} items/drop</p>
          <div class="prediction-inputs"><label><span>Drop probability (0–1)</span><InputNumber :model-value="input(model, 'probability')" @update:model-value="v => update(model, 'probability', v)" :min="0" :max="1" :max-fraction-digits="10" :aria-label="`${model.key} probability`" /></label><label><span>Eligible fraction (0–1)</span><InputNumber :model-value="input(model, 'eligibleFraction')" @update:model-value="v => update(model, 'eligibleFraction', v)" :min="0" :max="1" :max-fraction-digits="6" :aria-label="`${model.key} eligible fraction`" /></label><label><span>Items per successful drop</span><InputNumber :model-value="input(model, 'quantity')" @update:model-value="v => update(model, 'quantity', v)" :min="1" :max="1000" :max-fraction-digits="0" :aria-label="`${model.key} items per drop`" /></label></div>
          <div class="table-scroll"><table><thead><tr><th>Team</th><th>Recorded credits</th><th>Eligible credits</th><th>Expected items</th><th>Calculation</th></tr></thead><tbody><tr v-for="result in activePredictions" :key="result.team"><th :style="{ color: colorFor(result.team) }">{{ result.team }}</th><template v-for="source in result.components.flatMap(c => c.sources).filter(s => s.model.key === model.key)" :key="source.model.key"><td>{{ number(source.kills) }}</td><td>{{ number(source.eligible, 'expected') }}</td><td>{{ number(source.expected, 'expected') }}</td><td>{{ number(source.kills) }} × {{ source.input.eligibleFraction }} × {{ Number.isFinite(source.input.probability) ? source.input.probability.toPrecision(5) : '—' }} × {{ source.input.quantity }}</td></template></tr></tbody></table></div>
        </section>
      </details>
    </section>
  </div>
</template>
