// Optional integration check: requires Playwright and its Chromium browser.
// Runs against local files and mocked Apps Script responses; never calls the live sheet.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../public');
const sample = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/career-books.json'), 'utf8')).books[0];
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png'}[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless:true });
  try {
    const context = await browser.newContext({ viewport: {width:1280, height:900} });
    let mode = 'closed';
    let popup = true;
    let startsAt = null;
    let endsAt = null;
    const errors = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'script.google.com') {
        const action = url.searchParams.get('action');
        if (action === 'operation') {
          if (mode === 'offline') return route.abort();
          return route.fulfill({ json: {ok:true, operation: {serverNow:Date.now(),
            application:{valid:true, startsAt: mode === 'closed' ? Date.now() + 86400000 : startsAt, endsAt},
            popup:{valid:true, startsAt:null, endsAt:null, imageUrl:popup ? 'https://notice.test/notice.png' : '', alt:'도서 나눔 일시 중단 안내'},
          }} });
        }
        if (action === 'settings') return route.fulfill({json:{ok:true, settings:{}}});
        if (action === 'pending' || action === 'myRequests') return route.fulfill({json:{ok:true, entries:[]}});
        if (action === 'books') return route.fulfill({json:{ok:true, books:[sample]}});
        return route.fulfill({json:{ok:true, items:{}}});
      }
      if (url.hostname === 'notice.test') return route.fulfill({path:path.join(root, 'assets/images/operation-notice.png'),contentType:'image/png'});
      if (url.origin === base) return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const go = async file => {
      await page.goto(base + '/' + file, {waitUntil:'domcontentloaded'});
      await page.waitForFunction(() => document.querySelector('#noticePopup')?.open);
      await page.waitForFunction(() => document.querySelector('#noticePopupImage')?.naturalWidth > 0);
    };
    for (const file of ['index.html', 'catalog.html', `detail.html?id=${encodeURIComponent(sample.bookId)}`, 'status.html', 'guide.html']) {
      await go(file);
      await page.locator('#noticeClose').click();
      if (file.startsWith('catalog') || file.startsWith('detail')) await page.waitForSelector('#globalLoading.show', {state:'hidden'});
      const buttons = page.locator('[data-apply-book], [data-cart-book], #applyCart, #detailApply, #detailCart, #pageDetailApply, #pageDetailCart, #applyForm button[type="submit"]');
      for (const button of await buttons.all()) {
        assert.equal(await button.isDisabled(), true, file);
        assert.equal(await button.textContent(), '신청 기간 아님', file);
      }
    }
    await go('catalog.html');
    await page.screenshot({path:'outputs/operation-popup-desktop.png'});
    await page.setViewportSize({width:390, height:844});
    await page.screenshot({path:'outputs/operation-popup-mobile.png'});
    const rect = await page.locator('#noticePopup').boundingBox();
    assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 390 && rect.y + rect.height <= 844);
    await page.locator('#noticeHideToday').click();
    await page.goto(base + '/guide.html');
    await page.waitForFunction(() => document.querySelector('#applyCart')?.textContent === '신청 기간 아님');
    assert.equal(await page.locator('#noticePopup').evaluate(el => el.open), false, 'today dismissal survives navigation');

    // Open period: all real actions recover, including form submission.
    popup = false;
    mode = 'open';
    await page.evaluate(() => localStorage.setItem('careerBookUser', JSON.stringify({studentName:'Test',studentId:'id',phone:'01012345678'})));
    await page.goto(base + '/catalog.html');
    await page.waitForFunction(() => document.querySelector('[data-apply-book]')?.disabled === false);
    await page.locator('[data-apply-book]').first().click();
    assert.equal(await page.locator('#applyForm button[type="submit"]').isEnabled(), true);
    await page.locator('[data-apply-close]').first().click();
    await page.locator('[data-cart-book]').first().click();
    assert.equal(await page.locator('#applyCart').isEnabled(), true);

    // Known deadline changes while the form is already open, without another API read.
    endsAt = Date.now() + 10000;
    await page.goto(base + '/catalog.html');
    await page.waitForFunction(() => document.querySelector('[data-apply-book]')?.disabled === false);
    await page.locator('[data-apply-book]').first().click();
    await page.waitForFunction(() => document.querySelector('#applyForm button[type="submit"]')?.textContent === '신청 기간 아님');
    assert.equal(await page.locator('#applyForm button[type="submit"]').isDisabled(), true);
    endsAt = null;
    mode = 'offline';
    await page.goto(base + '/catalog.html');
    await page.waitForFunction(() => document.querySelector('[data-apply-book]')?.textContent === '신청 기간 확인 필요');
    assert.equal(await page.locator('[data-apply-book]').first().isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log('PASS: five actual pages, disabled/enabled actions, navigation persistence, open-form deadline, offline guard, desktop/mobile popup layout, no browser errors.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
