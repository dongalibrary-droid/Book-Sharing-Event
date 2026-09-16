const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('public/assets/js/app.js', 'utf8').replace(/\}\)\(\);\s*$/, `
  window.testApi = { fetchJson, postToSheet, loadBookMetadata, metaFromAladin, saveJson, state };
  window.testApi.catalogInit = async () => {
    let rendered = false;
    ensureSharedUi = ensureFooter = collectElements = renderAuth = bindCommon = applySiteSettings = loadSiteSettings = updateCart = bindCatalog = renderCategories = () => {};
    loadBooks = async () => {};
    refreshPending = () => new Promise(() => {});
    withLoading = (_, task) => task();
    filterBooks = () => { rendered = true; };
    await init();
    return rendered;
  };
})();`);
const context = vm.createContext({
  window: { CAREER_BOOKS_CONFIG: { appsScriptUrl: 'https://example.org/exec' }, setInterval() {}, addEventListener() {} },
  document: { body: {dataset: {page:'catalog'}}, addEventListener() {} },
  localStorage: { getItem: () => null, setItem() { throw new Error('Storage full'); } },
  setTimeout, clearTimeout, AbortController, URL, URLSearchParams, console,
});
vm.runInContext(source, context);
const api = context.window.testApi;
(async () => {
  // A stalled body must time out too, not just the initial response headers.
  context.fetch = (_, {signal}) => Promise.resolve({ok:true, json: () => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), {name:'AbortError'})));
  })});
  await assert.rejects(api.fetchJson('test', {}, 10), /응답이 지연/);
  await assert.rejects(api.fetchJson('test', {}, 10, true), /신청 진행상황을 먼저 확인/);
  assert.doesNotThrow(() => api.saveJson('test', {}));
  let calls = 0;
  let resolveResponse;
  context.fetch = () => { calls++; return new Promise(resolve => { resolveResponse = resolve; }); };
  const books = [{bookId:'a', title:'Book'}];
  const first = api.loadBookMetadata(books);
  const second = api.metaFromAladin(books[0]);
  assert.equal(calls, 1, 'list and detail share an in-flight request');
  resolveResponse({ok:true, json: async () => ({ok:true, items:{a:{}}})});
  await Promise.all([first, second]);
  await api.loadBookMetadata(books);
  assert.equal(calls, 1, 'empty saved results are reused for the current page session');
  const staticBook = {bookId:'s', metadata:{description:'Saved introduction'}};
  assert.equal((await api.metaFromAladin(staticBook)).description, 'Saved introduction');
  assert.equal(calls, 1, 'static metadata needs no Apps Script lookup');
  context.fetch = async () => { calls++; throw new Error('Offline'); };
  await api.loadBookMetadata([{bookId:'failure'}]);
  await api.loadBookMetadata([{bookId:'failure2'}]);
  assert.equal(calls, 2, 'failed batch has no individual fallback or immediate retry');
  assert.equal(await Promise.race([api.catalogInit(), new Promise(resolve => setTimeout(() => resolve(false), 50))]), true, 'catalog renders and finishes initial loading even when pending never responds');
  console.log('PASS: response-body deadline, uncertain-write guidance, optional storage, shared lookup, negative caching, static metadata, failure cooldown');
})().catch(error => { console.error(error); process.exitCode = 1; });
