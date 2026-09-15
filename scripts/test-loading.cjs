const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const publicDir = path.resolve(__dirname, '../public');
const books = JSON.parse(fs.readFileSync(path.join(publicDir, 'assets/data/career-books.json'), 'utf8')).books;

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['slow', 'failure', 'cached-failure', 'timeout', 'storage-full']) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let releasePending;
      const pendingGate = new Promise(resolve => { releasePending = resolve; });
      if (mode === 'cached-failure') {
        await page.addInitScript(({ id }) => localStorage.setItem('careerBookPendingIds', JSON.stringify({ savedAt: Date.now(), ids: [id] })), { id: books[0].bookId });
      }
      if (mode === 'storage-full') {
        await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); }; });
      }
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'test.local') {
          const file = path.join(publicDir, decodeURIComponent(url.pathname));
          return route.fulfill({ path: file });
        }
        if (url.hostname === 'script.google.com') {
          if (url.searchParams.get('action') === 'pending') {
            await pendingGate;
            return route.fulfill({ json: mode.includes('failure') ? { ok: false, message: 'Unavailable' } : {
              ok: true, entries: [{ bookId: books[0].bookId, registrationNo: books[0].registrationNo }],
            } });
          }
          return route.fulfill({ json: { ok: true, settings: {}, items: {} } });
        }
        return route.abort();
      });
      if (mode === 'timeout') await page.clock.install();
      await page.goto('https://test.local/catalog.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelectorAll('.book-card').length === 25 && !document.querySelector('#globalLoading.show'));
      assert.equal(await page.locator('#totalBooks').textContent(), books.length.toLocaleString('ko-KR'));
      if (mode !== 'cached-failure') {
        assert.equal(await page.locator('#availableBooks').textContent(), '-');
        assert.equal(await page.locator('[data-apply-book]:enabled').count(), 0);
      }
      // Pagination must work while the status request is still pending.
      await page.locator('#pagerTop [data-page="2"]').first().click();
      assert.equal(await page.locator('.book-card').count(), 25);
      if (mode === 'timeout') {
        await page.clock.fastForward(21000);
        await page.waitForFunction(() => document.querySelector('#availableBooks').title.includes('실패'));
      }
      releasePending();
      if (mode === 'slow' || mode === 'storage-full') {
        await page.waitForFunction(expected => document.querySelector('#availableBooks').textContent === expected, (books.length - 1).toLocaleString('ko-KR'));
        await page.locator('#pagerTop [data-page="1"]').first().click();
        assert.equal(await page.locator(`[data-apply-book="${books[0].bookId}"]`).isDisabled(), true);
        assert.equal(await page.locator('[data-apply-book]:enabled').count(), 24);
      } else if (mode.includes('failure')) {
        await page.waitForFunction(() => document.querySelector('#availableBooks').title.includes('실패'));
        assert.equal(await page.locator('#availableBooks').textContent(), mode === 'cached-failure' ? (books.length - 1).toLocaleString('ko-KR') : '-');
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${mode}: catalog usable before pending response; availability remains accurate`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
