<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue';
import Select from 'primevue/select';
import SelectButton from 'primevue/selectbutton';
import MultiSelect from 'primevue/multiselect';
import InputText from 'primevue/inputtext';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { people, total, value, bossValue, diversity, rank, share, average, number, date, colorFor, bossKeys, parseExport, type Person, type Metric } from './analytics.ts';
import { crypts, allTiles, tileMetrics, bossName, bossWiki, type Tile } from './catalog.ts';
import { bars, scatter, heatmap, sortedBosses } from './charts.ts';
import type { ExportResult } from './types.ts';
import defaultDataUrl from '../output/competition-160537-bosses.json?url';
import manifest from './wiki-images.json';
import WikiImage from './components/WikiImage.vue';
const InsightChart = defineAsyncComponent(() => import('./components/InsightChart.vue'));
import PlayerTable from './components/PlayerTable.vue';
import TileDrawer from './components/TileDrawer.vue';
const ResultsPage = defineAsyncComponent(() => import('./components/ResultsPage.vue'));

const pages = ['Bingo', 'Overview', 'Results', 'Teams', 'Players', 'Bosses'] as const;
type Page = typeof pages[number];
const navIcons = ['pi-th-large', 'pi-chart-bar', 'pi-trophy', 'pi-users', 'pi-user', 'pi-bolt'];
const page = ref<Page>('Bingo');
const data = ref<ExportResult | null>(null);
const loading = ref(true);
const error = ref('');
const tile = ref<Tile | null>(null);
const barrows = ref<string | null>(null);
const metric = ref<Metric>('kills');
const metricOptions = [{ label: 'Kill count', value: 'kills' }, { label: 'Gained EHB', value: 'ehb' }];
const metricLabel = computed(() => metric.value === 'kills' ? 'recorded kills' : 'gained EHB');
const teamFilter = ref<string | null>(null);
const bossFilter = ref<string | null>(null);
const selectedTeam = ref('Team Groen');
const selectedPlayer = ref('phantom4u');
const selectedBoss = ref('vorkath');
const comparison = ref<string[]>([]);
const search = ref('');
const bossSearch = ref('');
const tileSearch = ref('');
const perMember = ref(false);
const allPeople = computed(() => data.value ? people(data.value) : []);
const keys = computed(() => data.value ? bossKeys(data.value) : []);
const filterKeys = computed(() => bossFilter.value ? [bossFilter.value] : undefined);
const teams = computed(() => data.value?.teams.map(t => t.name ?? 'No team') ?? []);
const teamOptions = computed(() => [{ label: 'All teams', value: null }, ...teams.value.map(t => ({ label: t, value: t }))]);
const bossOptions = computed(() => [{ label: 'All bosses', value: null }, ...keys.value.map(k => ({ label: bossName(k), value: k }))]);
const filtered = computed(() => allPeople.value.filter(p => !teamFilter.value || p.team === teamFilter.value));
const teamPeople = computed(() => allPeople.value.filter(p => p.team === selectedTeam.value));
const tablePeople = computed(() => (page.value === 'Teams' ? teamPeople.value : filtered.value).filter(p => `${p.player.displayName} ${p.team}`.toLowerCase().includes(search.value.toLowerCase())));
const person = computed(() => allPeople.value.find(p => p.player.username === selectedPlayer.value));
const comparePeople = computed(() => comparison.value.slice(0, 4).map(username => allPeople.value.find(p => p.player.username === username)).filter((p): p is Person => Boolean(p)));
const playerOptions = computed(() => allPeople.value.map(p => ({ label: `${p.player.displayName} · ${p.team}`, value: p.player.username })));
const focusBoss = computed(() => bossFilter.value ?? selectedBoss.value);
const teamStats = computed(() => teams.value.filter(t => !teamFilter.value || t === teamFilter.value).map(team => {
  const ps = allPeople.value.filter(p => p.team === team);
  const kills = total(ps, 'kills', filterKeys.value); const ehb = total(ps, 'ehb', filterKeys.value);
  return { team, players: ps.length, available: ps.filter(p => p.status === 'ok').length, kills, ehb,
    averageKills: kills === null || !ps.length ? null : kills / ps.length, averageEhb: ehb === null || !ps.length ? null : ehb / ps.length,
    active: ps.filter(p => (value(p, 'kills', filterKeys.value) ?? 0) > 0).length };
}).sort((a, b) => (b[metric.value] ?? -1) - (a[metric.value] ?? -1)));
const bossRows = computed(() => sortedBosses(page.value === 'Teams' ? teamPeople.value : filtered.value, bossFilter.value ? [bossFilter.value] : keys.value, metric.value).map(k => {
  const ps = page.value === 'Teams' ? teamPeople.value : filtered.value;
  return { key: k, name: bossName(k), kills: total(ps, 'kills', [k]), ehb: total(ps, 'ehb', [k]), active: ps.filter(p => (bossValue(p, k, 'kills') ?? 0) > 0).length };
}));
const playerBossRows = computed(() => person.value ? keys.value.map(k => ({ key: k, name: bossName(k), boss: person.value!.bosses?.[k], kills: bossValue(person.value!, k, 'kills'), ehb: bossValue(person.value!, k, 'ehb') })).sort((a, b) => (b[metric.value] ?? -1) - (a[metric.value] ?? -1)) : []);
const teamComparison = (m: Metric) => {
  const stats = [...teamStats.value].sort((a, b) => ((m === 'kills' ? b.averageKills : b.averageEhb) ?? -1) - ((m === 'kills' ? a.averageKills : a.averageEhb) ?? -1));
  const sorted = perMember.value ? stats : [...teamStats.value].sort((a, b) => (b[m] ?? -1) - (a[m] ?? -1));
  return bars(sorted.map(t => t.team), sorted.map(t => perMember.value ? m === 'kills' ? t.averageKills : t.averageEhb : t[m]), sorted.map(t => colorFor(t.team)), m);
};
const topBossChart = computed(() => { const rows = bossRows.value.slice(0, 10); return bars(rows.map(b => b.name), rows.map(b => b[metric.value]), rows.map(() => page.value === 'Teams' ? colorFor(selectedTeam.value) : '#d9b77d'), metric.value); });
const playerBossChart = computed(() => { const rows = playerBossRows.value.slice(0, 10); return bars(rows.map(b => b.name), rows.map(b => b[metric.value]), rows.map(() => person.value?.color ?? '#d9b77d'), metric.value); });
const visibleCrypts = computed(() => crypts.map(c => ({ ...c, tiles: c.tiles.filter(t => `${t.id} ${t.name} ${t.requirement}`.toLowerCase().includes(tileSearch.value.toLowerCase())) })).filter(c => c.tiles.length));
const currentPs = computed(() => page.value === 'Teams' ? teamPeople.value : filtered.value);
const sourceTiles = computed(() => allTiles.filter(t => tileMetrics(t).includes(focusBoss.value)));
const anomalies = computed(() => allPeople.value.reduce((n, p) => n + Object.values(p.bosses ?? {}).filter(b => b.kills.gained < 0 || b.ehb.gained < 0).length, 0));
const unknownKills = computed(() => allPeople.value.reduce((n, p) => n + Object.values(p.bosses ?? {}).filter(b => b.kills.start < 0 || b.kills.end < 0).length, 0));
const rawValue = (n: number | undefined, m: Metric = 'kills') => n === undefined || n < 0 ? '—' : number(n, m);
const teamOfPerson = computed(() => allPeople.value.filter(p => p.team === person.value?.team));
const attributionCount = Object.keys(manifest).length;

function navigate(next: Page) { page.value = next; search.value = ''; location.hash = next.toLowerCase(); }
function syncHash() { const p = pages.find(p => p.toLowerCase() === location.hash.slice(1).toLowerCase()); if (p) page.value = p; }
function openPerson(p: Person) { selectedPlayer.value = p.player.username; tile.value = null; barrows.value = null; navigate('Players'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function accept(x: unknown) {
  const parsed = parseExport(x); data.value = parsed;
  teamFilter.value = null; bossFilter.value = null; comparison.value = []; tile.value = null; barrows.value = null;
  const ps = people(parsed);
  selectedTeam.value = parsed.teams[0]?.name ?? 'No team'; selectedPlayer.value = ps[0]?.player.username ?? '';
  selectedBoss.value = bossKeys(parsed).includes('vorkath') ? 'vorkath' : bossKeys(parsed)[0] ?? '';
}
async function loadDefault() {
  loading.value = true; error.value = '';
  try { const response = await fetch(defaultDataUrl, { cache: 'no-store' }); if (!response.ok) throw new Error(`Could not load the default export (HTTP ${response.status}).`); accept(await response.json()); }
  catch (e) { error.value = e instanceof Error ? e.message : String(e); }
  finally { loading.value = false; }
}
onMounted(() => { syncHash(); window.addEventListener('hashchange', syncHash); loadDefault(); });
onUnmounted(() => window.removeEventListener('hashchange', syncHash));
</script>

<template>
  <div class="app-shell dark">
    <a class="skip-link" href="#main">Skip to dashboard</a>
    <aside class="sidebar">
      <a class="brand" href="#bingo" @click="navigate('Bingo')"><span class="brand-mark"><i class="pi pi-prime"></i></span><span>DARKTURBO<small>CLAN COMPETITIONS</small></span></a>
      <div class="sidebar-label">OCTOBER 2026</div>
      <nav aria-label="Dashboard pages"><a v-for="(p, i) in pages" :key="p" :href="`#${p.toLowerCase()}`" :aria-label="p" :class="{ active: page === p }" :aria-current="page === p ? 'page' : undefined" @click="navigate(p)"><i :class="`pi ${navIcons[i]}`"></i>{{ p }}<span v-if="p === 'Bingo'" class="nav-count">54</span></a></nav>
      <div class="sidebar-event"><span class="event-sigil">VI</span><h3>The Six Crypts</h3><p>One clan. Five teams.<br>A whole lot of bossing.</p><span class="live-pill"><span></span>{{ data?.interim ? 'INTERIM EXPORT' : 'COMPETITION EXPORT' }}</span></div>
      <div class="sidebar-bottom"><i class="pi pi-database"></i><span>Powered by Wise Old Man<small>Local competition insights</small></span></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><div class="breadcrumb"><span>Clan events</span><i class="pi pi-angle-right"></i><strong>{{ page }}</strong></div><div class="toolbar"><span class="source-chip">Committed export</span></div></header>
      <main id="main">
        <div v-if="error" role="alert" class="error-banner"><i class="pi pi-exclamation-triangle"></i>{{ error }}</div>
        <div v-if="loading && !data" class="empty-state"><i class="pi pi-spin pi-spinner"></i><h2>Opening the crypts…</h2></div>
        <template v-if="data">
          <section class="page-heading"><div><span class="eyebrow">DARKTURBO BINGO · OCTOBER 2026</span><h1>{{ page === 'Bingo' ? 'The Six Crypts' : page === 'Results' ? 'What the drops suggest.' : page === 'Overview' ? 'Every kill tells a story.' : page === 'Teams' ? 'Stronger together.' : page === 'Players' ? 'Behind the kill count.' : 'Know your adversary.' }}</h1><p>{{ page === 'Bingo' ? 'Explore the board. Follow the drops. See what your team’s bossing could bring.' : 'Recorded kills and gained EHB, from the competition’s available snapshots.' }}</p></div><div class="heading-meta"><span class="live-pill"><span></span>{{ data.interim ? 'INTERIM DATA' : 'EVENT ENDED' }}</span><small>{{ date(data.requestedRange.startsAt) }}<br>to {{ date(data.requestedRange.endsAt) }} · Amsterdam</small></div></section>
          <div class="data-strip"><span><i class="pi pi-clock"></i> Exported {{ date(data.generatedAt) }}</span><span>{{ data.successfulPlayers }}/{{ data.playerCount }} players available · {{ keys.length }} boss metrics</span><span v-if="data.failedPlayers || !data.complete" class="warning">Partial export — missing players are not zeroes</span><span v-else>Recorded activity, not confirmed loot</span></div>

          <template v-if="page === 'Bingo'">
            <section class="bingo-summary"><div class="bingo-intro"><span class="eyebrow">THE EVENT BOARD</span><h2>Six brothers.<br><em>Fifty-four challenges.</em></h2><p>An armour drop opened 1–4 tiles with a die roll. Only boss activity is recorded here; unlocks and actual loot remain unknown.</p><div class="summary-inline"><span><strong>{{ number(total(allPeople, 'kills')) }}</strong> recorded kills / completions</span><span><strong>{{ number(total(allPeople, 'ehb'), 'ehb') }}</strong> gained boss EHB</span></div></div><div class="team-mini-list"><div v-for="team in teamStats" :key="team.team" class="team-mini"><span class="team-dot" :style="{ background: colorFor(team.team) }"></span><strong :style="{ color: colorFor(team.team) }">{{ team.team }}</strong><span>{{ number(team.kills) }} <small>kills</small></span><span>{{ number(team.ehb, 'ehb') }} <small>EHB</small></span></div></div></section>
            <div class="section-heading board-heading"><div><h2>Choose a crypt</h2><p class="muted">Select any tile to inspect its requirements and expected drops.</p></div><span class="search-field"><i class="pi pi-search"></i><InputText v-model="tileSearch" placeholder="Find a tile or item…" aria-label="Search bingo tiles" /></span></div>
            <div v-if="!visibleCrypts.length" class="empty-state">No tiles match “{{ tileSearch }}”.</div>
            <div class="crypt-grid"><section v-for="crypt in visibleCrypts" :key="crypt.name" class="crypt-card"><header class="crypt-header"><div class="crypt-identity"><WikiImage :title="crypt.icon" :size="48" /><div><span class="eyebrow">{{ crypt.epithet }}</span><h2>{{ crypt.name }}’s Crypt</h2></div></div><span class="crypt-points">{{ crypts.find(c => c.name === crypt.name)!.tiles.reduce((s, t) => s + t.points, 0) }} pts</span></header><button class="barrows-link" :aria-label="`${crypt.name} shared Barrows activity`" @click="barrows = crypt.name"><i class="pi pi-key"></i><span>Shared Barrows activity</span><strong>{{ number(total(allPeople, 'kills', ['barrows_chests'])) }} chests</strong><i class="pi pi-arrow-up-right"></i></button><div class="tile-grid"><button v-for="entry in crypt.tiles" :key="entry.id" class="bingo-tile" :aria-label="`${entry.id} ${entry.name}, ${entry.points} points`" @click="tile = entry"><div class="tile-top"><span class="tile-code">{{ entry.id }}</span><span class="tile-points">{{ entry.points }} pt{{ entry.points > 1 ? 's' : '' }}</span></div><WikiImage :title="entry.icon" :size="38" /><strong>{{ entry.name }}</strong><span class="tile-data" :class="{ supported: tileMetrics(entry).length }"><span></span>{{ tileMetrics(entry).length ? 'Boss activity' : 'No boss data' }}</span></button></div></section></div>
          </template>

          <template v-else-if="page === 'Results'"><ResultsPage :dataset="data" @tile="entry => tile = entry" /></template>
          <template v-else>
            <div class="filters panel"><div class="filter-controls"><Select v-if="page === 'Overview' || page === 'Bosses'" v-model="teamFilter" :options="teamOptions" option-label="label" option-value="value" aria-label="Filter teams" /><Select v-if="page === 'Teams'" v-model="selectedTeam" :options="teams" aria-label="Select team" /><Select v-if="page === 'Players'" v-model="selectedPlayer" :options="playerOptions" option-label="label" option-value="value" filter aria-label="Select player" class="player-picker" /><Select v-if="page !== 'Players'" v-model="bossFilter" :options="bossOptions" option-label="label" option-value="value" filter aria-label="Filter boss" /></div><SelectButton v-model="metric" :options="metricOptions" option-label="label" option-value="value" :allow-empty="false" aria-label="Rank by metric" /></div>

            <template v-if="page === 'Overview' || page === 'Teams'">
              <div class="filter-description">{{ page === 'Teams' ? selectedTeam : teamFilter ?? 'All teams' }} · {{ bossFilter ? bossName(bossFilter) : 'All bosses' }} · competition gains</div>
              <section class="stats-grid"><article class="stat-card"><span>Recorded kills / completions</span><strong>{{ number(total(currentPs, 'kills', filterKeys)) }}</strong><small>Sum of participant credits</small><i class="pi pi-bolt"></i></article><article class="stat-card"><span>Gained boss EHB</span><strong>{{ number(total(currentPs, 'ehb', filterKeys), 'ehb') }}</strong><small>Summed boss EHB · standardized effort</small><i class="pi pi-chart-line"></i></article><article class="stat-card"><span>Active players</span><strong>{{ currentPs.filter(p => (value(p, 'kills', filterKeys) ?? 0) > 0).length }}<em>/ {{ currentPs.length }}</em></strong><small>At least one recorded kill</small><i class="pi pi-users"></i></article><article class="stat-card"><span>Boss diversity</span><strong>{{ (filterKeys ?? keys).filter(k => (total(currentPs, 'kills', [k]) ?? 0) > 0).length }}</strong><small>Boss metrics with recorded gains</small><i class="pi pi-compass"></i></article></section>
              <template v-if="page === 'Overview'">
                <div class="section-heading"><h2>Team standings</h2><label class="toggle-label"><input v-model="perMember" type="checkbox"> Per roster member</label></div>
                <div class="chart-grid"><section class="panel"><div class="section-heading"><h3>Kill count</h3><span class="chart-tag">{{ perMember ? 'AVERAGE' : 'TOTAL' }}</span></div><InsightChart :option="teamComparison('kills')" label="Team kill count comparison" /></section><section class="panel"><div class="section-heading"><h3>Gained EHB</h3><span class="chart-tag">{{ perMember ? 'AVERAGE' : 'TOTAL' }}</span></div><InsightChart :option="teamComparison('ehb')" label="Team EHB comparison" /></section></div>
                <section class="panel"><DataTable :value="teamStats" size="small"><Column field="team" header="Team"><template #body="{ data: row }"><span :style="{ color: colorFor(row.team) }">{{ row.team }}</span></template></Column><Column field="players" header="Roster" /><Column field="available" header="Available" /><Column header="Kills"><template #body="{ data: row }">{{ number(row.kills) }}</template></Column><Column header="EHB"><template #body="{ data: row }">{{ number(row.ehb, 'ehb') }}</template></Column><Column header="Kills / member"><template #body="{ data: row }">{{ number(row.averageKills, 'expected') }}</template></Column><Column header="EHB / member"><template #body="{ data: row }">{{ number(row.averageEhb, 'ehb') }}</template></Column></DataTable></section>
                <section class="panel"><div class="section-heading"><div><h3>Volume meets effort</h3><p class="muted">One dot per player · current team and boss filters</p></div><span class="chart-tag">KILLS × EHB</span></div><InsightChart :option="scatter(filtered, filterKeys)" label="Player recorded kills versus gained EHB" :height="350" /></section>
              </template>
              <template v-else>
                <section class="panel"><div class="section-heading"><h3>Team contribution</h3><span :style="{ color: colorFor(selectedTeam) }">{{ selectedTeam }}</span></div><div class="contribution-grid"><div><strong>{{ number(share(total(teamPeople, 'kills', filterKeys), total(allPeople, 'kills', filterKeys)), 'expected') }}%</strong><span>of competition kills</span></div><div><strong>{{ number(share(total(teamPeople, 'ehb', filterKeys), total(allPeople, 'ehb', filterKeys)), 'expected') }}%</strong><span>of competition EHB</span></div><div><strong>{{ number(average(teamPeople, 'kills', filterKeys), 'expected') }}</strong><span>recorded kills / roster member</span></div><div><strong>{{ number(average(teamPeople, 'ehb', filterKeys), 'ehb') }}</strong><span>gained EHB / roster member</span></div></div></section>
                <section class="panel"><div class="section-heading"><h3>Player × boss activity</h3><span class="muted">Top 12 bosses by {{ metricLabel }}</span></div><InsightChart :option="heatmap(teamPeople, sortedBosses(teamPeople, filterKeys ?? keys, metric).slice(0, 12), metric)" label="Team player boss activity heatmap" :height="Math.max(400, teamPeople.length * 25 + 140)" /><details><summary>View heatmap values as a table</summary><div class="table-scroll"><table><thead><tr><th>Player</th><th v-for="k in sortedBosses(teamPeople, filterKeys ?? keys, metric).slice(0, 12)" :key="k">{{ bossName(k) }}</th></tr></thead><tbody><tr v-for="p in teamPeople" :key="p.player.id"><th :style="{ color: p.color }">{{ p.player.displayName }}</th><td v-for="k in sortedBosses(teamPeople, filterKeys ?? keys, metric).slice(0, 12)" :key="k">{{ number(bossValue(p, k, metric), metric) }}</td></tr></tbody></table></div></details></section>
              </template>
              <div class="chart-grid"><section class="panel"><div class="section-heading"><h3>Most encountered bosses</h3><span class="chart-tag">{{ metricLabel.toUpperCase() }}</span></div><InsightChart :option="topBossChart" label="Top bosses by selected metric" :height="370" /></section><section class="panel"><div class="section-heading"><h3>Boss breakdown</h3></div><DataTable :value="bossRows" paginator :rows="8" size="small"><Column header="Boss"><template #body="{ data: b }"><button class="text-link" @click="selectedBoss = b.key; bossFilter = null; navigate('Bosses')">{{ b.name }}</button></template></Column><Column field="kills" header="Kills" sortable><template #body="{ data: b }">{{ number(b.kills) }}</template></Column><Column field="ehb" header="EHB" sortable><template #body="{ data: b }">{{ number(b.ehb, 'ehb') }}</template></Column></DataTable></section></div>
              <section class="panel"><div class="section-heading"><div><h2>Player leaderboard</h2><p class="muted">Share refers to the players in this table.</p></div><InputText v-model="search" placeholder="Search players…" aria-label="Search leaderboard" /></div><PlayerTable :players="tablePeople" :metric="metric" :keys="filterKeys" @select="openPerson" /></section>
            </template>

            <template v-if="page === 'Players'">
              <template v-if="person">
                <section class="player-hero panel" :style="{ '--team-color': person.color }"><div class="player-avatar">{{ person.player.displayName.slice(0, 2).toUpperCase() }}</div><div><span class="eyebrow" :style="{ color: person.color }">{{ person.team }}</span><h2>{{ person.player.displayName }}</h2><p class="muted">Full competition breakdown · {{ person.player.type ?? 'Player' }}</p></div><div class="player-ranks"><span>Competition ranks</span><strong>#{{ rank(allPeople, person, 'kills') ?? '—' }} <small>kills</small> <b>·</b> #{{ rank(allPeople, person, 'ehb') ?? '—' }} <small>EHB</small></strong></div></section>
                <section class="stats-grid"><article class="stat-card"><span>Recorded kills / completions</span><strong>{{ number(value(person, 'kills')) }}</strong><small>Team rank #{{ rank(teamOfPerson, person, 'kills') ?? '—' }}</small></article><article class="stat-card"><span>Gained boss EHB</span><strong>{{ number(value(person, 'ehb'), 'ehb') }}</strong><small>Team rank #{{ rank(teamOfPerson, person, 'ehb') ?? '—' }}</small></article><article class="stat-card"><span>Team contribution</span><strong>{{ number(share(value(person, 'kills'), total(teamOfPerson, 'kills')), 'expected') }}<em>% kills</em></strong><small>{{ number(share(value(person, 'ehb'), total(teamOfPerson, 'ehb')), 'expected') }}% of team EHB</small></article><article class="stat-card"><span>Boss diversity</span><strong>{{ diversity(person) }}</strong><small>Bosses with positive recorded kill gains</small></article></section>
                <div class="snapshot-info"><span>Snapshot start <strong>{{ date(person.snapshotRange?.startsAt) }}</strong></span><span>Snapshot end <strong>{{ date(person.snapshotRange?.endsAt) }}</strong></span><span>Lifetime profile EHB <strong>{{ number(Number(person.player.ehb), 'ehb') }}</strong></span></div>
                <p v-if="person.status === 'error'" role="status" class="error-banner">Player data unavailable: {{ person.error }}</p>
                <section class="panel"><div class="section-heading"><h3>Top bosses · {{ metricLabel }}</h3><span :style="{ color: person.color }">{{ person.team }}</span></div><InsightChart :option="playerBossChart" label="Selected player's top bosses" :height="380" /></section>
                <section class="panel"><div class="section-heading"><h2>Compare players</h2><span class="muted">Up to four · full competition totals</span></div><MultiSelect v-model="comparison" :options="playerOptions" option-label="label" option-value="value" :selection-limit="4" :max-selected-labels="2" filter placeholder="Choose players to compare" aria-label="Players to compare" class="w-full" /><div v-if="comparePeople.length" class="chart-grid"><InsightChart :option="bars(comparePeople.map(p => p.player.displayName), comparePeople.map(p => value(p, 'kills')), comparePeople.map(p => p.color), 'kills')" label="Compared player kills" /><InsightChart :option="bars(comparePeople.map(p => p.player.displayName), comparePeople.map(p => value(p, 'ehb')), comparePeople.map(p => p.color), 'ehb')" label="Compared player EHB" /></div><PlayerTable v-if="comparePeople.length" :players="comparePeople" :metric="metric" @select="openPerson" /></section>
                <section class="panel"><div class="section-heading"><h2>Every boss, every gain</h2><span class="muted">— = unknown or unranked</span></div><DataTable :value="playerBossRows" paginator :rows="15" :rows-per-page-options="[15, 30, 100]" size="small" class="boss-detail-table"><Column field="name" header="Boss" sortable><template #body="{ data: b }"><a :href="bossWiki(b.key)" target="_blank" rel="noopener noreferrer" class="text-link">{{ b.name }}</a></template></Column><Column header="Kills start"><template #body="{ data: b }">{{ rawValue(b.boss?.kills.start) }}</template></Column><Column header="Kills end"><template #body="{ data: b }">{{ rawValue(b.boss?.kills.end) }}</template></Column><Column field="kills" header="Kills gained" sortable><template #body="{ data: b }">{{ number(b.kills) }}</template></Column><Column header="EHB start"><template #body="{ data: b }">{{ rawValue(b.boss?.ehb.start, 'ehb') }}</template></Column><Column header="EHB end"><template #body="{ data: b }">{{ rawValue(b.boss?.ehb.end, 'ehb') }}</template></Column><Column field="ehb" header="EHB gained" sortable><template #body="{ data: b }">{{ number(b.ehb, 'ehb') }}</template></Column><Column header="Rank start"><template #body="{ data: b }">{{ rawValue(b.boss?.rank.start) }}</template></Column><Column header="Rank end"><template #body="{ data: b }">{{ rawValue(b.boss?.rank.end) }}</template></Column><Column header="Rank change"><template #body="{ data: b }">{{ b.boss && b.boss.rank.start >= 0 && b.boss.rank.end >= 0 ? number(b.boss.rank.gained) : '—' }}</template></Column></DataTable><p class="footnote">A negative rank change means an improved hiscore rank. Unknown ranks are not aggregated.</p></section>
              </template><div v-else class="empty-state">No player data is available in this export.</div>
            </template>

            <template v-if="page === 'Bosses'">
              <div class="boss-layout"><aside class="panel boss-list"><div class="section-heading"><h3>Boss catalog</h3><span class="chart-tag">{{ keys.length }}</span></div><InputText v-model="bossSearch" placeholder="Find a boss…" aria-label="Search bosses" class="w-full" /><div class="boss-list-scroll"><button v-for="k in keys.filter(k => bossName(k).toLowerCase().includes(bossSearch.toLowerCase()))" :key="k" :class="{ selected: focusBoss === k }" @click="selectedBoss = k; bossFilter = null"><span>{{ bossName(k) }}</span><small>{{ number(total(filtered, 'kills', [k])) }}</small></button><p v-if="!keys.filter(k => bossName(k).toLowerCase().includes(bossSearch.toLowerCase())).length" class="muted">No matching bosses.</p></div></aside><div class="boss-content" v-if="focusBoss"><section class="panel boss-title"><div class="boss-portrait"><WikiImage :title="bossName(focusBoss)" :size="80" /></div><span class="eyebrow">BOSS INTELLIGENCE</span><h2>{{ bossName(focusBoss) }}</h2><a :href="bossWiki(focusBoss)" target="_blank" rel="noopener noreferrer" class="source-link">Explore on OSRS Wiki <i class="pi pi-external-link"></i></a><div class="summary-inline"><span><strong>{{ number(total(filtered, 'kills', [focusBoss])) }}</strong> recorded kills</span><span><strong>{{ number(total(filtered, 'ehb', [focusBoss]), 'ehb') }}</strong> gained EHB</span><span><strong>{{ filtered.filter(p => (bossValue(p, focusBoss, 'kills') ?? 0) > 0).length }}</strong> active players</span></div></section><section class="panel"><h3>Team comparison · {{ metricLabel }}</h3><InsightChart :option="bars(teams.filter(t => !teamFilter || teamFilter === t), teams.filter(t => !teamFilter || teamFilter === t).map(t => total(allPeople.filter(p => p.team === t), metric, [focusBoss])), teams.filter(t => !teamFilter || teamFilter === t).map(colorFor), metric)" label="Selected boss team comparison" /><div class="table-scroll"><table><thead><tr><th>Team</th><th>Kills</th><th>EHB</th></tr></thead><tbody><tr v-for="team in teams.filter(t => !teamFilter || teamFilter === t)" :key="team"><th :style="{ color: colorFor(team) }">{{ team }}</th><td>{{ number(total(allPeople.filter(p => p.team === team), 'kills', [focusBoss])) }}</td><td>{{ number(total(allPeople.filter(p => p.team === team), 'ehb', [focusBoss]), 'ehb') }}</td></tr></tbody></table></div></section><section class="panel"><h3>Related bingo tiles</h3><div class="related-tiles"><button v-for="entry in sourceTiles" :key="entry.id" @click="tile = entry"><WikiImage :title="entry.icon" /><span><small>{{ entry.id }}</small>{{ entry.name }}</span><i class="pi pi-arrow-up-right"></i></button><p v-if="!sourceTiles.length" class="muted">No bingo tile is mapped to this boss.</p></div></section><section class="panel"><h3>Player leaderboard</h3><PlayerTable :players="filtered" :keys="[focusBoss]" :metric="metric" @select="openPerson" /></section></div></div>
            </template>
          </template>
          <footer class="footer"><div><strong>Read the data, not your luck.</strong><p>Recorded kills are participant credits, not unique shared encounters. EHB is standardized effort, not actual hours. Snapshot boundaries may differ from the event window.</p><p>{{ unknownKills }} boss records have an unknown kill boundary. {{ anomalies }} negative anomalies excluded from affected calculations. Missing coverage makes totals partial.</p></div><details><summary>Sources & image credits</summary><p>Competition data from <a :href="`https://wiseoldman.net/competitions/${data.competition.id}`" target="_blank" rel="noopener noreferrer">Wise Old Man</a>. {{ attributionCount }} cached item images from OSRS Wiki; individual file pages carry their attribution and licensing details.</p><div class="attribution-links"><a v-for="(asset, title) in manifest" :key="title" :href="asset.source" target="_blank" rel="noopener noreferrer">{{ title }}</a></div></details></footer>
          <TileDrawer :tile="tile" :barrows="barrows" :players="allPeople" :dataset="data" @close="tile = null; barrows = null" @person="openPerson" />
        </template>
      </main>
    </div>
  </div>
</template>
