const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.argv[2] || 'public/assets/js/app.js', 'utf8').replace(/\}\)\(\);\s*$/, `
  window.testApi = { filterBooks, renderBooks, renderBookCard, state, els };
})();`);
const context = vm.createContext({
  window: {},
  document: { body: {dataset: {page:'catalog'}}, addEventListener() {}, querySelectorAll: () => [] },
  localStorage: {getItem: () => null},
});
vm.runInContext(source, context);
const {filterBooks, renderBooks, renderBookCard, state, els} = context.window.testApi;
const catalog = JSON.parse(fs.readFileSync('public/assets/data/career-books.json', 'utf8'));
state.books = catalog.books.map(book => ({...book, searchText: book.title.toLowerCase()}));
Object.assign(els, {
  searchInput: {value:''}, sortSelect: {value:'default'},
  availableOnly: {checked:false}, hidePending: {checked:false},
  resultCount: {}, bookResults: {innerHTML:'', querySelectorAll: () => []},
  pager: {innerHTML:'', querySelectorAll: () => []},
});
filterBooks();
assert.equal(state.filtered.length, catalog.books.length);
assert.equal((els.bookResults.innerHTML.match(/class="book-card"/g) || []).length, 25);
assert.ok(els.bookResults.innerHTML.includes(catalog.books[0].bookId));
assert.ok(els.pager.innerHTML.includes('data-page="2"'));
state.page = 2;
renderBooks();
assert.ok(els.bookResults.innerHTML.includes(catalog.books[25].bookId));
state.view = 'grid';
renderBooks();
assert.equal(els.bookResults.className, 'book-results grid-view');
const covered = {...catalog.books[0], metadata:{cover:'https://example.org/cover.jpg'}};
assert.match(renderBookCard(covered, 0), /loading="eager"/);
assert.match(renderBookCard(covered, 6), /loading="lazy"/);
state.pendingIds.add(covered.bookId);
assert.match(renderBookCard(covered, 0), /disabled/);
els.searchInput.value = 'no-such-book-unique-test-query';
filterBooks();
assert.equal(state.filtered.length, 0);
assert.match(els.bookResults.innerHTML, /조건에 맞는 도서가 없습니다/);
console.log(`PASS: actual ${catalog.books.length}-book catalog renders, pagination/grid work, image priority and pending actions are correct, empty search renders`);
