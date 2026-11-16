const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractTags,
  normalizeRecord,
  createReviewDeck,
  validateImageMeta,
  createMemoryMediaStore,
} = require('../media-core.js');

test('extractTags returns unique tags without the hash symbol', () => {
  assert.deepEqual(extractTags('完成阅读 #生活 #阅读 #生活'), ['生活', '阅读']);
});

test('normalizeRecord migrates old records without changing their content', () => {
  const old = {id:'1', text:'旧记录 #工作', mood:'calm', dateKey:'2026-11-01', ts:1, timeText:'2026-11-01 08:00'};
  assert.deepEqual(normalizeRecord(old), {...old, tags:['工作'], mediaIds:[]});
});

test('review deck visits every record once before reshuffling', () => {
  const deck = createReviewDeck(['a','b','c'], () => 0.4);
  const seen = [deck.next(), deck.next(), deck.next()];
  assert.equal(new Set(seen).size, 3);
  deck.previous();
  assert.equal(deck.next(), seen[2]);
  assert.equal(deck.next(), seen[0]);
});

test('image metadata enforces three files and eight megabytes', () => {
  assert.equal(validateImageMeta({type:'image/jpeg', size:8 * 1024 * 1024}), true);
  assert.equal(validateImageMeta({type:'image/gif', size:10}), false);
  assert.equal(validateImageMeta({type:'image/png', size:8 * 1024 * 1024 + 1}), false);
});

test('memory media store keeps blobs isolated and deletes requested ids', async () => {
  const store = createMemoryMediaStore();
  const id = await store.put(new Blob(['photo'], {type:'image/png'}), {name:'photo.png'});
  assert.equal((await store.get(id)).type, 'image/png');
  await store.deleteMany([id]);
  assert.equal(await store.get(id), null);
});
