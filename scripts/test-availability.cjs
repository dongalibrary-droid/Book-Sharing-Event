const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const rawSource = fs.readFileSync(process.argv[2] || 'public/assets/js/app.js', 'utf8');
const source = rawSource.replace(/\}\)\(\);\s*$/, `
  window.testApi = { refreshPending, renderAvailability, applyPendingChange, canApplyBook, startPendingRefresh, state, els };
})();`);

function fixture(cache = null) {
  const timers = new Map();
  const events = {};
  const storage = new Map(cache ? [['careerBookPendingIds', JSON.stringify(cache)]] : []);
  const calls = [];
  let sequence = 0;
  const context = vm.createContext({
    window: {CAREER_BOOKS_CONFIG: {appsScriptUrl: 'https://example.org/exec'},
      setInterval: callback => { events.interval = callback; }, addEventListener: (name, cb) => { events[name] = cb; }},
    document: {body: {dataset: {page:'catalog'}}, hidden:false, addEventListener: (name, cb) => { events[name] = cb; }, querySelectorAll: () => []},
    localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
    setTimeout: (callback, ms) => { const id = ++sequence; timers.set(id, {callback, ms}); return id; }, clearTimeout: id => timers.delete(id),
    AbortController, URL, console,
    fetch: (url, options) => new Promise((resolve, reject) => calls.push({url, options, resolve, reject})),
  });
  vm.runInContext(source, context);
  const api = context.window.testApi;
  api.state.operation = { application: { valid:true, startsAt:null, endsAt:null }, serverNow:Date.now() };
  api.state.operationReceivedAt = Date.now();
  api.state.books = ['a','b','c'].map(bookId => ({bookId, registrationNo:'r'+bookId, title:bookId, searchText:bookId, metadata:{}}));
  api.state.catalogReady = true;
  Object.assign(api.els, {searchInput:{value:''}, sortSelect:{value:'sourceNo'}, availableOnly:{checked:false}, hidePending:{checked:false},
    resultCount:{}, totalBooks:{}, availableBooks:{}, pendingStatus:{}, refreshLive:{}, bookResults:{querySelectorAll:()=>[]}});
  return {context, api, calls, timers, events, storage};
}

const tick = () => new Promise(resolve => setImmediate(resolve));
const respond = (call, entries) => call.resolve({ok:true, json:async()=>({ok:true, entries})});
(async () => {
  let f = fixture();
  f.api.renderAvailability();
  assert.equal(f.api.els.availableBooks.textContent, '-');
  assert.match(f.api.els.bookResults.innerHTML, /상태 확인 중/);
  assert.equal(f.api.canApplyBook(f.api.state.books[0]), false, 'unknown availability is not shown as available');
  const first = f.api.refreshPending(false);
  assert.equal(f.api.refreshPending(false), first, 'concurrent refresh calls share one request');
  await tick();
  assert.equal(f.calls.length, 1);
  assert.equal(new URL(f.calls[0].url).searchParams.get('refresh'), '1');
  respond(f.calls[0], [{bookId:'a', registrationNo:'ra'}]);
  assert.equal(await first, true);
  assert.equal(f.api.els.availableBooks.textContent, '2');
  assert.match(f.api.els.bookResults.innerHTML, /신청 진행중/);
  assert.equal(f.api.canApplyBook(f.api.state.books[1]), true);
  assert.equal(f.api.els.refreshLive.disabled, false);
  assert.equal(f.api.els.pendingStatus.hidden, true, 'routine success notice is hidden');
  assert.equal(f.api.els.pendingStatus.textContent, '');

  // A late read must not undo an application that succeeded during the read.
  const older = f.api.refreshPending(false);
  assert.equal(f.api.els.pendingStatus.hidden, true, 'routine background refresh stays quiet');
  await tick();
  f.api.applyPendingChange([f.api.state.books[1]], true);
  assert.equal(f.api.els.availableBooks.textContent, '1');
  const afterWrite = f.api.refreshPending(false, {force:true});
  respond(f.calls[1], [{bookId:'a'}]);
  assert.equal(await older, false);
  await tick();
  assert.equal(f.api.els.availableBooks.textContent, '1', 'late response cannot restore newly reserved book');
  respond(f.calls[2], [{bookId:'a'},{bookId:'b'}]);
  await afterWrite;
  f.api.applyPendingChange([f.api.state.books[1]], false);
  assert.equal(f.api.els.availableBooks.textContent, '2', 'successful cancellation updates the count immediately');

  // Failures preserve known state and schedule only two immediate retries.
  const failed = f.api.refreshPending(false);
  await tick();
  f.calls[3].reject(new Error('offline'));
  await failed;
  assert.equal(f.api.els.availableBooks.textContent, '2');
  assert.match(f.api.els.pendingStatus.textContent, /최근 확인 결과/);
  assert.equal(f.api.els.pendingStatus.hidden, false, 'failed reads remain visible');
  let retry = [...f.timers.values()].find(t=>t.ms===5000);
  assert.ok(retry);
  retry.callback(); await tick();
  const second = f.api.refreshPending(false);
  f.calls[4].reject(new Error('offline')); await second;
  retry = [...f.timers.values()].find(t=>t.ms===10000);
  assert.ok(retry);
  retry.callback(); await tick();
  const third = f.api.refreshPending(false);
  f.calls[5].reject(new Error('offline')); await third;
  assert.equal(f.timers.size, 0, 'retry limit stops repeated failures from making an endless loop');

  f = fixture();
  const noCacheFailure = f.api.refreshPending(false);
  await tick(); f.calls[0].reject(new Error('offline')); await noCacheFailure;
  assert.equal(f.api.els.availableBooks.textContent, '-');
  assert.match(f.api.els.bookResults.innerHTML, /상태 확인 필요/);
  assert.equal(f.api.els.refreshLive.disabled, false);

  f = fixture({ids:['a','ra'],savedAt:Date.now()-30000});
  f.api.renderAvailability();
  assert.equal(f.api.els.availableBooks.textContent, '2', 'recent navigation cache immediately restores counts');
  const oldTimestamp = f.api.state.pendingUpdatedAt;
  f.api.applyPendingChange([f.api.state.books[1]], true);
  assert.equal(JSON.parse(f.storage.get('careerBookPendingIds')).savedAt, oldTimestamp, 'one changed book does not extend the age of the full cache');
  f.api.startPendingRefresh();
  f.api.state.pendingUpdatedAt = 0;
  f.context.document.hidden = true;
  f.events.interval(); await tick(); assert.equal(f.calls.length, 0);
  f.context.document.hidden = false;
  f.events.visibilitychange(); await tick(); assert.equal(f.calls.length, 1);
  const resumed = f.api.refreshPending(false);
  respond(f.calls[0], []); await resumed;
  assert.equal(f.api.els.availableBooks.textContent, '3');
  assert.equal(fixture({ids:['a'],savedAt:Date.now()-180000}).api.state.pendingLoaded, false, 'expired cache is not trusted');
  console.log('PASS: unknown/loaded/error states, matching counts/cards, shared fresh reads, mutation race protection, immediate updates, bounded retries, cache age, visibility refresh');
})().catch(error=>{console.error(error);process.exitCode=1;});
