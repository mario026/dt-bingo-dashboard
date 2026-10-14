import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient, exportCompetitionBossData } from './export-competition.ts';

const competition = {
  id: 160537, title: 'Bingo', startsAt: '2026-10-09T10:00:00.000Z',
  endsAt: '2026-10-18T19:00:00.000Z', participantCount: 3,
  participations: ['alice', 'bob', 'charlie'].map((username, index) => ({
    playerId: index + 1, teamName: index < 2 ? 'Red' : 'Blue',
    player: { id: index + 1, username, displayName: username },
    createdAt: '2026-10-08T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
  })),
};
const boss = { metric: 'abyssal_sire', kills: { start: -1, end: -1, gained: 0 },
  rank: { start: -1, end: -1, gained: 0 }, ehb: { start: 0, end: 0, gained: 0 } };

test('exports every player by team using exact competition dates and preserves unranked values', async () => {
  const paths: string[] = [];
  const result = await exportCompetitionBossData(160537, {
    request: async <T>(path: string): Promise<T> => {
      paths.push(path);
      return (paths.length === 1 ? competition : {
        startsAt: '2026-10-09T10:05:00.000Z', endsAt: '2026-10-14T18:00:00.000Z',
        data: { bosses: { abyssal_sire: boss } },
      }) as T;
    },
  });
  assert.equal(result.complete, true);
  assert.equal(result.successfulPlayers, 3);
  assert.deepEqual(result.teams.map(t => [t.name, Object.keys(t.players)]), [
    ['Red', ['alice', 'bob']], ['Blue', ['charlie']],
  ]);
  for (const path of paths.slice(1)) {
    const url = new URL(path, 'https://api.wiseoldman.net');
    assert.equal(url.searchParams.get('startDate'), competition.startsAt);
    assert.equal(url.searchParams.get('endDate'), competition.endsAt);
  }
  assert.deepEqual(result.teams[0].players.alice.bosses?.abyssal_sire, boss);
  assert.equal(result.teams[0].players.alice.snapshotRange?.startsAt, '2026-10-09T10:05:00.000Z');
});

test('keeps failed players visible and continues fetching the remaining roster', async () => {
  const result = await exportCompetitionBossData(160537, {
    request: async <T>(path: string): Promise<T> => {
      if (path === '/competitions/160537') return competition as T;
      if (path.includes('/bob/')) throw new Error('HTTP 404: no snapshots');
      return { startsAt: null, endsAt: null, data: { bosses: { abyssal_sire: boss } } } as T;
    },
  });
  assert.equal(result.complete, false);
  assert.equal(result.failedPlayers, 1);
  assert.equal(result.successfulPlayers, 2);
  assert.equal(result.teams[0].players.bob.status, 'error');
  assert.equal(result.teams[0].players.bob.bosses, null);
  assert.match(result.teams[0].players.bob.error!, /no snapshots/);
  assert.equal(result.teams[1].players.charlie.status, 'ok');
});

test('rejects invalid IDs and incomplete competition rosters', async () => {
  await assert.rejects(exportCompetitionBossData(0), /positive integer/);
  await assert.rejects(exportCompetitionBossData(160537, {
    request: async <T>() => ({ ...competition, participantCount: 4 }) as T,
  }), /participant count/);
});

test('serializes concurrent callers and spaces every request below the rate limit', async () => {
  const originalFetch = globalThis.fetch;
  const starts: number[] = [];
  globalThis.fetch = async () => {
    starts.push(performance.now());
    return new Response('{}', { status: 200 });
  };
  try {
    const request = createApiClient();
    await Promise.all([request('/one'), request('/two'), request('/three')]);
    assert.equal(starts.length, 3);
    assert.ok(starts[1] - starts[0] >= 3_000);
    assert.ok(starts[2] - starts[1] >= 3_000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
