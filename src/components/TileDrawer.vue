<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Drawer from 'primevue/drawer';
import Select from 'primevue/select';
import InputNumber from 'primevue/inputnumber';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { type Tile, tileMetrics, bossName, componentEstimate, wiki } from '../catalog.ts';
import { total, number, colorFor, readScenarios, scenarioKey, scenarioExpected, type Scenario, type Person } from '../analytics.ts';
import type { ExportResult } from '../types.ts';
import WikiImage from './WikiImage.vue';
import PlayerTable from './PlayerTable.vue';
const props = defineProps<{ tile: Tile | null; barrows: string | null; players: Person[]; dataset: ExportResult }>();
const emit = defineEmits<{ close: []; person: [person: Person] }>();
const visible = computed(() => Boolean(props.tile || props.barrows));
const keys = computed(() => props.tile ? tileMetrics(props.tile) : ['barrows_chests']);
const teams = computed(() => props.dataset.teams.map(t => ({ name: t.name ?? 'No team', players: props.players.filter(p => p.team === (t.name ?? 'No team')) })));
const scenarios = ref<Record<string, Scenario>>({});
const scenarioChoice = ref('');
const storageError = ref('');
const scenarioOptions = computed(() => props.tile?.components.flatMap((component, ci) => component.sources.filter(s => s.mode === 'scenario').map(source => ({ label: `${component.name} · ${bossName(source.metric)}`, value: `${ci}:${source.metric}`, component, source }))) ?? []);
const selectedScenario = computed(() => scenarioOptions.value.find(s => s.value === scenarioChoice.value));
watch(() => [props.tile?.id, props.dataset.competition.id], () => {
  storageError.value = '';
  try { scenarios.value = props.tile ? readScenarios(localStorage, props.dataset.competition.id, props.tile.id) : {}; }
  catch { scenarios.value = {}; storageError.value = 'Browser storage unavailable; scenario inputs last for this session only.'; }
  scenarioChoice.value = scenarioOptions.value[0]?.value ?? '';
}, { immediate: true });
watch(scenarios, values => {
  if (!props.tile) return;
  try { localStorage.setItem(scenarioKey(props.dataset.competition.id, props.tile.id), JSON.stringify(values)); }
  catch { storageError.value = 'Could not save scenario inputs in this browser.'; }
}, { deep: true });
function scenarioFor(team: string) {
  const key = `${scenarioChoice.value}:${team}`;
  if (!scenarios.value[key] || typeof scenarios.value[key] !== 'object') scenarios.value[key] = { rolls: null, probability: null, quantity: 1 };
  return scenarios.value[key];
}
function reset() {
  scenarios.value = {};
  try { if (props.tile) localStorage.removeItem(scenarioKey(props.dataset.competition.id, props.tile.id)); } catch { /* Session still resets. */ }
}
const expectedRows = (ci: number) => teams.value.map(team => {
  const component = props.tile!.components[ci];
  const metrics = [...new Set(component.sources.map(s => s.metric))];
  return { team: team.name, kills: total(team.players, 'kills', metrics), ehb: total(team.players, 'ehb', metrics), ...componentEstimate(component, team.players) };
});
</script>
<template>
  <Drawer :visible="visible" position="right" class="tile-drawer" @update:visible="v => { if (!v) emit('close'); }">
    <template #header><div class="drawer-title"><span class="eyebrow">{{ tile ? `TILE ${tile.id} · ${tile.points} POINT${tile.points === 1 ? '' : 'S'}` : 'CRYPT ACTIVITY' }}</span><h2>{{ tile?.name ?? `${barrows}'s Crypt` }}</h2></div></template>
    <template v-if="tile">
      <div class="item-intro"><WikiImage :title="tile.icon" :size="64" /><div><p>{{ tile.requirement }}</p><span class="muted">Requirements preserved from the event board</span></div></div>
      <p class="notice">Expected drops are statistical averages, not actual loot or tile completion. Recorded kills may include shared encounter credits.</p>
      <div v-if="!keys.length" class="empty-state"><i class="pi pi-database"></i><h3>no data provided for this tile</h3><p>The export has no mapped boss kill counts for these requirements.</p></div>
      <section v-for="(component, ci) in tile.components" :key="component.name" class="component-card">
        <div class="section-heading"><div class="item-intro"><WikiImage :title="component.alternatives?.[0] ?? component.name" /><div><h3>{{ component.name }}</h3><span class="muted">Required: {{ component.required }}</span></div></div><a :href="component.wiki" target="_blank" rel="noopener noreferrer" class="source-link">Item wiki <i class="pi pi-external-link"></i></a></div>
        <p v-if="component.alternatives" class="muted">Eligible: {{ component.alternatives.join(' · ') }}</p>
        <p v-if="component.note" class="muted">{{ component.note }}</p>
        <p v-if="!component.sources.length" class="no-data">no data provided for this tile</p>
        <template v-else>
          <div v-for="source in component.sources" :key="source.metric" class="source-row">
            <div><strong>{{ bossName(source.metric) }}</strong><span class="rate">{{ source.rate }}</span></div>
            <p>{{ source.note }}</p>
            <a :href="source.wiki" target="_blank" rel="noopener noreferrer">{{ source.verifiedAt ? `Wiki checked ${source.verifiedAt}` : 'Unverified source / rate' }} <i class="pi pi-external-link"></i></a>
            <details><summary>Calculation by team</summary><div class="table-scroll"><table><thead><tr><th>Team</th><th>Source kills</th><th>Source EHB</th><th>Expected quantity</th></tr></thead><tbody><tr v-for="team in teams" :key="team.name"><th :style="{ color: colorFor(team.name) }">{{ team.name }}</th><td>{{ number(total(team.players, 'kills', [source.metric])) }}</td><td>{{ number(total(team.players, 'ehb', [source.metric]), 'ehb') }}</td><td><template v-if="source.mode === 'fixed' && source.probability !== undefined">{{ number(total(team.players, 'kills', [source.metric])) }} × {{ number(source.probability * 100, 'expected') }}% × {{ source.quantity ?? 1 }} = {{ number(componentEstimate({ ...component, sources: [source] }, team.players).expected, 'expected') }}</template><span v-else>Scenario required</span></td></tr></tbody></table></div></details>
          </div>
          <DataTable :value="expectedRows(ci)" size="small" class="metric-table">
            <Column field="team" header="Team"><template #body="{ data }"><span class="team-label" :style="{ color: colorFor(data.team) }">{{ data.team }}</span></template></Column>
            <Column header="Recorded kills"><template #body="{ data }">{{ number(data.kills) }}</template></Column>
            <Column header="EHB"><template #body="{ data }">{{ number(data.ehb, 'ehb') }}</template></Column>
            <Column header="Fixed-rate expected"><template #body="{ data }">{{ number(data.expected, 'expected') }}<span v-if="data.partial && data.expected !== null" class="muted"> (partial)</span></template></Column>
          </DataTable>
          <p class="footnote">Kills/EHB include the listed sources. Expected quantities include only verified fixed-rate sources and available counts. Components sharing a source reuse its activity; do not add the rows' kill counts together.</p>
        </template>
      </section>
      <section v-if="scenarioOptions.length" class="panel scenario-panel">
        <div class="section-heading"><div><span class="eyebrow">OPTIONAL · ASSUMPTIONS</span><h3>Expected drop scenario</h3></div><Button label="Reset" icon="pi pi-refresh" severity="secondary" size="small" @click="reset" /></div>
        <Select v-model="scenarioChoice" :options="scenarioOptions" option-label="label" option-value="value" aria-label="Scenario component and source" class="w-full" />
        <p class="notice">{{ selectedScenario?.source.note }} Enter eligible rolls, effective probability (0–1), and items per successful roll. Kill counts are never copied into eligible rolls automatically.</p>
        <p v-if="!selectedScenario?.source.verifiedAt" class="no-data">This rate is unverified. Any entered probability is your own assumption.</p>
        <div class="scenario-grid scenario-head"><span>Team</span><span>Eligible rolls</span><span>Probability</span><span>Qty / drop</span><span>Expected</span></div>
        <div v-for="team in teams" :key="team.name" class="scenario-grid">
          <span :style="{ color: colorFor(team.name) }">{{ team.name }}</span>
          <label class="scenario-input"><span>Eligible rolls</span><InputNumber v-model="scenarioFor(team.name).rolls" :min="0" :max-fraction-digits="0" :aria-label="`${team.name} eligible rolls`" placeholder="Required" /></label>
          <label class="scenario-input"><span>Probability (0–1)</span><InputNumber v-model="scenarioFor(team.name).probability" :min="0" :max="1" :max-fraction-digits="10" :aria-label="`${team.name} item probability`" placeholder="0–1" /></label>
          <label class="scenario-input"><span>Items per drop</span><InputNumber v-model="scenarioFor(team.name).quantity" :min="0.000001" :max-fraction-digits="6" :aria-label="`${team.name} quantity per drop`" /></label>
          <strong>{{ number(scenarioExpected(scenarioFor(team.name)), 'expected') }}</strong>
        </div>
        <p class="footnote">Scenario = eligible rolls × probability × quantity. Separate from fixed-rate estimates; not allocated to individual players. Inputs are saved locally for this competition and tile.</p>
        <p v-if="storageError" role="status" class="no-data">{{ storageError }}</p>
      </section>
    </template>
    <template v-else>
      <p class="notice">A {{ barrows }} armour drop triggered a die roll to open 1–4 tiles. Drops and rolls are not present in the export. These are shared Barrows chest counts, repeated across all six crypts—not brother-specific kills.</p>
      <DataTable :value="teams" size="small"><Column header="Team"><template #body="{ data }"><span :style="{ color: colorFor(data.name) }">{{ data.name }}</span></template></Column><Column header="Chest completions"><template #body="{ data }">{{ number(total(data.players, 'kills', keys)) }}</template></Column><Column header="EHB"><template #body="{ data }">{{ number(total(data.players, 'ehb', keys), 'ehb') }}</template></Column></DataTable>
      <a :href="wiki('Barrows')" target="_blank" rel="noopener noreferrer" class="source-link">Barrows on OSRS Wiki <i class="pi pi-external-link"></i></a>
    </template>
    <section v-if="keys.length" class="panel"><div class="section-heading"><h3>Player contributions</h3><span class="muted">Recorded source activity</span></div><PlayerTable :players="players" :keys="keys" metric="kills" @select="p => emit('person', p)" /></section>
  </Drawer>
</template>
