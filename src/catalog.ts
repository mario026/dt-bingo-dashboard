import { bossValue, total, type Person } from './analytics.ts';

export const wiki = (title: string) => `https://oldschool.runescape.wiki/w/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
export interface Source {
  metric: string; probability?: number; rate: string;
  mode: 'fixed' | 'scenario'; note: string; wiki: string; verifiedAt: string | null;
  quantity?: number;
}
export interface Component { name: string; required: number; alternatives?: string[]; sources: Source[]; note?: string; wiki: string }
export interface Tile { id: string; name: string; points: number; requirement: string; icon: string; components: Component[] }
export interface Crypt { name: string; epithet: string; icon: string; tiles: Tile[] }
const checked = '2026-10-14';
const titles: Record<string, string> = {
  kril_tsutsaroth: "K'ril Tsutsaroth", kreearra: "Kree'arra", vetion: "Vet'ion", calvarion: "Calvar'ion",
  barrows_chests: 'Barrows', lunar_chests: 'Lunar Chest', the_royal_titans: 'Royal Titans',
  the_hueycoatl: 'The Hueycoatl', shellbane_gryphon: 'Shellbane Gryphon', mad_angel: 'Mad Angel',
  maggot_king: 'Maggot King', alchemical_hydra: 'Alchemical Hydra', king_black_dragon: 'King Black Dragon',
  commander_zilyana: 'Commander Zilyana', general_graardor: 'General Graardor',
  phantom_muspah: 'Phantom Muspah', duke_sucellus: 'Duke Sucellus', the_whisperer: 'The Whisperer',
  the_leviathan: 'The Leviathan', phosanis_nightmare: "Phosani's Nightmare", nightmare: 'The Nightmare',
  doom_of_mokhaiotl: 'Doom of Mokhaiotl', chambers_of_xeric: 'Chambers of Xeric',
  chambers_of_xeric_challenge_mode: 'Chambers of Xeric/Challenge Mode',
  theatre_of_blood: 'Theatre of Blood', theatre_of_blood_hard_mode: 'Theatre of Blood/Hard Mode',
  tombs_of_amascut: 'Tombs of Amascut', tombs_of_amascut_expert: 'Tombs of Amascut/Expert Mode',
  the_gauntlet: 'The Gauntlet', the_corrupted_gauntlet: 'The Gauntlet', chaos_fanatic: 'Chaos Fanatic',
};
export const bossName = (key: string) => key === 'the_corrupted_gauntlet' ? 'Corrupted Gauntlet' : titles[key] ?? key.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
export const bossWiki = (key: string) => wiki(titles[key] ?? bossName(key));
const f = (metric: string, probability: number, rate: string, note = 'Per recorded kill; excludes untracked minions.', page?: string, quantity = 1): Source => ({ metric, probability, rate, note, mode: 'fixed', wiki: page ? wiki(page) : bossWiki(metric), verifiedAt: checked, quantity });
const s = (metric: string, rate: string, note: string, page?: string, verified = true): Source => ({ metric, rate, note, mode: 'scenario', wiki: page ? wiki(page) : bossWiki(metric), verifiedAt: verified ? checked : null });
const c = (name: string, required: number, sources: Source[] = [], note?: string, alternatives?: string[], page = name): Component => ({ name, required, sources, note, alternatives, wiki: wiki(page) });
const t = (id: string, name: string, points: number, requirement: string, icon: string, components: Component[]): Tile => ({ id, name, points, requirement, icon, components });
const raid = (metric: string) => s(metric, 'Depends on reward points / contribution', 'Enter eligible personal reward rolls and effective item probability. Party completions are not unique loot rolls.');
const gwd = ['general_graardor', 'commander_zilyana', 'kreearra', 'kril_tsutsaroth'];
const virtus = ['Virtus mask', 'Virtus robe top', 'Virtus robe bottom'];
const any = (name: string, required: number, alternatives: string[], sources: Source[], note?: string) => c(name, required, sources, note, alternatives, alternatives[0]);

export const crypts: Crypt[] = [
  { name: 'Ahrim', epithet: 'The Blighted', icon: "Ahrim's hood", tiles: [
    t('A1', 'Elder Chaos Druid Robes Set', 2, 'Hood, Robe & Top', 'Elder chaos hood', [c('Elder chaos hood', 1), c('Elder chaos robe', 1), c('Elder chaos top', 1)]),
    t('A2', 'Malediction Ward', 2, 'Shard 1, Shard 2 & Shard 3', 'Malediction ward', [c('Malediction shard 1', 1, [f('chaos_fanatic', 1/256, '1/256')]), c('Malediction shard 2', 1, [f('crazy_archaeologist', 1/256, '1/256')]), c('Malediction shard 3', 1, [f('scorpia', 1/256, '1/256')])]),
    t('A3', 'Virtus Piece', 3, 'Any Virtus armour piece', 'Virtus mask', [any('Any Virtus piece', 1, virtus, [['vardorvis', '3/3264'], ['duke_sucellus', '3/2160'], ['the_whisperer', '3/1536'], ['the_leviathan', '3/2304']].map(([m, rate]) => s(m, `${rate} (any piece, normal mode)`, 'Normal and awakened attempts have different rates and are not separated in the export. Enter eligible normal-mode rolls and probability.')))]),
    t('B1', 'Dragon Hunter Wand', 2, 'Dragon hunter wand', 'Dragon hunter wand', [c('Dragon hunter wand', 1, [s('the_hueycoatl', '1/105 at full contribution', 'Loot probability scales with contribution; group KC cannot establish eligible rolls.')])]),
    t('B2', 'Occult Necklace (2x)', 1, '2 × Occult necklace', 'Occult necklace', [c('Occult necklace', 2, [f('thermonuclear_smoke_devil', 1/350, '1/350')], 'Ordinary smoke devil kills are not tracked.')]),
    t('B3', 'Smoke Ancient Sceptre', 2, 'Ancient staff, Ancient Icon & Smoke Quartz', 'Smoke ancient sceptre', [c('Ancient staff', 1, [f('chaos_fanatic', 1/128, '1/128'), f('thermonuclear_smoke_devil', 1/107, '1/107')]), c('Ancient icon', 1, [f('phantom_muspah', 2/100, '2/100')]), c('Smoke quartz', 1, [s('the_leviathan', 'Base ~1/206; dry protection', 'Quartz chance depends on personal drop history and dry protection; enter effective probability.')])]),
    t('C1', 'Ancestral Piece', 3, 'Any Ancestral armour piece', 'Ancestral hat', [any('Any Ancestral piece', 1, ['Ancestral hat', 'Ancestral robe top', 'Ancestral robe bottom'], [raid('chambers_of_xeric'), raid('chambers_of_xeric_challenge_mode')])]),
    t('C2', 'Twinflame Staff', 2, 'Ice elemental staff crown & Fire elemental staff crown', 'Twinflame staff', [c('Ice element staff crown', 1, [s('the_royal_titans', '1/75 per eligible Eldric loot', 'Royal Titans KC does not identify which titan was looted or contribution.', 'Eldric the Ice King')]), c('Fire element staff crown', 1, [s('the_royal_titans', '1/75 per eligible Branda loot', 'Royal Titans KC does not identify which titan was looted or contribution.', 'Branda the Fire Queen')])]),
    t('C3', 'Trident Of The Swamp', 2, 'Trident (Kraken) & Magic Fang', 'Trident of the swamp', [c('Trident of the seas', 1, [f('kraken', 1/512, '1/512')], 'Boss Kraken source only; cave kraken counts are unavailable.'), c('Magic fang', 1, [f('zulrah', 2/1024, '2 rolls × 1/1024')])]),
  ] },
  { name: 'Dharok', epithet: 'The Wretched', icon: "Dharok's helm", tiles: [
    t('D1', 'Noxious Halberd', 3, '3 components; duplicates allowed (Mag 3x zelfde item zijn)', 'Noxious halberd', [any('Any Noxious component', 3, ['Noxious pommel', 'Noxious point', 'Noxious blade'], [s('araxxor', '1/200 for any component when harvested', 'Destroying a corpse forfeits loot; KC does not record harvest choice. Do not sum 1/200 three times.')])]),
    t('D2', 'Saradomin Sword', 2, 'Saradomin sword', 'Saradomin sword', [c('Saradomin sword', 1, [f('commander_zilyana', 1/127, '1/127')])]),
    t('D3', 'Bandos Godsword', 2, '3 Godsword shards (any) + Bandos Hilt', 'Bandos godsword', [any('Any Godsword shard', 3, ['Godsword shard 1', 'Godsword shard 2', 'Godsword shard 3'], gwd.map(m => f(m, 3/762, '3/762 (any shard)')), 'Event allows any three shards; minion drops are unavailable.'), c('Bandos hilt', 1, [f('general_graardor', 1/508, '1/508')])]),
    t('E1', 'Black Mask (3x)', 1, '3 × Black mask', 'Black mask', [c('Black mask', 3)]),
    t('E2', 'Oathplate Piece', 3, 'Any Oathplate piece', 'Oathplate helm', [any('Any Oathplate piece', 1, ['Oathplate helm', 'Oathplate chest', 'Oathplate legs'], [s('yama', '3/600 at base contribution', 'Contribution and contracts affect rewards; enter effective probability and eligible rolls.')])]),
    t('E3', 'Hallowfell (2x)', 1, '2 × Hallowfell', 'Hallowfell', [c('Hallowfell', 2, [f('mad_angel', 1/127, '1/127')])]),
    t('F1', 'Hydra Leather', 2, 'Hydra leather', 'Hydra leather', [c('Hydra leather', 1, [f('alchemical_hydra', (1999/2000)**2*(999/1000)*(511/512)/512, '~1/514 (effective pre-roll rate)')])]),
    t('F2', 'Granite Longsword (2x)', 2, '2 × Granite longsword', 'Granite longsword', [c('Granite longsword', 2)]),
    t('F3', 'Avernic TREADS', 3, 'Avernic treads', 'Avernic treads', [c('Avernic treads', 1, [s('doom_of_mokhaiotl', '1/1350–1/540; delve 4+', 'Drop chance depends on delve level. Aggregate KC does not identify eligible delves.')])]),
  ] },
  { name: 'Guthan', epithet: 'The Infested', icon: "Guthan's helm", tiles: [
    t('G1', "Belle's Folly (3x)", 1, "3 × Belle's folly (from tarnished drops)", "Belle's folly", [c("Belle's folly (tarnished)", 3, [f('shellbane_gryphon', 1/75, '1/75', 'Solo instanced boss; unique pre-roll occurs once per kill.', 'Shellbane gryphon')])]),
    t('G2', 'Treasonous Ring', 2, 'Treasonous ring', 'Treasonous ring', [c('Treasonous ring', 1, [s('venenatis', '1/512 before loot eligibility', 'Shared Wilderness loot eligibility requires explicit rolls.'), f('spindel', 1/716, '1/716')])]),
    t('G3', 'Dragon Harpoon', 2, 'Must be a PvM drop (Moet PVM drop zijn)', 'Dragon harpoon', [c('Dragon harpoon', 1, [], 'Wyrm / eligible PvM sources are untracked. Tempoross fishing rewards are excluded by the event rule.')]),
    t('H1', 'Dragon Pickaxe', 2, 'Only KQ or KBD (Moet van KQ of KBD)', 'Dragon pickaxe', [c('Dragon pickaxe', 1, [f('kalphite_queen', 1/400, '1/400'), f('king_black_dragon', 1/1000, '1/1000')])]),
    t('H2', 'Zamorakian Spear (2x)', 2, '2 × Zamorakian spear', 'Zamorakian spear', [c('Zamorakian spear', 2, [f('kril_tsutsaroth', 1/127, '1/127')])]),
    t('H3', 'Tormented Synapse (2x)', 2, '2 × Tormented synapse', 'Tormented synapse', [c('Tormented synapse', 2)]),
    t('I1', 'Boots of Brimstone (2x)', 2, "2 × Drake's claw", 'Boots of brimstone', [c("Drake's claw", 2)]),
    t('I2', 'Torva Piece', 3, 'Torva Helm, Platebody or Legs', 'Torva full helm', [any('Any Torva piece', 1, ['Torva full helm (damaged)', 'Torva platebody (damaged)', 'Torva platelegs (damaged)'], [s('nex', '3/258 (any piece), before contribution', 'Group loot is contribution-weighted. Individual kill credits are not unique team encounters.')])]),
    t('I3', 'Dragon Platelegs', 2, 'Perfect Duke Sucellus', 'Dragon platelegs', [c('Dragon platelegs', 1, [s('duke_sucellus', '1/100; quantity depends on perfect kill', 'Only Perfect Duke kills qualify. KC cannot establish perfect kills or their loot quantities.')])]),
  ] },
  { name: 'Karil', epithet: 'The Tainted', icon: "Karil's coif", tiles: [
    t('J1', 'Dragon Crossbow', 2, 'Dragon Limbs', 'Dragon crossbow', [c('Dragon limbs', 1)]),
    t('J2', 'Aranea Boots (3x)', 1, '3 × Aranea boots', 'Aranea boots', [c('Aranea boots', 3)]),
    t('J3', 'Armadyl Helmet', 2, 'Armadyl helmet', 'Armadyl helmet', [c('Armadyl helmet', 1, [f('kreearra', 1/381, '1/381')])]),
    t('K1', 'Masori Piece', 3, 'Masori Helm, Body or Legs', 'Masori mask', [any('Any Masori piece', 1, ['Masori mask', 'Masori body', 'Masori chaps'], [raid('tombs_of_amascut'), raid('tombs_of_amascut_expert')])]),
    t('K2', 'Ballista', 2, 'Ballista Spring, Limbs, Monkey tail & Heavy or Light frame', 'Heavy ballista', [c('Ballista spring', 1), c('Ballista limbs', 1), c('Monkey tail', 1), any('Heavy or Light frame', 1, ['Heavy frame', 'Light frame'], [])]),
    t('K3', 'Etched Elder Venator Fang', 3, 'Etched elder venator fang', 'Etched elder venator fang', [c('Elder venator fang', 1, [s('maggot_king', '1/340 when looting the corpse', 'Taking eggs uses a different reward table. KC does not record corpse interaction.')], 'Crafted into the etched fang with a chisel.')]),
    t('L1', 'Crystal Legs', 2, '2 Crystal armour seeds; crafting materials not tracked', 'Crystal legs', [c('Crystal armour seed', 2, [f('the_gauntlet', 1/120, '1/120'), f('the_corrupted_gauntlet', 1/50, '1/50', 'Successful Corrupted Gauntlet completion.', 'The Gauntlet')])]),
    t('L2', 'Aquanite Tendon (2x)', 1, '2 × Aquanite tendon', 'Aquanite tendon', [c('Aquanite tendon', 2)]),
    t('L3', "Seercull + Archer's Ring", 1, 'Seercull & Archers ring', 'Seercull', [c('Seercull', 1, [f('dagannoth_supreme', 1/128, '1/128')]), c('Archers ring', 1, [f('dagannoth_supreme', 1/128, '1/128')])]),
  ] },
  { name: 'Torag', epithet: 'The Corrupted', icon: "Torag's helm", tiles: [
    t('M1', 'Zombie Helmet (3x)', 1, '3 × Zombie helmet', 'Zombie helmet', [c('Zombie helmet', 3)]),
    t('M2', 'Inquisitor Piece', 3, 'Inquisitor Helm, Body or Legs', "Inquisitor's great helm", [any('Any Inquisitor piece', 1, ["Inquisitor's great helm", "Inquisitor's hauberk", "Inquisitor's plateskirt"], [s('nightmare', 'Varies with party size and contribution', 'Provide eligible personal rolls and effective probability.'), f('phosanis_nightmare', 3/700, '3/700 (any piece)')])]),
    t('M3', 'Blood Moon Armour', 2, '4 × Blood moon piece (any)', 'Blood moon helm', [any('Any Blood moon piece', 4, ['Blood moon helm', 'Blood moon chestplate', 'Blood moon tassets', 'Dual macuahuitl'], [s('lunar_chests', 'Depends on defeated moons and duplicate protection', 'Chest KC does not identify defeated moons or collection state.', 'Lunar Chest')])]),
    t('N1', 'Sarachnis Cudgel (2x)', 2, '2 × Sarachnis cudgel', 'Sarachnis cudgel', [c('Sarachnis cudgel', 2, [f('sarachnis', 1/384, '1/384')])]),
    t('N2', 'Amulet of Torture', 2, 'Zenyte shard & (uncut) onyx via PvM', 'Amulet of torture', [c('Zenyte shard', 1), c('Uncut onyx', 1, [f('zulrah', 2/1024, '2 rolls × 1/1024'), s('zalcano', '1/8000 per qualifying loot roll', 'Loot eligibility depends on contribution; KC does not establish reward rolls.')], 'Only supported PvM sources are included.')]),
    t('N3', 'Dragon Warhammer', 2, 'Dragon warhammer', 'Dragon warhammer', [c('Dragon warhammer', 1)]),
    t('O1', 'Tyrannical Ring', 2, 'Tyrannical ring', 'Tyrannical ring', [c('Tyrannical ring', 1, [s('callisto', '1/512 before loot eligibility', 'Shared Wilderness loot requires eligible rolls.'), f('artio', 1/716, '1/716')])]),
    t('O2', 'Granite Hammer', 2, 'Granite hammer', 'Granite hammer', [c('Granite hammer', 1, [f('grotesque_guardians', 2/750, '2 rolls × 1/750')])]),
    t('O3', 'Hill Giant Club', 1, 'Hill giant club', 'Hill giant club', [c('Hill giant club', 1, [s('obor', '1/118 per Obor chest', 'Chest openings require an extra giant key and are not established by Obor KC.', "Chest (Obor's lair)")])]),
  ] },
  { name: 'Verac', epithet: 'The Defiled', icon: "Verac's helm", tiles: [
    t('P1', 'Visage', 2, 'Draconic, Wyvern or Skeletal visage', 'Draconic visage', [any('Any eligible visage', 1, ['Draconic visage', 'Wyvern visage', 'Skeletal visage'], [f('king_black_dragon', 1/5000, '1/5000 (Draconic)'), f('vorkath', 2/5000, '2/5000 (Draconic or Skeletal)')], 'Wyvern kills are not exported; the supported expectation excludes them.')]),
    t('P2', 'Echo Crystal', 3, 'Echo crystal', 'Echo crystal', [c('Echo crystal', 1, [], 'Colosseum wave rewards cannot be inferred from Sol Heredit completions.')]),
    t('P3', 'Obsidian Armour Set', 2, 'Obsidian Helm, Body & Legs', 'Obsidian helmet', [c('Obsidian helmet', 1), c('Obsidian platebody', 1), c('Obsidian platelegs', 1)]),
    t('Q1', 'Granite Boots', 1, 'Granite boots', 'Granite boots', [c('Granite boots', 1)]),
    t('Q2', 'Blood Shard (3x)', 1, '3 × Blood shard; PvM drop', 'Blood shard', [c('Blood shard', 3, [], 'Pickpocketed shards are excluded; Vyrewatch Sentinel kills are unavailable.')]),
    t('Q3', 'Blessed Spirit Shield', 2, 'Spirit shield & Holy Elixer', 'Blessed spirit shield', [c('Spirit shield', 1, [f('corporeal_beast', 8/512, '8/512', 'Corp KC is credited to the player receiving loot.')]), c('Holy elixir', 1, [f('corporeal_beast', 3/512, '3/512', 'Corp KC is credited to the player receiving loot.')])]),
    t('R1', 'Basilisk Jaw', 2, 'Basilisk jaw', 'Basilisk jaw', [c('Basilisk jaw', 1)]),
    t('R2', 'Justiciar Piece', 3, 'Any Justiciar armour piece', 'Justiciar faceguard', [any('Any Justiciar piece', 1, ['Justiciar faceguard', 'Justiciar chestguard', 'Justiciar legguards'], [raid('theatre_of_blood'), raid('theatre_of_blood_hard_mode')])]),
    t('R3', 'Primordial Boots', 2, 'Primordial Crystal & Dragon Boots', 'Primordial boots', [c('Primordial crystal', 1, [f('cerberus', 1/520, '1/520')]), c('Dragon boots', 1, [], 'Spiritual mage kills are not exported; do not substitute K’ril KC.')]),
  ] },
];

export const allTiles = crypts.flatMap(c => c.tiles);
export const tileMetrics = (tile: Tile) => [...new Set(tile.components.flatMap(c => c.sources.map(s => s.metric)))];
export function componentEstimate(component: Component, ps: Person[]): { expected: number | null; partial: boolean } {
  const fixed = component.sources.filter(s => s.mode === 'fixed' && s.verifiedAt && s.probability !== undefined);
  let expected: number | null = null;
  let missing = false;
  for (const source of fixed) {
    const count = total(ps, 'kills', [source.metric]);
    if (ps.some(p => bossValue(p, source.metric, 'kills') === null)) missing = true;
    if (count !== null) expected = (expected ?? 0) + count * source.probability! * (source.quantity ?? 1);
  }
  return { expected, partial: missing || fixed.length !== component.sources.length };
}
