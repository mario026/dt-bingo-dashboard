<script setup lang="ts">
import { computed } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { value, diversity, share, total, number, type Person, type Metric } from '../analytics.ts';
const props = defineProps<{ players: Person[]; metric: Metric; keys?: string[] }>();
defineEmits<{ select: [person: Person] }>();
const rows = computed(() => props.players.map(p => ({ person: p, username: p.player.username, name: p.player.displayName, team: p.team, kills: value(p, 'kills', props.keys), ehb: value(p, 'ehb', props.keys), diversity: diversity(p), share: share(value(p, props.metric, props.keys), total(props.players, props.metric, props.keys)) })));
</script>
<template>
  <DataTable :value="rows" :sort-field="metric" :sort-order="-1" paginator :rows="10" :rows-per-page-options="[10, 25, 100]" data-key="username" size="small" class="player-table">
    <template #empty>No player data matches these filters.</template>
    <Column field="name" header="Player" sortable><template #body="{ data }"><button class="player-link" :style="{ '--team-color': data.person.color }" @click="$emit('select', data.person)"><span class="team-dot"></span><span>{{ data.name }}<small>{{ data.team }}</small></span></button></template></Column>
    <Column field="kills" header="Recorded kills" sortable><template #body="{ data }">{{ number(data.kills) }}</template></Column>
    <Column field="ehb" header="Gained EHB" sortable><template #body="{ data }">{{ number(data.ehb, 'ehb') }}</template></Column>
    <Column field="diversity" header="Boss diversity" sortable />
    <Column field="share" :header="`${metric === 'kills' ? 'Kill' : 'EHB'} share`" sortable><template #body="{ data }">{{ data.share == null ? '—' : `${number(data.share, 'expected')}%` }}</template></Column>
  </DataTable>
</template>
