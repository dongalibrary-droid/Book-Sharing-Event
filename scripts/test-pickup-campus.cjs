const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps-script/career-book-giveaway/Code.gs'), 'utf8');
const context = vm.createContext({
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ remove() {} }) },
  Utilities: { getUuid: () => String(++sequence) },
});
let sequence = 0;
vm.runInContext(source, context);
const headers = vm.runInContext('REQUEST_HEADERS.slice()', context);
const legacy = Array.from(headers.slice(0, -1));
const oldRow = legacy.map((_, i) => `old-${i}`);
const data = [legacy.slice(), oldRow.slice()];
let columns = 17;
const sheet = {
  getMaxColumns: () => columns,
  insertColumnsAfter: (_, count) => { columns += count; },
  getMaxRows: () => 100,
  getLastRow: () => data.length,
  getRange(row, col, rows = 1, cols = 1) {
    return {
      getDisplayValue: () => String(data[row - 1]?.[col - 1] || ''),
      getDisplayValues: () => Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => String(data[row + r - 1]?.[col + c - 1] || ''))),
      isBlank: () => data.slice(row - 1, row - 1 + rows).every(r => !r[col - 1]),
      setValue(value) { data[row - 1][col - 1] = value; },
      setValues(values) {
        assert.equal(values.length, rows);
        values.forEach((valuesRow, i) => {
          assert.equal(valuesRow.length, cols);
          data[row + i - 1] = Array.from(valuesRow);
        });
      },
    };
  },
};
context.ensurePickupCampusColumn_(sheet);
context.ensurePickupCampusColumn_(sheet);
assert.equal(columns, 18);
assert.deepEqual(data[0], Array.from(headers));
assert.deepEqual(data[1], oldRow);
data[0][17] = 'existing';
assert.throws(() => context.ensurePickupCampusColumn_(sheet), /기존 데이터/);
data[0][17] = '수령캠퍼스';
context.getSpreadsheet_ = () => ({ getSheetByName: () => sheet });
context.getBookMap_ = () => ({ b1: { title: 'Book 1' }, b2: { title: 'Book 2' } });
context.getPendingBookIdSet_ = () => ({});
context.nowKst_ = () => '2026-09-11 12:00:00';
const payload = { studentName: 'Test', studentId: '123', phone: '01012345678', books: [{ bookId: 'b1' }, { bookId: 'b2' }] };
for (const pickupCampus of [undefined, '', '승학', 'invalid']) {
  assert.throws(() => context.submitApplication_({ ...payload, pickupCampus }), /반드시 수령 캠퍼스/);
  assert.equal(data.length, 2);
}
for (const pickupCampus of ['한림도서관(승학)', '부민도서관(부민)']) {
  assert.equal(context.submitApplication_({ ...payload, pickupCampus }).count, 2);
  assert.ok(data.slice(-2).every(row => row[17] === pickupCampus));
  assert.ok(context.readMyRequests_(payload).slice(0, 2).every(entry => entry.pickupCampus === pickupCampus));
}
assert.deepEqual(data[1], oldRow);
console.log('PASS: migration is idempotent, preserves existing data, and rejects occupied R columns; invalid campuses are rejected; both campuses persist for every book and appear in request history.');
