const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

let now = Date.parse('2026-09-29T09:00:00+09:00');
class Clock extends Date { static now() { return now; } }
let locked = false;
let writes = 0;
const context = vm.createContext({
  Date: Clock,
  Utilities: {
    formatDate: date => new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 19).replace('T', ' '),
    getUuid: () => 'request-id',
  },
  LockService: { getScriptLock: () => ({ waitLock() { locked = true; }, releaseLock() { locked = false; } }) },
  SpreadsheetApp: { flush() {} },
  CacheService: { getScriptCache: () => ({ remove() {} }) },
});
vm.runInContext(fs.readFileSync('apps-script/career-book-giveaway/Code.gs', 'utf8'), context);
const parse = context.parseOperationDate_;
assert.equal(parse('', false), null);
assert.equal(parse('2026-09-29', false), Date.parse('2026-09-29T00:00:00+09:00'));
assert.equal(parse('2026-09-29', true), Date.parse('2026-09-29T23:59:59.999+09:00'));
assert.equal(parse('2026-09-29 00:00', true), Date.parse('2026-09-29T00:00:00+09:00'));
assert.equal(parse(new Clock(now), false), now);
for (const value of ['bad', '2026-02-30', '2026-09-29 24:00', '2026-13-01', '2026-09-29 09:61', 123]) {
  assert.ok(Number.isNaN(parse(value, false)), `invalid date: ${value}`);
}
assert.equal(context.operationPeriod_('2026-10-01', '2026-09-29').valid, false);
assert.equal(context.operationPeriod_('', '').valid, true);
let period = context.operationPeriod_('2026-09-29 09:00:00', '2026-09-29 18:00:00');
for (const [time, expected] of [[period.startsAt - 1, false], [period.startsAt, true], [period.endsAt, true], [period.endsAt + 1, false]]) {
  assert.equal(context.isOperationPeriodActive_(period, time), expected);
}

// Migrate without touching other sheets or overwriting administrator inputs.
const rows = [['설정항목', '값', '설명'], ['운영시작일시', '2026-09-29 09:00:00', 'custom note']];
const operationSheet = {
  getLastRow: () => rows.length,
  getRange(r, c, n = 1, m = 1) {
    const read = () => rows.slice(r - 1, r - 1 + n).map(row => row.slice(c - 1, c - 1 + m));
    return { getValues: read, getDisplayValues: read, setNumberFormat() {}, setWrap() {},
      setValues(values) { values.forEach((row, i) => { rows[r - 1 + i] = Array.from(row); }); } };
  },
  setFrozenRows() {}, setColumnWidth() {},
};
const requestSheet = { getLastRow: () => 1, getRange: () => ({ setValues() { assert.ok(locked); writes++; } }) };
const ss = { getSheetByName: name => name === '운영' ? operationSheet : requestSheet };
context.getSpreadsheet_ = () => ss;
context.ensureOperationSheet_(ss);
context.ensureOperationSheet_(ss);
assert.equal(rows.length, 7);
assert.deepEqual(rows[1], ['운영시작일시', '2026-09-29 09:00:00', 'custom note']);
rows[0][0] = 'occupied';
assert.throws(() => context.ensureOperationSheet_(ss), /기존 데이터/);
rows[0][0] = '설정항목';
const set = (key, value) => { rows.find(row => row[0] === key)[1] = value; };
context.getBookMap_ = () => ({ b1: { title: 'Book', availableQuantity: 1 } });
context.getPendingBookIdSet_ = () => ({});
const payload = { studentId: 'id', studentName: 'name', phone: '01012345678', pickupCampus: '한림도서관(승학)', books: [{ bookId: 'b1' }] };
set('운영종료일시', '2026-09-29 18:00:00');
for (const instant of [period.startsAt - 1, period.endsAt + 1]) {
  now = instant;
  assert.throws(() => context.submitApplication_(payload), /신청 기간 아님/);
  assert.equal(writes, 0);
  assert.equal(locked, false);
}
now = period.startsAt;
assert.equal(context.submitApplication_(payload).ok, true);
assert.equal(writes, 1);
set('운영종료일시', 'invalid');
assert.throws(() => context.submitApplication_(payload), /신청 기간 아님/);
set('운영종료일시', '2026-09-29 18:00:00');
context.getBookMap_ = () => { now = period.endsAt + 1; return { b1: { title: 'Book' } }; };
assert.throws(() => context.submitApplication_(payload), /신청 기간 아님/, 'deadline during book reads is checked again before writing');
assert.equal(writes, 1);
set('팝업이미지URL', 'javascript:alert(1)');
assert.equal(context.readOperation_().popup.imageUrl, '');
set('팝업이미지URL', 'https://example.org/notice.png');
set('팝업시작일시', '2026-09-21');
set('팝업종료일시', '2026-09-28');
const operation = context.readOperation_();
assert.equal(operation.popup.imageUrl, 'https://example.org/notice.png');
assert.equal(context.isOperationPeriodActive_(operation.popup, Date.parse('2026-09-28T23:59:59.999+09:00')), true);
assert.equal(context.isOperationPeriodActive_(operation.popup, Date.parse('2026-09-29T00:00:00+09:00')), false);
context.getSpreadsheet_ = () => ({ getSheetByName: () => null });
assert.equal(context.isOperationPeriodActive_(context.readOperation_().application, now), true, 'unmigrated sheet preserves existing service');

// Real frontend functions: period precedence, local boundary changes and daily popup storage.
const elements = new Map();
const storage = new Map();
const events = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, { dataset: {}, addEventListener(name, callback) { events.set(`${id}:${name}`, callback); },
    close() { this.open = false; }, showModal() { this.open = true; } });
  return elements.get(id);
};
const client = vm.createContext({ Date: Clock, window: {}, localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) },
  document: { body: { dataset: { page: 'guide' } }, addEventListener() {}, querySelectorAll: () => [], getElementById: element } });
vm.runInContext(fs.readFileSync('public/assets/js/app.js', 'utf8').replace(/\}\)\(\);\s*$/, `
window.api = {state, els, periodActive, applicationPeriodLabel, updateOperationUi, updateNoticePopup, updateDetailActionButtons, renderBookCard, canApplyBook, bindCommon, operationDay};
})();`), client);
const api = client.window.api;
const book = { bookId:'b1', title:'Book' };
assert.equal(api.canApplyBook(book), false, 'unconfirmed operation never enables application');
api.state.pendingLoaded = true;
api.state.operation = operation;
api.state.operationReceivedAt = now;
operation.serverNow = now;
assert.equal(api.applicationPeriodLabel(), '신청 기간 아님');
assert.match(api.renderBookCard(book, 0), /disabled>신청 기간 아님/);
const apply = {}, cart = {};
api.updateDetailActionButtons(book, apply, cart);
assert.equal(apply.disabled, true);
assert.equal(cart.textContent, '신청 기간 아님');
const submit = { dataset: {} };
api.els.applyForm = { querySelector: () => submit, addEventListener() {} };
api.els.applyCart = { addEventListener() {} };
api.updateOperationUi();
assert.equal(submit.disabled, true);
assert.equal(api.els.applyCart.textContent, '신청 기간 아님');
operation.application = { valid: true, startsAt: null, endsAt: now + 1000 };
api.updateOperationUi();
assert.equal(submit.disabled, false);
assert.equal(api.canApplyBook(book), true);
now += 1001;
api.updateOperationUi();
assert.equal(submit.disabled, true, 'already open form disables when the period ends');

api.bindCommon();
operation.popup = { valid:true, startsAt:null, endsAt:null, imageUrl:'https://example.org/notice.png', alt:'Notice' };
api.updateNoticePopup();
assert.equal(element('noticePopup').open, true);
events.get('noticeHideToday:click')();
assert.equal(element('noticePopup').open, false);
api.updateNoticePopup();
assert.equal(element('noticePopup').open, false, 'hidden for the Korean calendar day');
now = Date.parse(api.operationDay() + 'T23:59:59.999+09:00');
api.updateNoticePopup();
assert.equal(element('noticePopup').open, false);
now++;
api.updateNoticePopup();
assert.equal(element('noticePopup').open, true, 'shows again at Korea midnight');
events.get('noticeClose:click')();
api.updateNoticePopup();
assert.equal(element('noticePopup').open, false, 'normal close survives background refresh in the same page');
operation.popup.imageUrl = 'https://example.org/new-notice.png';
api.updateNoticePopup();
assert.equal(element('noticePopup').open, true, 'a different notice is not hidden');
operation.popup.endsAt = now - 1;
api.updateNoticePopup();
assert.equal(element('noticePopup').open, false);
console.log('PASS: operation migration, KST/date-only boundaries, invalid input, server write guard, every action label, open-form expiry and popup daily dismissal.');
