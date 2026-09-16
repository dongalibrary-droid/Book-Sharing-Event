const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(count = 37) {
  let now = Date.parse('2026-09-17T09:00:00+09:00');
  let locked = false;
  let triggers = [];
  const properties = new Map();
  const books = Array.from({length: count}, (_, i) => ({bookId: `b${i}`, title: `Book ${i}`}));
  const context = vm.createContext({
    console: {log() {}},
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } },
    SpreadsheetApp: {flush() {}},
    LockService: {getUserLock: () => ({
      tryLock: () => { assert.equal(locked, false); locked = true; return true; },
      releaseLock: () => { locked = false; },
    })},
    PropertiesService: {getScriptProperties: () => ({
      getProperty: key => properties.get(key),
      setProperty: (key, value) => properties.set(key, value),
      deleteProperty: key => properties.delete(key),
    })},
    Utilities: { formatDate: () => new Date(now + 9 * 3600000).toISOString().slice(0, 10) },
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: trigger => { triggers = triggers.filter(t => t !== trigger); },
      newTrigger: handler => {
        const trigger = { getHandlerFunction: () => handler };
        const builder = {timeBased: () => builder, after: ms => { trigger.delay = ms; return builder; },
          everyMinutes: minutes => { trigger.interval = minutes; return builder; }, create: () => { triggers.push(trigger); return trigger; }};
        return builder;
      },
    },
  });
  vm.runInContext(fs.readFileSync('apps-script/career-book-giveaway/Code.gs', 'utf8'), context);
  const rows = [Array.from(vm.runInContext('META_HEADERS', context))];
  const sheet = {getLastRow: () => rows.length, getMaxRows: () => 1000,
    getRange: (r, c, n, m) => ({
      getDisplayValues: () => Array.from({length:n}, (_, i) => Array.from({length:m}, (_, j) => String(rows[r+i-1]?.[c+j-1] ?? ''))),
      setValues: values => values.forEach((row, i) => { rows[r+i-1] = Array.from(row); }),
    }),
  };
  context.getSpreadsheet_ = () => ({getSheetByName: () => sheet});
  context.ensureSheet_ = () => sheet;
  context.getAladinKey_ = () => 'key';
  context.nowKst_ = () => 'now';
  context.readBooks_ = () => books;
  context.fetchAladinMetaBatch_ = ({items}) => Object.fromEntries(items.map(book => [book.bookId, {
    ...context.normalizeAladinItem_(null), collectionStatus: '완료', cover: 'cover',
  }]));
  return { context, rows, properties, advance: ms => { now += ms; }, triggers: () => triggers, locked: () => locked };
}

let f = fixture();
assert.equal(f.context.syncBookMetadata().processed, 12);
f.context.installBookMetadataTrigger();
assert.equal(f.triggers().length, 1);
assert.equal(f.context.syncAllBookMetadata().processed, 25, 'one click continues past the first batch and preserves existing rows');
assert.equal(f.rows.length, 38);
assert.equal(f.triggers().length, 0, 'completion removes continuation and legacy periodic trigger');
assert.equal(f.properties.has('METADATA_SYNC_ALL'), false);
assert.equal(f.locked(), false);

f = fixture();
const fetch = f.context.fetchAladinMetaBatch_;
f.context.fetchAladinMetaBatch_ = params => { f.advance(90001); return fetch(params); };
assert.equal(f.context.syncAllBookMetadata().processed, 24);
assert.equal(f.triggers().length, 1);
assert.equal(f.triggers()[0].delay, 60000);
assert.equal(f.context.continueBookMetadataSync().remaining, 0);
assert.equal(f.rows.length, 38);

f = fixture();
f.context.fetchAladinMetaBatch_ = params => {
  params.budgetExhausted = true;
  return Object.fromEntries(params.items.map(book => [book.bookId, {collectionStatus:'대기'}]));
};
assert.equal(f.context.syncAllBookMetadata().processed, 0);
assert.equal(f.rows.length, 1, 'unsent books are not stored as API failures');
assert.ok(f.triggers()[0].delay > 12 * 3600000, 'quota resumes the following KST day');
f.context.stopAllBookMetadataSync();
assert.equal(f.triggers().length, 0);
assert.equal(f.context.continueBookMetadataSync(), undefined, 'a queued execution cannot restart a stopped collection');

f = fixture(5);
f.context.fetchAladinMetaBatch_ = ({items}) => {
  f.advance(180001);
  return Object.fromEntries(items.map((book, i) => [book.bookId, {collectionStatus: i < 2 ? '완료' : '대기'}]));
};
assert.equal(f.context.syncAllBookMetadata().processed, 2);
assert.equal(f.rows.length, 3, 'time-limited partial batch saves only completed results');
assert.equal(f.triggers()[0].delay, 60000, 'unfinished searches resume promptly');

f = fixture(1);
f.context.fetchAladinMetaBatch_ = ({items}) => ({[items[0].bookId]: {collectionStatus:'오류'}});
assert.equal(f.context.syncAllBookMetadata().remaining, 1);
assert.equal(f.triggers()[0].delay, 86400000, 'real API failure respects the cooldown');

f = fixture();
f.context.readBooks_ = () => { throw new Error('Sheet unavailable'); };
assert.throws(() => f.context.syncAllBookMetadata(), /Sheet unavailable/);
assert.equal(f.triggers().length, 1);
assert.equal(f.triggers()[0].delay, 3600000);
assert.equal(f.properties.get('METADATA_SYNC_ALL'), '1');
assert.equal(f.locked(), false);
console.log('PASS: whole-catalog collection, preserved rows, automatic continuation/stop, time and quota limits, partial saves, cooldowns, recovery');
