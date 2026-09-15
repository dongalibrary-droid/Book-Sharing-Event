const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps-script/career-book-giveaway/Code.gs'), 'utf8');
const stored = new Map();
const context = vm.createContext({
  CacheService: { getScriptCache: () => ({ get: key => stored.get(key), put: (key, value) => stored.set(key, value), remove: key => stored.delete(key) }) },
  Utilities: { base64EncodeWebSafe: text => Buffer.from(text).toString('base64url') },
  UrlFetchApp: {},
});
vm.runInContext(source, context);
const books = JSON.parse(fs.readFileSync(path.join(root, 'public/assets/data/career-books.json'), 'utf8')).books;
context.readBooks_ = () => books.map(book => ({ ...book }));
context.readPendingRequests_ = () => [{ bookId: books[0].bookId }];
const first = context.readCatalog_({ page: '1' });
assert.equal(first.books.length, 25);
assert.equal(first.total, books.length);
assert.equal(first.summary.available, books.length - 1);
assert.equal(first.books[0].pending, true);
assert.equal(Object.values(first.summary.categories).reduce((a, b) => a + b, 0), books.length);
const second = context.readCatalog_({ page: '2' });
assert.equal(first.books.filter(a => second.books.some(b => a.bookId === b.bookId)).length, 0);
const category = books.at(-1).category;
const categoryPage = context.readCatalog_({ category, sort: 'title', pageSize: '50' });
assert.equal(categoryPage.total, books.filter(book => book.category === category).length);
assert.ok(categoryPage.books.every(book => book.category === category));
assert.deepEqual(Array.from(categoryPage.books, book => book.title), books.filter(book => book.category === category).sort((a, b) => a.title.localeCompare(b.title, 'ko')).slice(0, 50).map(book => book.title));
const search = context.readCatalog_({ query: books.at(-1).registrationNo });
assert.ok(search.books.some(book => book.bookId === books.at(-1).bookId));
assert.equal(context.readCatalog_({ availableOnly: '1' }).total, books.length - 1);
assert.equal(context.readCatalog_({ hidePending: '1' }).total, books.length - 1);
assert.equal(context.readCatalog_({ query: 'no-such-book-123456789', page: '500' }).page, 1);
assert.equal(context.readCatalog_({ pageSize: '9999' }).books.length, 50);
assert.equal(context.readBooksByIds_({ ids: JSON.stringify([books[0].bookId]) }).length, 1);
const headers = vm.runInContext('BOOK_HEADERS', context);
const indexes = context.headerIndexes_(headers);
const row = headers.map(() => '');
row[indexes['신청가능수량']] = '0';
assert.equal(context.rowToBook_(row, indexes).availableQuantity, 0);
row[indexes['신청가능수량']] = '';
assert.equal(context.rowToBook_(row, indexes).availableQuantity, 1);

// Parallel metadata lookup: one failed book cannot erase other results, and misses are cached.
context.getAladinKey_ = () => 'test-key';
const rounds = [];
context.UrlFetchApp.fetchAll = requests => {
  rounds.push(requests.length);
  return requests.map(({ url }) => ({
    getResponseCode: () => url.includes('broken') ? 503 : 200,
    getContentText: () => JSON.stringify({ item: url.includes('match') ? [{ cover: 'https://example.test/cover.jpg' }] : [] }),
  }));
};
const meta = context.getBookMetaBatch_({ items: [
  { bookId: 'a', title: 'match' }, { bookId: 'b', title: 'missing' }, { bookId: 'c', title: 'broken' },
] });
assert.deepEqual(rounds, [3, 1]);
assert.ok(meta.a.cover);
assert.equal(meta.b.cover, '');
assert.equal(meta.c, undefined);
context.getBookMetaBatch_({ items: [{ bookId: 'a', title: 'match' }, { bookId: 'b', title: 'missing' }] });
assert.deepEqual(rounds, [3, 1]);

async function testClient() {
  const element = () => ({ value: '', checked: false, innerHTML: '', textContent: '', className: '', setAttribute() {}, addEventListener() {}, querySelectorAll: () => [] });
  const elements = new Map();
  const requests = [];
  let appSource = fs.readFileSync(path.join(root, 'public/assets/js/app.js'), 'utf8');
  appSource = appSource.replace(/\}\)\(\);\s*$/, 'globalThis.testApi = { state, els, loadCatalogPage, hydrateVisibleCovers, loadBookIds, refreshPending }; })();');
  const client = vm.createContext({
    window: { CAREER_BOOKS_CONFIG: { appsScriptUrl: 'https://example.test/api' }, setTimeout: resolve => resolve() },
    document: { body: { dataset: { page: 'catalog' } }, addEventListener() {}, getElementById: id => {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    }, querySelectorAll: () => [], querySelector: () => null },
    localStorage: { getItem: () => null, setItem() {} },
    URL, URLSearchParams, Intl, setTimeout, clearTimeout,
    fetch: (url, options) => new Promise(resolve => requests.push({ url, options, resolve: payload => resolve({ ok: true, json: async () => payload }) })),
  });
  vm.runInContext(appSource, client);
  const api = client.testApi;
  for (const id of ['searchInput', 'sortSelect', 'availableOnly', 'hidePending', 'bookResults', 'resultCount', 'categoryList', 'pagerTop', 'pager', 'totalBooks', 'availableBooks']) api.els[id] = element();
  const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
  const response = (title, total = 1) => ({ ok: true, page: 1, total, summary: { total, available: total, categories: { Test: total } }, books: [{ bookId: title, title, category: 'Test', cover: 'https://example.test/cover.jpg' }] });

  const oldPage = api.loadCatalogPage();
  api.state.category = 'Test';
  const newPage = api.loadCatalogPage();
  requests[1].resolve(response('new'));
  await newPage;
  requests[0].resolve(response('old'));
  await oldPage;
  assert.ok(api.els.bookResults.innerHTML.includes('new'));
  assert.ok(!api.els.bookResults.innerHTML.includes('old'));
  assert.ok(requests.every(request => !request.url.includes('career-books.json')));

  // Reuse cached pages; prefetch exactly one next page without fetching its covers.
  const count = requests.length;
  await api.loadCatalogPage();
  assert.equal(requests.length, count);
  api.state.category = 'Many';
  const many = api.loadCatalogPage();
  requests.at(-1).resolve(response('many', 1000));
  await many;
  assert.equal(new URL(requests.at(-1).url).searchParams.get('page'), '2');
  const afterPrefetch = requests.length;
  requests.at(-1).resolve({ ...response('next', 1000), page: 2 });
  await flush();
  assert.equal(requests.length, afterPrefetch);

  // Cached/empty destinations cancel the remaining old cover batches.
  const coverBooks = Array.from({ length: 25 }, (_, index) => ({ bookId: 'cover-' + index, title: 'Cover ' + index }));
  const hydration = api.hydrateVisibleCovers(coverBooks);
  const batch = requests.at(-1);
  assert.equal(JSON.parse(batch.options.body).items.length, 6);
  await api.hydrateVisibleCovers([]);
  const before = requests.length;
  batch.resolve({ ok: true, items: {} });
  await hydration;
  assert.equal(requests.length, before);

  const details = api.loadBookIds(['cart-only']);
  const detailRequest = requests.at(-1);
  assert.equal(new URL(detailRequest.url).searchParams.get('action'), 'booksByIds');
  detailRequest.resolve({ ok: true, books: [{ bookId: 'cart-only', title: 'Cart', pending: false }] });
  await details;
  assert.ok(api.state.books.some(book => book.bookId === 'cart-only'));
  console.log('PASS: stale page responses ignored, next-page-only prefetch, cache reuse, obsolete cover work stopped, targeted cart loading.');
}

testClient().then(() => {
  console.log('PASS: catalog counts, global filtering/search/sorting, page bounds, zero quantity, ID lookup, batched metadata and negative cache.');
  console.log(JSON.stringify({ books: books.length, fullJsonBytes: fs.statSync(path.join(root, 'public/assets/data/career-books.json')).size,
    summaryBytes: Buffer.byteLength(JSON.stringify({ ok: true, summary: first.summary })), firstPageBytes: Buffer.byteLength(JSON.stringify(first)) }));
}).catch(error => { console.error(error); process.exitCode = 1; });
