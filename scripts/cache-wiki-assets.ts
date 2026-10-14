import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { allTiles, crypts, bossName } from '../src/catalog.ts';

const destination = new URL('../public/images/', import.meta.url);
await mkdir(destination, { recursive: true });
const dataset = JSON.parse(await readFile(new URL('../output/competition-160537-bosses.json', import.meta.url), 'utf8'));
const bossTitles = [...new Set(dataset.teams.flatMap((t: any) => Object.values(t.players).flatMap((p: any) => Object.keys(p.bosses ?? {}).map(bossName))))] as string[];
const manifest: Record<string, { path: string; source: string }> = JSON.parse(await readFile(new URL('../src/wiki-images.json', import.meta.url), 'utf8').catch(() => '{}'));
const titles = [...new Set([...allTiles.map(t => t.icon), ...allTiles.flatMap(t => t.components.map(c => c.alternatives?.[0] ?? c.name)), ...crypts.map(c => c.icon), ...bossTitles])].filter(t => !manifest[t]);
const aliases: Record<string, string> = { 'Trident of the swamp': 'Trident of the Swamp', 'Trident of the seas': 'Trident of the Seas', 'Boots of brimstone': 'Boots of Brimstone', 'Blood moon helm': 'Blood Moon helm' };
const pause = () => new Promise(r => setTimeout(r, 500));
for (let offset = 0; offset < titles.length; offset += 40) {
  const batch = titles.slice(offset, offset + 40);
  const query = new URLSearchParams({ action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url', titles: batch.map(t => `File:${aliases[t] ?? t}.png`).join('|') });
  const response = await fetch(`https://oldschool.runescape.wiki/api.php?${query}`, { headers: { 'User-Agent': 'Darkturbo-bingo-local-dashboard/1.0' } });
  if (!response.ok) throw new Error(`Wiki API: HTTP ${response.status}`);
  const data = await response.json();
  const normalized = new Map<string, string>((data.query?.normalized ?? []).map((n: { from: string; to: string }) => [n.from, n.to]));
  for (const title of batch) {
    const fileTitle = `File:${aliases[title] ?? title}.png`;
    const file = normalized.get(fileTitle) ?? fileTitle;
    const page = Object.values(data.query?.pages ?? {}).find((p: any) => p.title === file) as any;
    const info = page?.imageinfo?.[0];
    if (!info?.url) { console.log(`No image: ${title}`); continue; }
    const asset = await fetch(info.url, { headers: { 'User-Agent': 'Darkturbo-bingo-local-dashboard/1.0' } });
    if (!asset.ok || !asset.headers.get('content-type')?.startsWith('image/')) { console.log(`Unavailable image: ${title}`); continue; }
    const filename = `${Object.keys(manifest).length + 1}.png`;
    await writeFile(new URL(filename, destination), Buffer.from(await asset.arrayBuffer()));
    manifest[title] = { path: `/images/${filename}`, source: info.descriptionurl };
    await pause();
  }
  await pause();
}
await writeFile(new URL('../src/wiki-images.json', import.meta.url), JSON.stringify(manifest, null, 2));
console.log(`Cached ${Object.keys(manifest).length} Wiki images.`);
