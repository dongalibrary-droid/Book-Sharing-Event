const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { mergeMetadata, sourceKey } = require('./import-book-metadata.cjs');
const context = vm.createContext({ console, SpreadsheetApp: { flush() {} }, LockService: {
  getUserLock: () => ({ tryLock: () => true, releaseLock() {} }),
  getScriptLock: () => { throw new Error('Metadata must not block applications'); },
}, UrlFetchApp: { fetch() { throw new Error('Public lookup called Aladin'); }, fetchAll() { throw new Error('Public lookup called Aladin'); } } });
vm.runInContext(fs.readFileSync('apps-script/career-book-giveaway/Code.gs', 'utf8'), context);
const headers = Array.from(vm.runInContext('META_HEADERS', context));
const rows = [headers.slice()];
const sheet = {
  getMaxRows: () => 1000,
  getLastRow: () => rows.length,
  getRange: (r, c, n, m) => ({
    getDisplayValues: () => Array.from({length:n}, (_, i) => Array.from({length:m}, (_, j) => String(rows[r+i-1]?.[c+j-1] ?? ''))),
    setValues: values => values.forEach((row, i) => { rows[r+i-1] = Array.from(row); }),
  }),
};
let batches = 0;
let jobs = 0;
const books = [
  {bookId: 'a', title: 'Book', author: 'Author'},
  {bookId: 'b', title: 'Book', author: 'Author'},
  {bookId: 'e', title: 'Error'},
  {bookId: 'n', title: 'No match'},
];
context.getSpreadsheet_ = () => ({ getSheetByName: () => sheet });
context.readBooks_ = () => books;
context.getAladinKey_ = () => 'test';
context.nowKst_ = () => 'now';
context.ensureSheet_ = () => sheet;
const properties = new Map();
context.PropertiesService = { getScriptProperties: () => ({ getProperty: key => properties.get(key), setProperty: (key, value) => properties.set(key, value) }) };
context.Utilities = { formatDate: () => '2026-09-16' };
assert.equal(context.reserveMetadataBudget_(4000), true);
assert.equal(context.reserveMetadataBudget_(1), false);
context.Utilities.formatDate = () => '2026-09-17';
assert.equal(context.reserveMetadataBudget_(1), true, 'daily quota resets in the configured time zone');
context.json_ = x => x;
assert.equal(context.doPost({postData: {contents: JSON.stringify({action: 'savedBookMetaBatch', items: books})}}).items.a.cover, '');
context.fetchAladinMetaBatch_ = ({items}) => {
  batches++;
  jobs += items.length;
  return Object.fromEntries(items.map(book => [book.bookId, {...context.normalizeAladinItem_(null),
    cover: book.title === 'Book' ? 'https://example.org/cover.jpg' : '',
    description: book.title === 'Book' ? 'Description' : '',
    collectionStatus: book.title === 'Error' ? '오류' : book.title === 'No match' ? '미검색' : '완료',
  }]));
};
assert.equal(context.syncBookMetadata().processed, 4);
assert.equal(jobs, 3, 'identical searches share one external lookup');
assert.equal(rows.length, 5);
assert.equal(context.syncBookMetadata().processed, 0, 'finished/missing/error cooldown records are skipped');
assert.equal(batches, 1);
assert.equal(context.getBookMeta_({bookId:'a'}).description, 'Description');
assert.equal(context.getBookMeta_({...books[0], title:'Changed'}).cover, '', 'changed catalog cannot reuse stale metadata');
assert.equal(context.getBookMetaBatch_({items: [null, books[1]]}).b.cover, 'https://example.org/cover.jpg');
rows.find(row => row[0] === 'e')[12] = '1';
assert.equal(context.syncBookMetadata().processed, 1, 'temporary failure retries after cooldown');
books[0].title = 'Changed';
assert.equal(context.syncBookMetadata().processed, 1, 'changed source is recollected');
assert.equal(rows.length, 5, 'updates do not append duplicate IDs');
rows[0][1] = 'Unexpected';
assert.throws(() => context.syncBookMetadata(), /열 제목/);
rows[0][1] = headers[1];

let exported;
context.DriveApp = {createFile: (name, data, type) => { exported = JSON.parse(data); return { getUrl: () => 'private-file' }; }};
context.exportBookMetadata();
assert.ok(exported.items.a);
assert.equal(exported.items.e, undefined, 'temporary errors are not frozen into static files');
assert.equal(JSON.stringify(exported).includes('test-key'), false);
const catalog = { books: [ {...books[1]}, {...books[1], bookId: 'mismatch', title:'Changed', metadata:{cover:'old'}, metadataSourceKey:'old'} ] };
exported.items.b.secret = 'not public';
assert.equal(mergeMetadata(catalog, exported), 1);
assert.equal(catalog.books[0].metadata.description, 'Description');
assert.equal(catalog.books[0].metadata.secret, undefined);
assert.equal(catalog.books[1].metadata, undefined);
assert.equal(context.metadataSourceKey_(books[1]), sourceKey(books[1]));
console.log('PASS: saved-only public lookup, duplicate reuse, resumable collection, error cooldown, source changes, schema validation, safe static export/import');
