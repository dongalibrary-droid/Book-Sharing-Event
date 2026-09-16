const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const cache = new Map();
const batches = [];
let locked = false;
let flushed = false;
const context = vm.createContext({
  Set,
  CacheService: { getScriptCache: () => ({ get: k => cache.get(k), put: (k, v) => cache.set(k, v), remove: k => cache.delete(k) }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'test-key' }) },
  Utilities: { base64EncodeWebSafe: s => Buffer.from(s).toString('base64url'), computeDigest: (_, s) => crypto.createHash('sha256').update(s).digest(), DigestAlgorithm: { SHA_256: 'sha256' }, getUuid: () => 'request', formatDate: () => 'now' },
  LockService: { getScriptLock: () => ({ waitLock: () => { assert.equal(locked, false); locked = true; }, releaseLock: () => { locked = false; } }) },
  SpreadsheetApp: { flush: () => { assert.equal(locked, true); flushed = true; } },
  UrlFetchApp: { fetchAll: requests => {
    batches.push(requests);
    return requests.map(({url}) => {
      const u = new URL(url);
      const title = u.searchParams.get('Query');
      return { getResponseCode: () => title === 'error' ? 503 : 200,
        getContentText: () => JSON.stringify({ item: title === 'fallback' && u.searchParams.get('QueryType') === 'Title' ? [] : [{ title, cover: 'cover' }] }) };
    });
  } },
});
vm.runInContext(fs.readFileSync('apps-script/career-book-giveaway/Code.gs', 'utf8'), context);
const books = Array.from({length: 8}, (_, i) => ({bookId: String(i), title: 'book' + i}));
books.push({bookId: 'f', title: 'fallback'}, {bookId: 'e', title: 'error'});
const result = context.fetchAladinMetaBatch_({items: books});
assert.equal(result.f.cover, 'cover');
assert.equal(result.e.cover, '');
assert.ok(batches.every(batch => batch.length <= 6));
assert.ok(batches.some(batch => batch.length === 6));
assert.equal(batches.flat().filter(r => new URL(r.url).searchParams.get('Query') === 'error').length, 1);
batches.length = 0;
context.fetchAladinMetaBatch_({items: books.slice(0, 8)});
assert.equal(batches.length, 0, 'cached metadata makes no external requests');
let charged = 0;
context.reserveMetadataBudget_ = count => { charged += count; return true; };
context.fetchAladinMetaBatch_({items: [{bookId:'quota', title:'quota'}], reserveBudget: true});
assert.equal(charged, 1, 'only actual outgoing requests are charged, not seven per book');
context.fetchAladinMetaBatch_({items: [{bookId:'quota', title:'quota'}], reserveBudget: true});
assert.equal(charged, 1, 'cache hits use no quota');
context.reserveMetadataBudget_ = () => false;
const exhausted = {items: [{bookId:'waiting', title:'waiting'}], reserveBudget: true};
assert.equal(context.fetchAladinMetaBatch_(exhausted).waiting.collectionStatus, '대기');
assert.equal(exhausted.budgetExhausted, true);
assert.equal(result.e.collectionStatus, '오류', 'real API errors remain distinct from quota stops');

// A freshly built ID index stays correct after a sheet sort.
const headers = vm.runInContext('BOOK_HEADERS', context);
const rows = [headers, ...Array.from({length: 100}, (_, i) => {
  const row = Array(headers.length).fill(''); row[0] = 'b' + i; row[2] = 'title' + i; row[12] = '1'; return row;
})];
const reads = [];
const sheet = { getLastRow: () => rows.length, getRange: (r, c, n, m) => {
  reads.push([r, c, n, m]); return { getDisplayValues: () => rows.slice(r-1, r-1+n).map(row => row.slice(c-1, c-1+m)) };
} };
context.getSpreadsheet_ = () => ({getSheetByName: () => sheet});
assert.equal(context.getBookMap_([{bookId: 'b90'}]).b90.title, 'title90');
assert.ok(reads.every(r => r[2] === 1 || r[3] === 1), 'no full book table read');
[rows[1], rows[91]] = [rows[91], rows[1]];
assert.equal(context.getBookMap_([{bookId: 'b90'}]).b90.title, 'title90');

// Submission must reject an already active book even with an empty display cache.
cache.set('careerBookPending', '[]');
const rh = vm.runInContext('REQUEST_HEADERS', context);
const requestRows = [rh, ['r', '', '신청접수', '', '', '', '', '', '', 'b90']];
const requestSheet = {getLastRow: () => requestRows.length, getRange: (r,c,n,m) => ({ getDisplayValues: () => {
  assert.equal(locked, true); return requestRows.slice(r-1,r-1+n).map(row => row.slice(c-1,c-1+m));
}, setValues: () => { throw new Error('unexpected write'); }})};
context.getSpreadsheet_ = () => ({getSheetByName: name => name === '도서목록' ? sheet : requestSheet});
const payload = {books: [{bookId:'b90'}], studentName:'test', studentId:'id', phone:'01012345678', pickupCampus:'한림도서관(승학)'};
assert.throws(() => context.submitApplication_(payload), /이미 신청 진행중/);
assert.equal(locked, false);
context.getPendingBookIdSet_ = () => ({});
assert.throws(() => context.submitApplication_({...payload, books: [payload.books[0], payload.books[0]]}), /이미 신청 진행중/);
assert.equal(locked, false);
requestSheet.getRange = () => ({setValues: values => { assert.equal(locked, true); assert.equal(values.length, 1); }});
assert.equal(context.submitApplication_(payload).ok, true);
assert.equal(flushed, true);
assert.equal(locked, false);
context.cancelApplicationLocked_ = () => { assert.equal(locked, true); throw new Error('cancel failure'); };
assert.throws(() => context.cancelApplication_({}), /cancel failure/);
assert.equal(locked, false);
context.ensureSheets_ = () => { throw new Error('setup must not run during reads'); };
context.json_ = x => x;
context.readPublicSettings_ = () => ({});
assert.equal(context.doGet({parameter:{action:'settings'}}).ok, true);
console.log('PASS: bounded metadata batches, cache reuse, search fallback, ID index after sorting, fresh conflict checks, duplicate rejection, write locks, read-only routing');
