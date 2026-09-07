(function () {
  const config = window.CAREER_BOOKS_CONFIG || {};
  const SETTINGS_TYPE_DELAY_MS = 5000;
  const COVER_PRIORITY_BATCH_SIZE = 6;
  const COVER_BACKGROUND_BATCH_SIZE = 8;
  const COVER_BACKGROUND_DELAY_MS = 180;
  const settingsStartedAt = Date.now();
  const siteDefaults = {
    SITE_TITLE: "도서 나눔 플랫폼",
    SITE_EYEBROW: "Library Book Sharing",
    SITE_DESCRIPTION: "로그인 후 도서 신청과 진행상황 확인을 한 곳에서 관리할 수 있습니다.",
    FOOTER_TITLE: "동좌문도",
    FOOTER_HEADING: "동아대학교 도서관",
    FOOTER_QUOTE: "“스승과 제자가 한자리에 앉아서 정도(正道)가 무엇인지 묻고 답한다.”",
    FOOTER_DESCRIPTION: "동아대학교 도서관도 함께 길을 물으며 설립자의 교육철학 이념을 따릅니다.",
  };
  const pageName = document.body.dataset.page || "catalog";
  const state = {
    books: [],
    filtered: [],
    pendingIds: new Set(),
    category: "전체",
    view: "list",
    page: 1,
    perPage: 25,
    selectedBooks: [],
    activeBook: null,
    myRequests: [],
    selectedRequestIds: new Set(),
    coverHydrationId: 0,
    siteSettings: { ...siteDefaults },
    coverCache: loadJson("careerBookCoverCache", {}),
    cart: loadJson("careerBookCart", []),
    user: loadJson("careerBookUser", null),
  };

  const $ = (id) => document.getElementById(id);
  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    ensureSharedUi();
    ensureFooter();
    collectElements();
    renderAuth();
    bindCommon();
    applySiteSettings();
    loadSiteSettings();

    if (pageName === "login") {
      if (state.user) {
        location.replace("catalog.html");
        return;
      }
      bindLogin();
      return;
    }

    if (pageName === "catalog") {
      await withLoading("도서 목록을 불러오는 중입니다.", async () => {
        await loadBooks();
        updateCart();
        bindCatalog();
        renderCategories();
        filterBooks();
      });
      refreshPending(false);
      return;
    }

    if (pageName === "detail") {
      bindDetailPage();
      await withLoading("도서 정보를 불러오는 중입니다.", async () => {
        await loadBooks();
        updateCart();
        renderDetailPage();
      });
      refreshPending(false).then(() => {
        renderDetailPage();
      });
      return;
    }

    if (pageName === "status") {
      updateCart();
      bindStatus();
      await withLoading("신청 진행상황을 불러오는 중입니다.", () => loadMyRequests(false));
      return;
    }

    if (hasCart()) updateCart();
  }

  function ensureSharedUi() {
    if (hasCart() && !document.querySelector(".floating-cart")) {
      document.body.insertAdjacentHTML("beforeend", `
        <button class="floating-cart" id="floatingCartButton" type="button" data-cart-open aria-label="장바구니 열기">
          <i class="fa-solid fa-cart-shopping"></i><span id="floatCartCount">0</span>
        </button>
      `);
    }
    if (hasCart() && !$("cartDrawer")) {
      document.body.insertAdjacentHTML("beforeend", `
        <aside class="drawer" id="cartDrawer" aria-hidden="true">
          <div class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="cartTitle">
            <div class="drawer-head">
              <h2 id="cartTitle">장바구니</h2>
              <button type="button" data-cart-close aria-label="닫기"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div id="cartItems" class="cart-items"></div>
            <div class="actions">
              <button type="button" class="ghost" id="clearCart">비우기</button>
              <button type="button" class="primary" id="applyCart">신청하기</button>
            </div>
          </div>
        </aside>
      `);
    }
    if (hasCart() && !$("applyModal")) {
      document.body.insertAdjacentHTML("beforeend", `
        <div class="modal" id="applyModal" aria-hidden="true">
          <form class="modal-panel apply-form" id="applyForm" role="dialog" aria-modal="true" aria-labelledby="applyTitle">
            <button class="close" type="button" data-apply-close aria-label="닫기"><i class="fa-solid fa-xmark"></i></button>
            <h2 id="applyTitle">도서 신청</h2>
            <p id="applySummary" class="muted"></p>
            <label class="memo-only">메모<textarea name="memo" rows="3" placeholder="담당자에게 남길 말이 있으면 입력하세요."></textarea></label>
            <div class="actions">
              <button type="button" class="ghost" data-apply-close>취소</button>
              <button type="submit" class="primary">신청 제출</button>
            </div>
          </form>
        </div>
      `);
    }
  }

  function ensureFooter() {
    if (document.querySelector(".library-footer")) return;
    const main = document.querySelector("main");
    if (!main) return;
    main.insertAdjacentHTML("afterend", `
      <footer class="library-footer">
        <div class="footer-links">
          <a href="https://www.donga.ac.kr/kor/CMS/Contents/Contents.do?mCode=MN174" target="_blank" rel="noopener">개인정보처리방침</a>
          <a href="https://library.donga.ac.kr/" target="_blank" rel="noopener">도서관 홈페이지</a>
          <a href="https://library.donga.ac.kr/about-our-library/overview/regulations/" target="_blank" rel="noopener">도서관 규정</a>
          <a href="https://library.donga.ac.kr/about-our-library/library-hours/" target="_blank" rel="noopener">도서관 이용시간</a>
        </div>
        <div class="footer-main">
          <div class="footer-brand">
            <img src="assets/images/white-logo.png" alt="동아대학교 도서관" />
            <div class="footer-about">
              <strong data-setting="FOOTER_TITLE">동좌문도</strong>
              <span data-setting="FOOTER_HEADING">동아대학교 도서관</span>
              <p data-setting="FOOTER_QUOTE">“스승과 제자가 한자리에 앉아서 정도(正道)가 무엇인지 묻고 답한다.”</p>
              <p data-setting="FOOTER_DESCRIPTION">동아대학교 도서관도 함께 길을 물으며 설립자의 교육철학 이념을 따릅니다.</p>
            </div>
          </div>
          <div class="footer-column">
            <strong>Quick Menu</strong>
            <a href="catalog.html">도서목록</a>
            <a href="status.html">신청 진행상황</a>
            <a href="guide.html">이용안내</a>
            <a href="https://library.donga.ac.kr/resource/" target="_blank" rel="noopener">자료검색</a>
            <a href="https://library.donga.ac.kr/research-support/library-instruction/library-instruction-guide/" target="_blank" rel="noopener">이용교육</a>
            <a href="https://library.donga.ac.kr/resource/databases/" target="_blank" rel="noopener">학술DB</a>
          </div>
          <div class="footer-column">
            <strong>이용문의</strong>
            <span>대출/반납 [한림] 051-200-6273</span>
            <span>대출/반납 [부민] 051-200-8434</span>
            <span>자료구입 051-200-6252</span>
            <span>상호대차/원문복사 051-200-6262</span>
            <span>홈페이지/시스템장애 051-200-8430</span>
          </div>
          <div class="footer-column">
            <strong>Family Sites</strong>
            <a href="https://www.donga.ac.kr/" target="_blank" rel="noopener">동아대학교</a>
            <a href="https://job.donga.ac.kr/" target="_blank" rel="noopener">취업지원실</a>
            <a href="https://eclass.donga.ac.kr/" target="_blank" rel="noopener">가상대학</a>
          </div>
        </div>
        <div class="footer-bottom">
          <div>
            <p>한림도서관 : 49315 부산광역시 사하구 낙동대로 550번길 37(하단동) Tel. 051-200-6273, 6252 / Fax. 051-200-6255</p>
            <p>부민도서관 : 49236 부산광역시 서구 구덕로 225(부민동 2가) Tel. 051-200-8434 / Fax. 051-200-8435</p>
            <p>법학도서분관 : 49236 부산광역시 서구 구덕로 225(부민동 2가) Tel. 051-200-8441 / Fax. 051-200-8443</p>
            <p>의학도서분관 : 49201 부산광역시 서구 대신공원로 32(동대신동 3가) Tel. 051-240-2938 / Fax. 051-240-2666</p>
            <p>Dong-A University Library. SEOK JAE WOO 051-200-6275</p>
          </div>
        </div>
      </footer>
    `);
  }

  function collectElements() {
    [
      "authArea", "toast", "loginForm", "totalBooks", "availableBooks", "cartBooks",
      "navCartCount", "floatCartCount", "searchInput", "sortSelect", "categoryList",
      "filterToggle", "resetFilters", "availableOnly", "hidePending", "resultCount", "refreshLive",
      "bookResults", "pagerTop", "pager", "cartDrawer", "cartItems", "clearCart", "applyCart",
      "bookModal", "detailCover", "detailCategory", "detailTitle", "detailAuthor",
      "detailMeta", "detailDescription", "detailApply", "detailCart", "detailPage",
      "detailCatalog", "applyModal", "applyForm", "applySummary", "myRequestCount",
      "myRequests", "refreshMine", "bulkActions", "selectAllRequests", "requestSelectionCount",
      "bulkCancelSelected", "pageDetailCover", "pageDetailCategory",
      "pageDetailTitle", "pageDetailAuthor", "pageDetailMeta", "pageDetailDescription",
      "pageDetailApply", "pageDetailCart", "pageRegistrationNo", "pageCallNo",
      "pageLocation", "pageCatalogLink"
    ].forEach((id) => {
      els[id] = $(id);
    });
  }

  function bindCommon() {
    document.querySelectorAll(".brand-row a").forEach((link) => {
      link.addEventListener("click", (event) => {
        if (state.user) {
          event.preventDefault();
          location.href = "catalog.html";
        }
      });
    });
    document.querySelectorAll("[data-cart-open]").forEach((button) => button.addEventListener("click", openCart));
    document.querySelectorAll("[data-cart-close]").forEach((button) => button.addEventListener("click", closeCart));
    document.querySelectorAll("[data-apply-close]").forEach((button) => button.addEventListener("click", closeApply));
    document.querySelectorAll("[data-modal-close]").forEach((button) => button.addEventListener("click", closePreview));
    if (els.clearCart) {
      els.clearCart.addEventListener("click", () => {
        state.cart = [];
        saveJson("careerBookCart", state.cart);
        updateCart();
      });
    }
    if (els.applyCart) {
      els.applyCart.addEventListener("click", () => openApply(state.cart.map(findBook).filter(Boolean), "cart"));
    }
    if (els.applyForm) els.applyForm.addEventListener("submit", submitApplication);
    [els.cartDrawer, els.bookModal, els.applyModal].filter(Boolean).forEach((layer) => {
      layer.addEventListener("click", (event) => {
        if (event.target === layer) closeLayer(layer);
      });
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-logout]")) {
        localStorage.removeItem("careerBookUser");
        state.user = null;
        renderAuth();
        toast("로그아웃되었습니다.");
        if (pageName !== "login") location.href = "index.html";
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAll();
    });
  }

  async function loadSiteSettings() {
    if (!config.appsScriptUrl) return;
    try {
      const payload = await getFromSheet({ action: "settings" });
      if (!payload.ok || !payload.settings) return;
      const settings = { ...state.siteSettings, ...payload.settings };
      const delay = Math.max(0, SETTINGS_TYPE_DELAY_MS - (Date.now() - settingsStartedAt));
      window.setTimeout(() => {
        state.siteSettings = settings;
        applySiteSettings({ typing: true });
      }, delay);
    } catch (error) {
      // Settings are optional; the static defaults keep the site usable.
    }
  }

  function applySiteSettings(options = {}) {
    const settings = state.siteSettings;
    document.querySelectorAll("[data-setting]").forEach((element) => {
      const value = settings[element.dataset.setting];
      if (!value || element.textContent === value) return;
      if (options.typing) typeSettingText(element, value);
      else element.textContent = value;
    });
    const siteTitle = settings.SITE_TITLE || siteDefaults.SITE_TITLE;
    if (pageName === "login") document.title = `로그인 | ${siteTitle}`;
    if (pageName === "catalog") document.title = `도서목록 | ${siteTitle}`;
    if (pageName === "status") document.title = `신청 진행상황 | ${siteTitle}`;
    if (pageName === "guide") document.title = `이용안내 | ${siteTitle}`;
    if (pageName === "detail" && !state.activeBook) document.title = `도서 상세 | ${siteTitle}`;
  }

  function typeSettingText(element, value) {
    const text = String(value || "");
    const previousTimer = Number(element.dataset.typingTimer || 0);
    if (previousTimer) window.clearInterval(previousTimer);
    element.textContent = "";
    element.classList.add("is-typing");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      element.textContent = text.slice(0, index);
      if (index >= text.length) {
        window.clearInterval(timer);
        element.classList.remove("is-typing");
        delete element.dataset.typingTimer;
      }
    }, Math.max(24, Math.min(52, Math.floor(900 / Math.max(text.length, 1)))));
    element.dataset.typingTimer = String(timer);
  }

  function bindLogin() {
    if (!els.loginForm) return;
    els.loginForm.addEventListener("submit", login);
  }

  function bindCatalog() {
    if (els.filterToggle) {
      els.filterToggle.addEventListener("click", () => {
        const filters = $("catalogFilters");
        if (!filters) return;
        const open = !filters.classList.contains("open");
        filters.classList.toggle("open", open);
        els.filterToggle.setAttribute("aria-expanded", String(open));
        els.filterToggle.innerHTML = `<i class="fa-solid fa-sliders"></i> ${open ? "필터 및 카테고리 닫기" : "필터 및 카테고리 열기"}`;
      });
    }
    els.searchInput.addEventListener("input", debounce(() => {
      state.page = 1;
      filterBooks();
    }, 120));
    els.sortSelect.addEventListener("change", () => {
      state.page = 1;
      filterBooks();
    });
    els.resetFilters.addEventListener("click", () => {
      state.category = "전체";
      els.availableOnly.checked = false;
      els.hidePending.checked = false;
      state.page = 1;
      renderCategories();
      filterBooks();
    });
    els.availableOnly.addEventListener("change", () => {
      state.page = 1;
      filterBooks();
    });
    els.hidePending.addEventListener("change", () => {
      state.page = 1;
      filterBooks();
    });
    els.refreshLive.addEventListener("click", () => refreshPending(true));
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = button.dataset.view;
        document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item === button));
        renderBooks();
      });
    });
    if (els.detailApply) els.detailApply.addEventListener("click", () => state.activeBook && openApply([state.activeBook], "preview"));
    if (els.detailCart) els.detailCart.addEventListener("click", () => state.activeBook && addCart(state.activeBook.bookId));
  }

  function bindDetailPage() {
    if (els.pageDetailApply) els.pageDetailApply.addEventListener("click", () => state.activeBook && openApply([state.activeBook], "detail"));
    if (els.pageDetailCart) els.pageDetailCart.addEventListener("click", () => state.activeBook && addCart(state.activeBook.bookId));
  }

  function bindStatus() {
    if (els.refreshMine) els.refreshMine.addEventListener("click", () => loadMyRequests(true));
    if (els.selectAllRequests) {
      els.selectAllRequests.addEventListener("change", () => {
        state.selectedRequestIds = new Set(
          els.selectAllRequests.checked
            ? state.myRequests.filter((entry) => canCancelRequest(entry)).map((entry) => entry.requestId)
            : []
        );
        renderMyRequests(state.myRequests);
      });
    }
    if (els.bulkCancelSelected) els.bulkCancelSelected.addEventListener("click", bulkCancelRequests);
  }

  async function login(event) {
    event.preventDefault();
    const form = new FormData(els.loginForm);
    const user = {
      studentId: onlyText(form.get("studentId")),
      studentName: onlyText(form.get("studentName")),
      phone: onlyText(form.get("phone")),
    };
    if (!user.studentId || !user.studentName || !user.phone) {
      toast("학번/직번, 성명, 휴대폰번호를 모두 입력해주세요.");
      return;
    }
    const button = els.loginForm.querySelector("button[type='submit']");
    button.disabled = true;
    button.dataset.loading = "true";
    setButtonLoading(button, "로그인 중입니다.");
    showLoading("로그인 정보를 확인하는 중입니다.");
    try {
      if (config.appsScriptUrl) {
        const result = await postToSheet({ action: "login", ...user, privacyConsent: true });
        if (!result.ok) throw new Error(appErrorMessage(result.message || "로그인하지 못했습니다."));
        Object.assign(user, normalizeUser(result.user || user));
      }
      state.user = user;
      saveJson("careerBookUser", user);
      location.href = "catalog.html";
    } catch (error) {
      toast(appErrorMessage(error.message || "로그인 중 오류가 발생했습니다."));
    } finally {
      hideLoading();
      delete button.dataset.loading;
      setButtonLoading(button, "로그인하고 도서 보러가기");
      button.disabled = false;
    }
  }

  async function loadBooks() {
    if (state.books.length) return;
    const response = await fetch(config.dataUrl || "assets/data/career-books.json", { cache: "no-store" });
    if (!response.ok) throw new Error("도서 목록을 불러오지 못했습니다.");
    const payload = await response.json();
    state.books = (payload.books || []).map((book) => ({
      ...book,
      searchText: normalize(`${book.title} ${book.author} ${book.registrationNo} ${book.callNo} ${book.category}`),
    }));
    updateSummaryCounts();
  }

  async function refreshPending(manual, options = {}) {
    const forceRefresh = Boolean(manual || options.force);
    const silent = Boolean(options.silent);
    if (!config.appsScriptUrl) {
      if (manual && !silent) toast("신청 상태를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    try {
      const payload = await getFromSheet({ action: "pending", refresh: forceRefresh ? "1" : "" });
      const entries = payload.entries || [];
      state.pendingIds = new Set(entries.map((entry) => entry.bookId).filter(Boolean));
      updateSummaryCounts();
      if (pageName === "catalog") filterBooks();
      if (pageName === "detail") updateActiveBookActions();
      updateCart();
      if (manual && !silent) toast("신청 상태를 새로 확인했습니다.");
    } catch (error) {
      if (manual && !silent) toast("신청 상태를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
  }

  function renderCategories() {
    const counts = new Map();
    state.books.forEach((book) => counts.set(book.category, (counts.get(book.category) || 0) + 1));
    const rows = [["전체", state.books.length], ...Array.from(counts.entries()).sort((a, b) => b[1] - a[1])];
    els.categoryList.innerHTML = rows.map(([label, count]) => (
      `<button type="button" class="category-button${state.category === label ? " active" : ""}" data-category="${attr(label)}">
        <span>${html(label)}</span><span>${fmt(count)}</span>
      </button>`
    )).join("");
    els.categoryList.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        state.category = button.dataset.category;
        state.page = 1;
        renderCategories();
        filterBooks();
      });
    });
  }

  function filterBooks() {
    const query = normalize(els.searchInput.value);
    const sort = els.sortSelect.value;
    state.filtered = state.books.filter((book) => {
      if (state.category !== "전체" && book.category !== state.category) return false;
      if (query && !book.searchText.includes(query)) return false;
      if (els.availableOnly.checked && !canApplyBook(book)) return false;
      if (els.hidePending.checked && state.pendingIds.has(book.bookId)) return false;
      return true;
    });
    state.filtered.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title, "ko");
      if (sort === "year") return Number(b.publicationYear || 0) - Number(a.publicationYear || 0);
      if (sort === "price") return Number(b.price || 0) - Number(a.price || 0);
      return Number(a.sourceNo || 0) - Number(b.sourceNo || 0);
    });
    els.resultCount.textContent = fmt(state.filtered.length);
    updateSummaryCounts();
    renderBooks();
  }

  function renderBooks() {
    const pages = Math.max(1, Math.ceil(state.filtered.length / state.perPage));
    state.page = Math.min(state.page, pages);
    const pageItems = state.filtered.slice((state.page - 1) * state.perPage, state.page * state.perPage);
    els.bookResults.className = `book-results ${state.view}-view`;
    els.bookResults.innerHTML = pageItems.map(renderBookCard).join("") || `<p class="empty">조건에 맞는 도서가 없습니다.</p>`;
    els.bookResults.querySelectorAll("[data-preview]").forEach((button) => button.addEventListener("click", () => openPreview(findBook(button.dataset.preview))));
    els.bookResults.querySelectorAll("[data-cart-book]").forEach((button) => button.addEventListener("click", () => addCart(button.dataset.cartBook)));
    els.bookResults.querySelectorAll("[data-apply-book]").forEach((button) => button.addEventListener("click", () => openApply([findBook(button.dataset.applyBook)], "single")));
    renderPager(pages);
    hydrateVisibleCovers(pageItems);
  }

  function renderBookCard(book, index) {
    const pending = state.pendingIds.has(book.bookId);
    const canApply = canApplyBook(book);
    const status = pending ? "신청 진행중" : book.status || "신청가능";
    return `<article class="book-card">
      ${cover(book, index < COVER_PRIORITY_BATCH_SIZE)}
      <div>
        <span class="status${canApply ? "" : " closed"}">${html(status)}</span>
        <h3 class="book-title">${html(book.title)}</h3>
        <p class="book-sub">${html(book.author || "저자 정보 없음")} · ${html(book.publicationYear || "연도 미상")}</p>
        <div class="book-meta">
          <span>${html(book.category)}</span>
          <span>${html(book.registrationNo)}</span>
          <span>${html(book.callNo || "청구기호 없음")}</span>
          ${book.price ? `<span class="price">${fmt(book.price)}원</span>` : ""}
        </div>
      </div>
      <div class="book-actions">
        <button class="apply" type="button" data-apply-book="${attr(book.bookId)}" ${canApply ? "" : "disabled"}>바로 신청</button>
        <button class="cart" type="button" data-cart-book="${attr(book.bookId)}" ${canApply ? "" : "disabled"}>장바구니</button>
        <button class="preview" type="button" data-preview="${attr(book.bookId)}">미리보기</button>
        <a class="detail-link" href="detail.html?id=${encodeURIComponent(book.bookId)}">상세보기</a>
      </div>
    </article>`;
  }

  function renderPager(pageCount) {
    const html = pageCount <= 1 ? "" : pagerHtml(pageCount);
    [els.pagerTop, els.pager].filter(Boolean).forEach((pager) => {
      pager.innerHTML = html;
      pager.querySelectorAll("button[data-page]").forEach((button) => button.addEventListener("click", () => {
        state.page = Number(button.dataset.page);
        renderBooks();
        document.querySelector(".results").scrollIntoView({ behavior: "smooth", block: "start" });
      }));
    });
  }

  function pagerHtml(pageCount) {
    if (isCompactPager()) return compactPagerHtml(pageCount);
    const pages = new Set([1, pageCount]);
    for (let value = state.page - 2; value <= state.page + 2; value += 1) pages.add(value);
    const ordered = Array.from(pages).filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
    const pageButtons = ordered.map((value, index) => {
      const gap = index > 0 && value - ordered[index - 1] > 1 ? `<span class="pager-gap">...</span>` : "";
      return `${gap}<button type="button" class="${value === state.page ? "active" : ""}" data-page="${value}" aria-label="${value}페이지">${value}</button>`;
    }).join("");
    return `
      <button type="button" data-page="1" ${state.page === 1 ? "disabled" : ""}>처음</button>
      <button type="button" data-page="${Math.max(1, state.page - 1)}" ${state.page === 1 ? "disabled" : ""}>이전</button>
      ${pageButtons}
      <button type="button" data-page="${Math.min(pageCount, state.page + 1)}" ${state.page === pageCount ? "disabled" : ""}>다음</button>
      <button type="button" data-page="${pageCount}" ${state.page === pageCount ? "disabled" : ""}>끝</button>
    `;
  }

  function compactPagerHtml(pageCount) {
    return `
      <button type="button" data-page="1" ${state.page === 1 ? "disabled" : ""}>처음</button>
      <button type="button" data-page="${Math.max(1, state.page - 1)}" ${state.page === 1 ? "disabled" : ""}>이전</button>
      <span class="pager-current" aria-label="현재 페이지">${fmt(state.page)} / ${fmt(pageCount)}</span>
      <button type="button" data-page="${Math.min(pageCount, state.page + 1)}" ${state.page === pageCount ? "disabled" : ""}>다음</button>
      <button type="button" data-page="${pageCount}" ${state.page === pageCount ? "disabled" : ""}>끝</button>
    `;
  }

  function isCompactPager() {
    return window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
  }

  async function openPreview(book) {
    if (!book) return;
    state.activeBook = book;
    els.detailCategory.textContent = book.category;
    els.detailTitle.textContent = book.title;
    els.detailAuthor.textContent = book.author || "저자 정보 없음";
    els.detailMeta.textContent = `${book.registrationNo} · ${book.callNo || "청구기호 없음"} · ${book.publicationYear || "연도 미상"}`;
    els.detailCatalog.href = book.detailUrl || "#";
    if (els.detailPage) els.detailPage.href = `detail.html?id=${encodeURIComponent(book.bookId)}`;
    els.detailCover.innerHTML = cover(book, true);
    updateActiveBookActions();
    els.detailDescription.textContent = "도서 소개를 불러오는 중입니다.";
    openLayer(els.bookModal);
    const meta = await metaFromAladin(book);
    if (state.activeBook !== book) return;
    if (meta && meta.cover) els.detailCover.innerHTML = `<img src="${attr(meta.cover)}" ${coverImageAttrs(book.title, true)} />`;
    els.detailDescription.textContent = meta && meta.description ? meta.description : "도서 소개 정보가 준비되지 않았습니다.";
  }

  async function renderDetailPage() {
    const id = new URLSearchParams(location.search).get("id");
    const book = findBook(id);
    if (!book) {
      els.pageDetailTitle.textContent = "도서를 찾을 수 없습니다.";
      els.pageDetailDescription.textContent = "도서목록으로 돌아가 다시 선택해주세요.";
      return;
    }
    state.activeBook = book;
    document.title = `${book.title} | ${state.siteSettings.SITE_TITLE || siteDefaults.SITE_TITLE}`;
    els.pageDetailCategory.textContent = book.category;
    els.pageDetailTitle.textContent = book.title;
    els.pageDetailAuthor.textContent = book.author || "저자 정보 없음";
    els.pageDetailMeta.textContent = `${book.publicationYear || "연도 미상"} · ${book.price ? `${fmt(book.price)}원` : "가격 정보 없음"}`;
    els.pageRegistrationNo.textContent = book.registrationNo;
    els.pageCallNo.textContent = book.callNo || "청구기호 없음";
    els.pageLocation.textContent = book.location || "동아대학교 도서관";
    els.pageCatalogLink.href = book.detailUrl || "#";
    els.pageDetailCover.innerHTML = cover(book, true);
    updateActiveBookActions();
    els.pageDetailDescription.textContent = "책 소개를 불러오는 중입니다.";
    const meta = await metaFromAladin(book);
    if (meta && meta.cover) els.pageDetailCover.innerHTML = `<img src="${attr(meta.cover)}" ${coverImageAttrs(book.title, true)} />`;
    els.pageDetailDescription.textContent = meta && meta.description ? meta.description : "책 소개 정보가 준비되지 않았습니다.";
  }

  async function metaFromAladin(book) {
    if (!config.appsScriptUrl) return null;
    if (state.coverCache[book.bookId]) return state.coverCache[book.bookId];
    try {
      const payload = await getFromSheet({
        action: "bookMeta",
        bookId: book.bookId,
        title: book.title,
        author: book.author || "",
        isbn13: book.isbn13 || "",
      });
      const item = payload.ok ? payload.item : null;
      if (item && (item.cover || item.description)) {
        state.coverCache[book.bookId] = item;
        saveJson("careerBookCoverCache", state.coverCache);
      }
      return item;
    } catch (error) {
      return null;
    }
  }

  function addCart(bookId) {
    const book = findBook(bookId);
    if (!book || state.pendingIds.has(bookId) || !available(book)) return toast("이미 신청 진행중이거나 마감된 도서입니다.");
    if (!state.cart.includes(bookId)) {
      state.cart.push(bookId);
      saveJson("careerBookCart", state.cart);
      updateCart();
      toast("장바구니에 담았습니다.");
    } else {
      toast("이미 장바구니에 있는 도서입니다.");
    }
  }

  function updateCart() {
    const books = state.cart.map(findBook).filter(Boolean);
    const count = state.books.length ? books.length : state.cart.length;
    if (els.cartBooks) els.cartBooks.textContent = fmt(count);
    document.querySelectorAll("#navCartCount").forEach((item) => { item.textContent = fmt(count); });
    if (els.floatCartCount) els.floatCartCount.textContent = fmt(count);
    if (!els.cartItems) return;
    if (!state.books.length && state.cart.length) {
      els.cartItems.innerHTML = loadingBlock("장바구니 정보를 불러오는 중입니다.");
      els.applyCart.disabled = true;
      return;
    }
    els.cartItems.innerHTML = books.length ? books.map((book) => (
      `<div class="cart-item">
        <div><strong>${html(book.title)}</strong><span>${html(book.registrationNo)} · ${html(book.author || "")}</span></div>
        <button type="button" data-remove="${attr(book.bookId)}" aria-label="삭제"><i class="fa-solid fa-trash"></i></button>
      </div>`
    )).join("") : `<p class="empty">장바구니가 비어 있습니다.</p>`;
    els.cartItems.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => {
      state.cart = state.cart.filter((cartId) => cartId !== button.dataset.remove);
      saveJson("careerBookCart", state.cart);
      updateCart();
    }));
    els.applyCart.disabled = books.length === 0;
  }

  function openApply(books, source) {
    if (!state.user) {
      toast("로그인 후 신청할 수 있습니다.");
      setTimeout(() => location.href = "index.html", 700);
      return;
    }
    const selected = (books || []).filter(Boolean).filter((book) => available(book) && !state.pendingIds.has(book.bookId));
    if (!selected.length) return toast("신청 가능한 도서를 먼저 선택해주세요.");
    state.selectedBooks = selected;
    els.applyForm.dataset.source = source;
    updateApplySummary();
    openLayer(els.applyModal);
  }

  async function submitApplication(event) {
    event.preventDefault();
    if (!state.user) return toast("로그인 후 신청할 수 있습니다.");
    if (!config.appsScriptUrl) return toast("신청을 접수하지 못했습니다. 잠시 후 다시 시도해주세요.");
    const form = new FormData(els.applyForm);
    const payload = {
      action: "submitApplication",
      source: els.applyForm.dataset.source || "site",
      studentName: state.user.studentName,
      studentId: state.user.studentId,
      phone: state.user.phone,
      memo: form.get("memo"),
      books: state.selectedBooks.map((book) => ({
        bookId: book.bookId,
        registrationNo: book.registrationNo,
        title: book.title,
        author: book.author,
        isbn13: book.isbn13 || "",
      })),
    };
    const button = els.applyForm.querySelector('button[type="submit"]');
    button.disabled = true;
    button.dataset.loading = "true";
    setButtonLoading(button, "신청 접수 중입니다.");
    showLoading("신청을 접수하는 중입니다.");
    try {
      const result = await postToSheet(payload);
      if (!result.ok) throw new Error(appErrorMessage(result.message || "신청 접수 실패"));
      state.cart = state.cart.filter((id) => !state.selectedBooks.some((book) => book.bookId === id));
      saveJson("careerBookCart", state.cart);
      updateCart();
      closeAll();
      els.applyForm.reset();
      toast("신청이 접수되었습니다.");
      await refreshPending(false);
    } catch (error) {
      const message = appErrorMessage(error.message || "신청 접수 중 오류가 발생했습니다.");
      toast(message);
      if (isAvailabilityConflictMessage(message)) {
        await syncAvailabilityAfterConflict();
      }
    } finally {
      hideLoading();
      delete button.dataset.loading;
      setButtonLoading(button, "신청 제출");
      button.disabled = false;
    }
  }

  async function loadMyRequests(manual) {
    if (!els.myRequests) return;
    if (!state.user) {
      state.myRequests = [];
      state.selectedRequestIds = new Set();
      els.myRequestCount.textContent = "0";
      els.myRequests.innerHTML = `<div class="empty-state"><strong>로그인이 필요합니다.</strong><p>학생/교직원 로그인 후 신청 진행상황을 확인할 수 있습니다.</p><a class="primary" href="index.html">로그인하기</a></div>`;
      updateBulkActions();
      return;
    }
    if (!config.appsScriptUrl) {
      state.myRequests = [];
      state.selectedRequestIds = new Set();
      els.myRequests.innerHTML = `<p class="empty">신청 내역을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>`;
      updateBulkActions();
      return;
    }
    els.myRequests.innerHTML = loadingBlock("신청 내역을 불러오는 중입니다.");
    if (els.myRequestCount) els.myRequestCount.textContent = "-";
    if (manual) showLoading("신청 내역을 새로 확인하는 중입니다.");
    try {
      const payload = await getFromSheet({
        action: "myRequests",
        studentId: state.user.studentId,
        studentName: state.user.studentName || "",
        phone: state.user.phone
      });
      const entries = payload.entries || [];
      state.myRequests = entries;
      state.selectedRequestIds = new Set(Array.from(state.selectedRequestIds).filter((id) => entries.some((entry) => entry.requestId === id && canCancelRequest(entry))));
      els.myRequestCount.textContent = fmt(entries.length);
      renderMyRequests(entries);
      if (manual) toast("신청내역을 새로 확인했습니다.");
    } catch (error) {
      state.myRequests = [];
      state.selectedRequestIds = new Set();
      els.myRequestCount.textContent = "0";
      els.myRequests.innerHTML = `<p class="empty">신청 내역을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>`;
      updateBulkActions();
    } finally {
      if (manual) hideLoading();
    }
  }

  function renderMyRequests(entries) {
    els.myRequests.innerHTML = entries.length ? entries.map((entry) => {
      const cancellable = canCancelRequest(entry);
      const checked = state.selectedRequestIds.has(entry.requestId);
      return `<article class="request-card${cancellable ? " has-select" : ""}">
        ${cancellable ? `<input class="request-check" type="checkbox" data-request-check="${attr(entry.requestId)}" aria-label="${attr(entry.title || entry.bookId)} 선택" ${checked ? "checked" : ""} />` : ""}
        <div>
          <span class="status ${statusClass(entry.status)}">${html(entry.status)}</span>
          <h3>${html(entry.title || entry.bookId)}</h3>
          <p>${html(entry.registrationNo || "")} · ${html(entry.author || "저자 정보 없음")}</p>
          <small>${html(entry.requestedAt || "")}</small>
        </div>
        <button type="button" class="ghost danger request-cancel" data-cancel-request="${attr(entry.requestId)}" ${cancellable ? "" : "disabled"}>신청 취소</button>
      </article>`;
    }).join("") : `<div class="empty-state"><strong>아직 신청한 도서가 없습니다.</strong><p>도서목록에서 원하는 책을 신청해보세요.</p><a class="primary" href="catalog.html">도서목록 보기</a></div>`;
    els.myRequests.querySelectorAll("[data-request-check]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) state.selectedRequestIds.add(checkbox.dataset.requestCheck);
        else state.selectedRequestIds.delete(checkbox.dataset.requestCheck);
        updateBulkActions();
      });
    });
    els.myRequests.querySelectorAll("[data-cancel-request]").forEach((button) => {
      button.addEventListener("click", () => cancelRequest(button.dataset.cancelRequest));
    });
    updateBulkActions();
  }

  function canCancelRequest(entry) {
    return entry && (entry.status === "신청접수" || entry.status === "처리중");
  }

  async function cancelRequest(requestId) {
    if (!requestId || !state.user) return;
    if (!window.confirm("이 도서 신청을 취소할까요?")) return;
    try {
      showLoading("신청 취소를 처리하는 중입니다.");
      const result = await postToSheet({
        action: "cancelApplication",
        requestId,
        studentId: state.user.studentId,
        studentName: state.user.studentName || "",
        phone: state.user.phone,
      });
      if (!result.ok) throw new Error(appErrorMessage(result.message || "신청을 취소하지 못했습니다."));
      toast("신청이 취소되었습니다.");
      await loadMyRequests(false);
    } catch (error) {
      toast(appErrorMessage(error.message || "신청을 취소하지 못했습니다."));
    } finally {
      hideLoading();
    }
  }

  async function bulkCancelRequests() {
    if (!state.user) return toast("로그인 후 신청을 취소할 수 있습니다.");
    const selected = state.myRequests.filter((entry) => state.selectedRequestIds.has(entry.requestId) && canCancelRequest(entry));
    if (!selected.length) return toast("취소할 신청내역을 선택해주세요.");
    if (!window.confirm(`선택한 ${selected.length}건의 신청을 취소할까요?`)) return;

    if (els.bulkCancelSelected) {
      els.bulkCancelSelected.disabled = true;
      els.bulkCancelSelected.dataset.loading = "true";
      setButtonLoading(els.bulkCancelSelected, "취소 처리 중입니다.");
    }
    showLoading("선택한 신청을 취소하는 중입니다.");
    let successCount = 0;
    try {
      for (let index = 0; index < selected.length; index += 1) {
        const result = await postToSheet({
          action: "cancelApplication",
          requestId: selected[index].requestId,
          studentId: state.user.studentId,
          studentName: state.user.studentName || "",
          phone: state.user.phone,
        });
        if (!result.ok) throw new Error(appErrorMessage(result.message || "선택 신청을 취소하지 못했습니다."));
        successCount += 1;
      }
      state.selectedRequestIds = new Set();
      toast(`${successCount}건의 신청이 취소되었습니다.`);
      await loadMyRequests(false);
    } catch (error) {
      toast(appErrorMessage(error.message || "선택 신청을 취소하지 못했습니다."));
      await loadMyRequests(false);
    } finally {
      hideLoading();
      if (els.bulkCancelSelected) {
        delete els.bulkCancelSelected.dataset.loading;
        setButtonLoading(els.bulkCancelSelected, "선택 신청 취소");
      }
      updateBulkActions();
    }
  }

  function updateBulkActions() {
    if (!els.bulkActions) return;
    const cancellableIds = state.myRequests.filter(canCancelRequest).map((entry) => entry.requestId);
    const selectedCount = cancellableIds.filter((id) => state.selectedRequestIds.has(id)).length;
    els.bulkActions.hidden = cancellableIds.length === 0;
    if (els.requestSelectionCount) els.requestSelectionCount.textContent = `${selectedCount}건 선택`;
    if (els.bulkCancelSelected) els.bulkCancelSelected.disabled = selectedCount === 0;
    if (els.selectAllRequests) {
      els.selectAllRequests.checked = cancellableIds.length > 0 && selectedCount === cancellableIds.length;
      els.selectAllRequests.indeterminate = selectedCount > 0 && selectedCount < cancellableIds.length;
    }
  }

  function renderAuth() {
    document.body.classList.toggle("logged-in", Boolean(state.user));
    if (!els.authArea) return;
    if (!state.user) {
      els.authArea.innerHTML = `<a class="login-link" href="index.html"><i class="fa-solid fa-right-to-bracket"></i> 로그인</a>`;
      return;
    }
    els.authArea.innerHTML = `<span class="user-chip">(${html(state.user.studentId)}) ${html(state.user.studentName)} 님</span><button type="button" class="logout-button" data-logout>로그아웃</button>`;
  }

  async function getFromSheet(params) {
    const url = new URL(config.appsScriptUrl);
    Object.keys(params).forEach((key) => url.searchParams.set(key, params[key]));
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) throw new Error("서버 응답을 받지 못했습니다.");
    return response.json();
  }

  async function postToSheet(payload) {
    const response = await fetch(config.appsScriptUrl, { method: "POST", body: JSON.stringify(payload) });
    if (!response.ok) throw new Error("서버 응답을 받지 못했습니다.");
    return response.json();
  }

  function appErrorMessage(message) {
    const text = String(message || "").trim();
    if (/Illegal spreadsheet id or key/i.test(text)) {
      return "구글시트 연결 설정이 올바르지 않습니다. 담당자에게 SPREADSHEET_ID 확인을 요청해주세요.";
    }
    return text || "처리 중 오류가 발생했습니다.";
  }

  function updateApplySummary() {
    const selected = state.selectedBooks || [];
    if (!els.applySummary || !selected.length) return;
    els.applySummary.textContent = selected.length === 1 ? `"${selected[0].title}" 1권을 신청합니다.` : `${selected.length}권을 한 번에 신청합니다.`;
  }

  async function syncAvailabilityAfterConflict() {
    await refreshPending(false, { force: true, silent: true });
    const selected = state.selectedBooks.filter(canApplyBook);
    if (selected.length !== state.selectedBooks.length) {
      state.selectedBooks = selected;
      if (!selected.length) closeApply();
      else updateApplySummary();
    }
    updateActiveBookActions();
  }

  function isAvailabilityConflictMessage(message) {
    return /이미 신청 진행중|이미 마감|마감된 도서|신청 가능한 도서/.test(String(message || ""));
  }

  function updateActiveBookActions() {
    if (!state.activeBook) return;
    updateDetailActionButtons(state.activeBook, els.detailApply, els.detailCart);
    updateDetailActionButtons(state.activeBook, els.pageDetailApply, els.pageDetailCart);
  }

  function updateDetailActionButtons(book, applyButton, cartButton) {
    const canApply = canApplyBook(book);
    const pending = state.pendingIds.has(book.bookId);
    const applyLabel = pending ? "신청 진행중" : available(book) ? "바로 신청" : "신청 마감";
    const cartLabel = pending ? "신청 진행중" : available(book) ? "장바구니 담기" : "신청 마감";
    if (applyButton) {
      applyButton.disabled = !canApply;
      applyButton.textContent = applyLabel;
    }
    if (cartButton) {
      cartButton.disabled = !canApply;
      cartButton.textContent = cartLabel;
    }
  }

  function cover(book, priority) {
    const meta = state.coverCache[book.bookId] || {};
    if (book.cover || meta.cover) {
      return `<div class="cover image-cover" data-cover-book="${attr(book.bookId)}"><img src="${attr(book.cover || meta.cover)}" ${coverImageAttrs(book.title, priority)} /></div>`;
    }
    return `<div class="cover" data-cover-book="${attr(book.bookId)}"><strong>${html(book.title)}</strong><span>${html(book.category)}</span></div>`;
  }

  function coverImageAttrs(title, priority) {
    return `alt="${attr(title || "도서")} 표지" loading="${priority ? "eager" : "lazy"}" decoding="async"${priority ? ' fetchpriority="high"' : ""}`;
  }

  function updateSummaryCounts() {
    if (els.totalBooks) els.totalBooks.textContent = fmt(state.books.length);
    if (els.availableBooks) els.availableBooks.textContent = fmt(state.books.filter(canApplyBook).length);
  }

  async function hydrateVisibleCovers(books) {
    if (!config.appsScriptUrl) return;
    const missing = books
      .filter((book) => book && !book.cover && !(state.coverCache[book.bookId] && state.coverCache[book.bookId].cover))
      .map((book) => ({
        bookId: book.bookId,
        title: book.title,
        author: book.author || "",
        isbn13: book.isbn13 || "",
      }));
    if (!missing.length) return;

    const hydrationId = ++state.coverHydrationId;
    const priority = missing.slice(0, COVER_PRIORITY_BATCH_SIZE);
    const background = missing.slice(COVER_PRIORITY_BATCH_SIZE);
    await hydrateCoverBatch(priority, hydrationId, true);
    for (let index = 0; index < background.length; index += COVER_BACKGROUND_BATCH_SIZE) {
      if (state.coverHydrationId !== hydrationId) return;
      await waitForCoverIdle();
      await hydrateCoverBatch(background.slice(index, index + COVER_BACKGROUND_BATCH_SIZE), hydrationId, false);
    }
  }

  async function hydrateCoverBatch(items, hydrationId, priority) {
    if (!items.length || state.coverHydrationId !== hydrationId) return;
    try {
      const payload = await postToSheet({ action: "bookMetaBatch", items });
      if (payload.ok && payload.items) {
        Object.keys(payload.items).forEach((bookId) => {
          const meta = payload.items[bookId];
          if (!meta || (!meta.cover && !meta.description)) return;
          state.coverCache[bookId] = meta;
          updateCoverElement(bookId, meta, priority);
        });
        saveJson("careerBookCoverCache", state.coverCache);
        return;
      }
    } catch (error) {
      // Older Apps Script deployments do not know bookMetaBatch yet.
    }

    const fallback = items.slice(0, COVER_BACKGROUND_BATCH_SIZE);
    for (let index = 0; index < fallback.length; index += 1) {
      if (state.coverHydrationId !== hydrationId) return;
      const book = findBook(fallback[index].bookId);
      if (!book) continue;
      const meta = await metaFromAladin(book);
      if (meta && meta.cover) updateCoverElement(book.bookId, meta, priority);
    }
  }

  function waitForCoverIdle() {
    return new Promise((resolve) => {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(resolve, { timeout: COVER_BACKGROUND_DELAY_MS * 4 });
        return;
      }
      window.setTimeout(resolve, COVER_BACKGROUND_DELAY_MS);
    });
  }

  function updateCoverElement(bookId, meta, priority) {
    if (!meta || !meta.cover) return;
    document.querySelectorAll(`[data-cover-book="${cssEscape(bookId)}"]`).forEach((element) => {
      element.classList.add("image-cover");
      element.innerHTML = `<img src="${attr(meta.cover)}" ${coverImageAttrs(element.textContent || "도서", priority || isNearViewport(element))} />`;
    });
  }

  function isNearViewport(element) {
    const rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight * 1.25 && rect.bottom > -window.innerHeight * 0.25;
  }

  function hasCart() {
    return Boolean(document.querySelector("[data-cart-open]"));
  }

  function findBook(bookId) {
    return state.books.find((book) => book.bookId === bookId);
  }

  function available(book) {
    return (book.status || "신청가능") !== "마감" && Number(book.availableQuantity || 1) > 0;
  }

  function canApplyBook(book) {
    return available(book) && !state.pendingIds.has(book.bookId);
  }

  async function openCart() {
    if (!state.books.length) {
      showLoading("장바구니 정보를 불러오는 중입니다.");
      try {
        await loadBooks();
      } catch (error) {
        toast("장바구니 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      } finally {
        hideLoading();
      }
    }
    updateCart();
    openLayer(els.cartDrawer);
  }

  function closeCart() {
    closeLayer(els.cartDrawer);
  }

  function closePreview() {
    closeLayer(els.bookModal);
    if (pageName !== "detail") state.activeBook = null;
  }

  function closeApply() {
    closeLayer(els.applyModal);
  }

  function closeAll() {
    [els.cartDrawer, els.bookModal, els.applyModal].filter(Boolean).forEach(closeLayer);
    if (pageName !== "detail") state.activeBook = null;
  }

  function openLayer(layer) {
    if (!layer) return;
    layer.classList.add("open");
    layer.setAttribute("aria-hidden", "false");
  }

  function closeLayer(layer) {
    if (!layer) return;
    layer.classList.remove("open");
    layer.setAttribute("aria-hidden", "true");
  }

  function statusClass(status) {
    return status === "취소" ? "closed" : status === "확정" ? "confirmed" : "";
  }

  function loadJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeUser(user) {
    return {
      studentId: onlyText(user.studentId),
      studentName: onlyText(user.studentName),
      phone: onlyText(user.phone),
    };
  }

  async function withLoading(message, task) {
    showLoading(message);
    try {
      return await task();
    } finally {
      hideLoading();
    }
  }

  function showLoading(message) {
    const overlay = ensureLoadingOverlay();
    const text = overlay.querySelector("[data-loading-text]");
    if (text) text.textContent = message || "불러오는 중입니다.";
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
  }

  function hideLoading() {
    const overlay = $("globalLoading");
    if (!overlay) return;
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
  }

  function ensureLoadingOverlay() {
    if (!$("globalLoading")) {
      document.body.insertAdjacentHTML("beforeend", `
        <div class="loading-overlay" id="globalLoading" aria-hidden="true">
          <div class="loading-panel" role="status" aria-live="polite">
            <span class="spinner" aria-hidden="true"></span>
            <strong data-loading-text>불러오는 중입니다.</strong>
          </div>
        </div>
      `);
    }
    return $("globalLoading");
  }

  function loadingBlock(message) {
    return `<div class="loading-block"><span class="spinner" aria-hidden="true"></span><strong>${html(message || "불러오는 중입니다.")}</strong></div>`;
  }

  function setButtonLoading(button, label) {
    if (!button) return;
    const loading = button.dataset.loading === "true";
    button.innerHTML = loading ? `<span class="spinner small" aria-hidden="true"></span>${html(label)}` : html(label);
  }

  function toast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => els.toast.classList.remove("show"), 2600);
  }

  function onlyText(value) {
    return String(value || "").trim();
  }

  function normalize(value) {
    return onlyText(value).toLowerCase().replace(/\s+/g, " ");
  }

  function fmt(value) {
    return new Intl.NumberFormat("ko-KR").format(Number(value || 0));
  }

  function debounce(fn, wait) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  function html(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function attr(value) {
    return html(value).replace(/`/g, "&#96;");
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value || "").replace(/"/g, '\\"');
  }
})();
