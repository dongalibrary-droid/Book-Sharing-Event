const CONFIG = {
  BOOK_SHEET_NAME: "도서목록",
  REQUEST_SHEET_NAME: "신청현황",
  USER_SHEET_NAME: "이용자",
  SETTINGS_SHEET_NAME: "설정",
  OPERATION_SHEET_NAME: "운영",
  ALADIN_API_BASE: "https://www.aladin.co.kr/ttb/api/",
  ALADIN_VERSION: "20131101",
  META_CACHE_SECONDS: 21600,
  PENDING_CACHE_SECONDS: 60,
  MAX_BOOKS_PER_REQUEST: 20,
  MAX_META_BATCH_SIZE: 25,
  META_CONCURRENCY: 6,
  META_SHEET_NAME: "도서메타",
  META_SYNC_BATCH_SIZE: 12,
  META_DAILY_REQUEST_BUDGET: 4000,
  META_SYNC_BUDGET_MS: 180000,
  META_RETRY_MS: 86400000,
  TIME_ZONE: "Asia/Seoul",
  DATETIME_FORMAT: "yyyy-MM-dd HH:mm:ss",
};

const BOOK_HEADERS = ["도서ID", "등록번호", "서명", "저자", "청구기호", "소장위치", "가격", "출판년도", "도서상세URL", "ISBN13", "카테고리", "상태", "신청가능수량", "신청중수량", "확정수량", "비고", "원본번호"];
const REQUEST_HEADERS = ["신청ID", "신청일시", "상태", "학생명", "학번", "학과", "연락처", "이메일", "신청경로", "도서ID", "등록번호", "서명", "저자", "ISBN13", "메모", "처리자", "처리일시", "수령캠퍼스"];
const PICKUP_CAMPUSES = ["한림도서관(승학)", "부민도서관(부민)"];
const OPERATION_HEADERS = ["설정항목", "값", "설명"];
const DEFAULT_OPERATION = [
  ["운영시작일시", "", "한국 시간. 예: 2026-09-29 09:00:00. 빈칸이면 시작 제한 없음"],
  ["운영종료일시", "", "예: 2026-10-31 18:00:00. 날짜만 입력하면 해당 날짜 끝까지. 빈칸이면 종료 제한 없음"],
  ["팝업이미지URL", "", "로그인 없이 열리는 HTTPS 이미지 주소. 빈칸이면 팝업 미노출"],
  ["팝업시작일시", "", "한국 시간. 날짜 또는 yyyy-MM-dd HH:mm:ss. 빈칸이면 시작 제한 없음"],
  ["팝업종료일시", "", "날짜만 입력하면 해당 날짜 끝까지. 빈칸이면 종료 제한 없음"],
  ["팝업대체텍스트", "도서 나눔 안내", "이미지의 안내 내용을 글로 입력해주세요. 화면 읽기 프로그램과 이미지 로딩 실패 시 사용"],
];
const USER_HEADERS = ["학번", "성명", "휴대폰번호", "개인정보동의", "최초로그인", "최근로그인", "로그인횟수"];
const META_HEADERS = ["도서ID", "검색기준", "표지URL", "소개", "알라딘서명", "알라딘저자", "출판사", "출판일", "ISBN13", "알라딘URL", "수집상태", "갱신일시", "재시도시각"];
const DEFAULT_SETTINGS = [
  ["SITE_TITLE", "동아대학교 도서관 도서 나눔", "사이트와 로그인 화면에 표시되는 기본 행사명"],
  ["SITE_EYEBROW", "Library Book Sharing", "로그인 화면 상단 보조 문구"],
  ["SITE_DESCRIPTION", "학번/직번, 성명, 휴대폰번호로 로그인하면 도서 신청과 진행상황 확인을 한 곳에서 관리할 수 있습니다.", "로그인 화면 안내 문구"],
  ["FOOTER_TITLE", "동좌문도", "푸터 소개 제목"],
  ["FOOTER_HEADING", "동아대학교 도서관", "푸터 소개 기관명"],
  ["FOOTER_QUOTE", "“스승과 제자가 한자리에 앉아서 정도(正道)가 무엇인지 묻고 답한다.”", "푸터 소개 인용문"],
  ["FOOTER_DESCRIPTION", "동아대학교 도서관도 함께 길을 물으며 설립자의 교육철학 이념을 따릅니다.", "푸터 소개 설명"],
];

function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = String(params.action || "health");
    if (action === "health") return json_({ ok: true, service: "Dong-A University Library Book Sharing" });
    if (action === "bookMeta") return json_({ ok: true, item: getBookMeta_(params) });
    if (action === "bookMetaBatch") return json_({ ok: true, items: getBookMetaBatch_(params) });
    if (action === "settings") return json_({ ok: true, settings: readPublicSettings_() });
    if (action === "operation") return json_({ ok: true, operation: readOperation_() });
    if (action === "books") return json_({ ok: true, books: readBooks_() });
    if (action === "pending") return json_({ ok: true, entries: readPendingRequests_(params.refresh === "1") });
    if (action === "myRequests") return json_({ ok: true, entries: readMyRequests_(params) });
    return json_({ ok: false, message: "지원하지 않는 요청입니다." });
  } catch (error) {
    return json_({ ok: false, message: friendlyError_(error) });
  }
}

function doPost(e) {
  try {
    const payload = parsePost_(e);
    if (payload.action === "bookMetaBatch" || payload.action === "savedBookMetaBatch") return json_({ ok: true, items: getBookMetaBatch_(payload) });
    if (payload.action === "login") return json_(loginUser_(payload));
    if (payload.action === "submitApplication") return json_(submitApplication_(payload));
    if (payload.action === "cancelApplication") return json_(cancelApplication_(payload));
    throw new Error("지원하지 않는 요청입니다.");
  } catch (error) {
    return json_({ ok: false, message: friendlyError_(error) });
  }
}

function setupCareerBookGiveawaySheets() {
  ensureSheets_();
  SpreadsheetApp.getUi().alert("도서목록, 신청현황, 이용자, 설정, 운영, 도서메타 시트를 확인했습니다.");
}

function setAladinTtbKey() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt("알라딘 TTBKey 입력", "알라딘 Open API 인증키를 입력하세요.", ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  PropertiesService.getScriptProperties().setProperty("ALADIN_TTB_KEY", response.getResponseText().trim());
  ui.alert("알라딘 TTBKey를 Script Properties에 저장했습니다.");
}

function setSpreadsheetId() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt("구글시트 ID 입력", "신청을 받을 구글시트 주소의 /d/와 /edit 사이에 있는 ID를 입력하세요.", ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const id = response.getResponseText().trim();
  if (!id || id.indexOf("/") !== -1 || id.indexOf("macros") !== -1) {
    ui.alert("구글시트 ID만 입력해주세요. Apps Script 라이브러리 주소나 웹 앱 주소가 아닙니다.");
    return;
  }
  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", id);
  ui.alert("SPREADSHEET_ID를 Script Properties에 저장했습니다.");
}

function loginUser_(payload) {
  const studentId = requireText_(payload.studentId, "학번/직번");
  const studentName = requireText_(payload.studentName, "성명");
  const phone = normalizePhone_(requireText_(payload.phone, "휴대폰번호"));
  if (!payload.privacyConsent) throw new Error("개인정보 수집 및 이용에 동의해주세요.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSpreadsheet_().getSheetByName(CONFIG.USER_SHEET_NAME);
    const now = nowKst_();
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const values = sheet.getRange(2, 1, lastRow - 1, USER_HEADERS.length).getValues();
      for (let index = 0; index < values.length; index += 1) {
        if (String(values[index][0]) === studentId) {
          const row = index + 2;
          sheet.getRange(row, 2, 1, 6).setValues([[studentName, phone, "Y", values[index][4] || now, now, Number(values[index][6] || 0) + 1]]);
          return { ok: true, user: { studentId: studentId, studentName: studentName, phone: phone }, entries: readMyRequests_({ studentId: studentId, studentName: studentName, phone: phone }) };
        }
      }
    }
    sheet.appendRow([studentId, studentName, phone, "Y", now, now, 1]);
    return { ok: true, user: { studentId: studentId, studentName: studentName, phone: phone }, entries: [] };
  } finally {
    lock.releaseLock();
  }
}

function submitApplication_(payload) {
  const books = Array.isArray(payload.books) ? payload.books : [];
  if (!books.length) throw new Error("신청 도서가 없습니다.");
  if (books.length > CONFIG.MAX_BOOKS_PER_REQUEST) throw new Error("한 번에 신청할 수 있는 권수를 초과했습니다.");

  const studentName = requireText_(payload.studentName, "성명");
  const studentId = requireText_(payload.studentId, "학번/직번");
  const phone = normalizePhone_(requireText_(payload.phone, "휴대폰번호"));
  const memo = String(payload.memo || "").trim();
  const pickupCampus = String(payload.pickupCampus || "").trim();
  if (PICKUP_CAMPUSES.indexOf(pickupCampus) === -1) throw new Error("반드시 수령 캠퍼스를 선택해주세요.");
  const source = String(payload.source || "site").trim();

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    const requestSheet = ss.getSheetByName(CONFIG.REQUEST_SHEET_NAME);
    // Check fresh sheet values under the same lock as the application write.
    const operation = readOperation_();
    if (!operation.application.valid || !isOperationPeriodActive_(operation.application, Date.now())) {
      throw new Error("신청 기간 아님");
    }
    const bookMap = getBookMap_(books);
    const pendingIds = getPendingBookIdSet_();
    const now = nowKst_();
    const rows = [];
    const requestIds = [];

    books.forEach(function (item) {
      const bookId = requireText_(item.bookId, "도서ID");
      const book = bookMap[bookId];
      if (!book) throw new Error("도서목록에서 찾을 수 없는 도서입니다: " + bookId);
      if (book.status === "마감" || book.availableQuantity <= 0) throw new Error("이미 마감된 도서입니다: " + book.title);
      if (pendingIds[bookId]) throw new Error("이미 신청 진행중인 도서입니다: " + book.title);
      pendingIds[bookId] = true;
      const requestId = Utilities.getUuid();
      requestIds.push(requestId);
      rows.push([requestId, now, "신청접수", studentName, studentId, "", phone, "", source, bookId, book.registrationNo, book.title, book.author, book.isbn13 || item.isbn13 || "", memo, "", "", pickupCampus]);
    });

    if (!isOperationPeriodActive_(operation.application, Date.now())) throw new Error("신청 기간 아님");
    requestSheet.getRange(requestSheet.getLastRow() + 1, 1, rows.length, REQUEST_HEADERS.length).setValues(rows);
    SpreadsheetApp.flush();
    CacheService.getScriptCache().remove("careerBookPending");
    return { ok: true, requestIds: requestIds, count: rows.length };
  } finally {
    lock.releaseLock();
  }
}

function cancelApplication_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return cancelApplicationLocked_(payload);
  } finally {
    try { SpreadsheetApp.flush(); } finally { lock.releaseLock(); }
  }
}

function cancelApplicationLocked_(payload) {
  const requestId = requireText_(payload.requestId, "신청ID");
  const studentId = requireText_(payload.studentId, "학번/직번");
  const phone = normalizePhone_(requireText_(payload.phone, "휴대폰번호"));
  const studentName = String(payload.studentName || "").trim();
  const sheet = getSpreadsheet_().getSheetByName(CONFIG.REQUEST_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("신청내역을 찾을 수 없습니다.");

  const values = sheet.getRange(1, 1, lastRow, REQUEST_HEADERS.length).getDisplayValues();
  const indexes = headerIndexes_(values[0]);
  for (let index = 1; index < values.length; index += 1) {
    const row = values[index];
    if (cell_(row, indexes, "신청ID") !== requestId) continue;
    if (!isSameApplicant_(row, indexes, studentId, phone, studentName)) throw new Error("본인 신청내역만 취소할 수 있습니다.");
    const status = cell_(row, indexes, "상태");
    if (status !== "신청접수" && status !== "처리중") throw new Error("현재 상태에서는 취소할 수 없습니다.");
    sheet.getRange(index + 1, indexes["상태"] + 1).setValue("취소");
    sheet.getRange(index + 1, indexes["처리일시"] + 1).setValue(nowKst_());
    CacheService.getScriptCache().remove("careerBookPending");
    return { ok: true };
  }
  throw new Error("신청내역을 찾을 수 없습니다.");
}

function readMyRequests_(params) {
  const studentId = requireText_(params.studentId, "학번/직번");
  const phone = normalizePhone_(requireText_(params.phone, "휴대폰번호"));
  const studentName = String(params.studentName || "").trim();
  const sheet = getSpreadsheet_().getSheetByName(CONFIG.REQUEST_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(1, 1, lastRow, REQUEST_HEADERS.length).getDisplayValues();
  const indexes = headerIndexes_(values[0]);
  const entries = [];
  for (let index = values.length - 1; index >= 1; index -= 1) {
    const row = values[index];
    if (!isSameApplicant_(row, indexes, studentId, phone, studentName)) continue;
    entries.push({
      requestId: cell_(row, indexes, "신청ID"),
      requestedAt: cell_(row, indexes, "신청일시"),
      status: cell_(row, indexes, "상태"),
      bookId: cell_(row, indexes, "도서ID"),
      registrationNo: cell_(row, indexes, "등록번호"),
      title: cell_(row, indexes, "서명"),
      author: cell_(row, indexes, "저자"),
      memo: cell_(row, indexes, "메모"),
      pickupCampus: cell_(row, indexes, "수령캠퍼스"),
    });
  }
  return entries;
}

function isSameApplicant_(row, indexes, studentId, phone, studentName) {
  if (cell_(row, indexes, "학번") !== studentId) return false;
  const rowPhone = normalizePhone_(cell_(row, indexes, "연락처"));
  if (!rowPhone || rowPhone === phone) return true;
  const rowName = cell_(row, indexes, "학생명");
  return Boolean(studentName && rowName === studentName);
}

function readBooks_() {
  const sheet = getSpreadsheet_().getSheetByName(CONFIG.BOOK_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(1, 1, lastRow, BOOK_HEADERS.length).getDisplayValues();
  const indexes = headerIndexes_(values[0]);
  return values.slice(1).map(function (row) { return rowToBook_(row, indexes); }).filter(function (book) { return book.bookId && book.title; });
}

function readPublicSettings_() {
  const sheet = getSpreadsheet_().getSheetByName(CONFIG.SETTINGS_SHEET_NAME);
  const settings = {};
  DEFAULT_SETTINGS.forEach(function (row) { settings[row[0]] = normalizeTerminology_(row[1]); });
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return settings;
  const values = sheet.getRange(2, 1, lastRow - 1, 2).getDisplayValues();
  values.forEach(function (row) {
    const key = String(row[0] || "").trim();
    if (!settings.hasOwnProperty(key)) return;
    const value = String(row[1] || "").trim();
    if (value) settings[key] = normalizeTerminology_(value);
  });
  return settings;
}

function readOperation_() {
  const settings = Object.create(null);
  DEFAULT_OPERATION.forEach(function (row) { settings[row[0]] = row[1]; });
  const sheet = getSpreadsheet_().getSheetByName(CONFIG.OPERATION_SHEET_NAME);
  // Existing deployments remain open until an administrator sets a period.
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(function (row) {
      const key = String(row[0] || "").trim();
      if (Object.prototype.hasOwnProperty.call(settings, key)) settings[key] = row[1];
    });
  }
  const now = Date.now();
  const application = operationPeriod_(settings["운영시작일시"], settings["운영종료일시"]);
  const popup = operationPeriod_(settings["팝업시작일시"], settings["팝업종료일시"]);
  const imageUrl = String(settings["팝업이미지URL"] || "").trim();
  popup.imageUrl = /^https:\/\/[^\s]+$/i.test(imageUrl) ? imageUrl : "";
  popup.alt = String(settings["팝업대체텍스트"] || "도서 나눔 안내").trim();
  return { serverNow: now, application: application, popup: popup };
}

function operationPeriod_(start, end) {
  const startsAt = parseOperationDate_(start, false);
  const endsAt = parseOperationDate_(end, true);
  const valid = !isNaN(startsAt) && !isNaN(endsAt) && (startsAt === null || endsAt === null || startsAt <= endsAt);
  return { startsAt: isNaN(startsAt) ? null : startsAt, endsAt: isNaN(endsAt) ? null : endsAt, valid: valid };
}

function parseOperationDate_(value, endOfDay) {
  if (value instanceof Date) return value.getTime();
  const text = String(value == null ? "" : value).trim();
  if (!text) return null;
  const parts = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!parts) return NaN;
  const date = parts[1] + "-" + parts[2] + "-" + parts[3];
  const time = parts[4] === undefined ? (endOfDay ? "23:59:59" : "00:00:00") : parts[4] + ":" + parts[5] + ":" + (parts[6] || "00");
  const timestamp = Date.parse(date + "T" + time + "+09:00");
  // Reject overflow dates (e.g. February 30), not just unparsable input.
  if (!isFinite(timestamp) || Utilities.formatDate(new Date(timestamp), CONFIG.TIME_ZONE, CONFIG.DATETIME_FORMAT) !== date + " " + time) return NaN;
  return timestamp + (endOfDay && parts[4] === undefined ? 999 : 0);
}

function isOperationPeriodActive_(period, now) {
  return period.valid && (period.startsAt === null || now >= period.startsAt) && (period.endsAt === null || now <= period.endsAt);
}

function readPendingRequests_(forceRefresh) {
  const cached = forceRefresh ? null : readCacheJson_("careerBookPending");
  if (cached) return cached;
  const sheet = getSpreadsheet_().getSheetByName(CONFIG.REQUEST_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(1, 1, lastRow, REQUEST_HEADERS.length).getDisplayValues();
  const indexes = headerIndexes_(values[0]);
  const active = { "신청접수": true, "처리중": true, "확정": true };
  const seen = {};
  const entries = [];

  for (let i = values.length - 1; i >= 1; i -= 1) {
    const row = values[i];
    const status = cell_(row, indexes, "상태");
    const bookId = cell_(row, indexes, "도서ID");
    if (!active[status] || !bookId || seen[bookId]) continue;
    seen[bookId] = true;
    entries.push({
      requestId: cell_(row, indexes, "신청ID"),
      requestedAt: cell_(row, indexes, "신청일시"),
      status: status,
      studentMasked: maskName_(cell_(row, indexes, "학생명")) + " / " + status,
      bookId: bookId,
      registrationNo: cell_(row, indexes, "등록번호"),
      title: cell_(row, indexes, "서명"),
      author: cell_(row, indexes, "저자"),
    });
  }
  writeCacheJson_("careerBookPending", entries, CONFIG.PENDING_CACHE_SECONDS);
  return entries;
}

function getBookMeta_(params) {
  return getBookMetaBatch_({ items: [params] })[String(params.bookId || "").trim()] || normalizeAladinItem_(null);
}

function getBookMetaBatch_(params) {
  const items = parseMetaItems_(params.items).filter(Boolean).slice(0, CONFIG.MAX_META_BATCH_SIZE);
  const result = {};
  // Public requests only read persisted metadata. Missing data never calls Aladin.
  const table = readMetadataTable_();
  items.forEach(function (item) {
    const id = String(item.bookId || "").trim();
    if (!id) return;
    const record = table.records[id];
    result[id] = record && (!item.title || record.sourceKey === metadataSourceKey_(item))
      ? record.item : normalizeAladinItem_(null);
  });
  return result;
}

// Only the administrator's batch collector calls the external API.
function fetchAladinMetaBatch_(params) {
  const deadline = params.deadline || Date.now() + CONFIG.META_SYNC_BUDGET_MS;
  const items = parseMetaItems_(params.items);
  const result = {};
  const key = getAladinKey_();
  const jobs = [];
  items.slice(0, CONFIG.MAX_META_BATCH_SIZE).forEach(function (item) {
    if (!item) return;
    const bookId = String(item.bookId || "").trim();
    if (!bookId) return;
    const isbn = String(item.isbn13 || "").replace(/[^0-9Xx]/g, "");
    const title = String(item.title || "").trim();
    const author = String(item.author || "").trim();
    const cacheKey = "aladinStoredV1:" + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, metadataSourceKey_(item)));
    const cached = readCacheJson_(cacheKey);
    result[bookId] = cached || Object.assign(normalizeAladinItem_(null), { collectionStatus: "대기" });
    if (cached || !key) return;
    const urls = [];
    if (isbn) urls.push(CONFIG.ALADIN_API_BASE + "ItemLookUp.aspx?" + toQuery_({ ttbkey: key, itemIdType: "ISBN13", ItemId: isbn, output: "js", Version: CONFIG.ALADIN_VERSION, Cover: "Big" }));
    if (title) buildAladinQueries_(title, author).forEach(function (query) {
      urls.push(CONFIG.ALADIN_API_BASE + "ItemSearch.aspx?" + toQuery_({ ttbkey: key, Query: query.query, QueryType: query.type, SearchTarget: "Book", MaxResults: 1, start: 1, output: "js", Version: CONFIG.ALADIN_VERSION, Cover: "Big" }));
    });
    if (!urls.length) result[bookId].collectionStatus = "미검색";
    jobs.push({ bookId: bookId, cacheKey: cacheKey, urls: urls, next: 0, done: false });
  });
  // Preserve search priority within each book, fetch different books together.
  while (Date.now() < deadline) {
    const pending = jobs.filter(function (job) { return !job.done && job.next < job.urls.length; });
    if (!pending.length) break;
    for (let offset = 0; offset < pending.length; offset += CONFIG.META_CONCURRENCY) {
      if (Date.now() >= deadline) break;
      const batch = pending.slice(offset, offset + CONFIG.META_CONCURRENCY);
      // Count actual outgoing requests, including failures; cache hits cost nothing.
      if (params.reserveBudget && !reserveMetadataBudget_(batch.length)) {
        params.budgetExhausted = true;
        return result;
      }
      let responses;
      try {
        responses = UrlFetchApp.fetchAll(batch.map(function (job) { return { url: job.urls[job.next++], muteHttpExceptions: true }; }));
      } catch (error) {
        batch.forEach(function (job) { job.done = true; result[job.bookId].collectionStatus = "오류"; });
        continue;
      }
      batch.forEach(function (job, index) {
        try {
          const response = responses[index];
          if (response.getResponseCode() >= 400) { job.done = true; result[job.bookId].collectionStatus = "오류"; return; }
          const data = JSON.parse(response.getContentText());
          if (data.errorCode) { job.done = true; result[job.bookId].collectionStatus = "오류"; return; }
          const found = data.item && data.item[0];
          if (found) {
            result[job.bookId] = normalizeAladinItem_(found);
            job.done = true;
          }
          if (found || job.next === job.urls.length) {
            result[job.bookId].collectionStatus = found ? "완료" : "미검색";
            writeCacheJson_(job.cacheKey, result[job.bookId], CONFIG.META_CACHE_SECONDS);
          }
        } catch (error) { job.done = true; result[job.bookId].collectionStatus = "오류"; }
      });
    }
  }
  return result;
}

function metadataSourceKey_(book) {
  return JSON.stringify([String(book.isbn13 || "").replace(/[^0-9Xx]/g, ""), String(book.title || "").trim(), String(book.author || "").trim()]);
}

function readMetadataTable_() {
  const sheet = getSpreadsheet_().getSheetByName(CONFIG.META_SHEET_NAME);
  const records = Object.create(null);
  if (!sheet || sheet.getLastRow() === 0) return { sheet: sheet, records: records };
  const rows = sheet.getRange(1, 1, sheet.getLastRow(), META_HEADERS.length).getDisplayValues();
  if (META_HEADERS.some(function (header, i) { return rows[0][i] !== header; })) {
    throw new Error("도서메타 시트의 열 제목과 순서를 확인해주세요.");
  }
  rows.slice(1).forEach(function (row, index) {
    if (!row[0]) return;
    records[row[0]] = {
      row: index + 2, sourceKey: row[1], retryAt: Number(row[12]) || 0,
      item: { cover: row[2], description: row[3], title: row[4], author: row[5], publisher: row[6], pubDate: row[7], isbn13: row[8], link: row[9], collectionStatus: row[10], updatedAt: row[11] }
    };
  });
  return { sheet: sheet, records: records };
}

// Run manually, or install the optional ten-minute trigger below. No web action exposes this.
function syncBookMetadata() {
  // Separate from the script lock used by student applications.
  const lock = LockService.getUserLock();
  if (!lock.tryLock(1000)) return;
  try {
    return syncBookMetadataBatch_(Date.now() + CONFIG.META_SYNC_BUDGET_MS);
  } finally {
    lock.releaseLock();
  }
}

function syncBookMetadataBatch_(deadline, snapshot) {
  if (!getAladinKey_()) throw new Error("ALADIN_TTB_KEY를 먼저 설정해주세요.");
  if (!snapshot) {
    ensureSheet_(getSpreadsheet_(), CONFIG.META_SHEET_NAME, META_HEADERS);
    snapshot = { table: readMetadataTable_(), books: readBooks_() };
  }
  const table = snapshot.table;
  const books = snapshot.books;
  const reusable = Object.create(null);
  Object.keys(table.records).forEach(function (id) {
    const record = table.records[id];
    if (["완료", "미검색"].indexOf(record.item.collectionStatus) !== -1) reusable[record.sourceKey] = record.item;
  });
  const now = Date.now();
  const candidates = books.filter(function (book) {
    const record = table.records[book.bookId];
    if (!record || record.sourceKey !== metadataSourceKey_(book)) return true;
    return !record.item.collectionStatus || (record.item.collectionStatus === "오류" && record.retryAt <= now);
  }).slice(0, CONFIG.META_SYNC_BATCH_SIZE);
  const jobs = [];
  const seen = Object.create(null);
  candidates.forEach(function (book) {
    const key = metadataSourceKey_(book);
    if (!reusable[key] && !seen[key]) { seen[key] = book.bookId; jobs.push(book); }
  });
  const fetchOptions = { items: jobs, deadline: deadline, reserveBudget: true };
  const fetched = jobs.length ? fetchAladinMetaBatch_(fetchOptions) : {};
  const appended = [];
  let processed = 0;
  const appendStart = table.sheet.getLastRow() + 1;
  candidates.forEach(function (book) {
    const key = metadataSourceKey_(book);
    const item = reusable[key] || fetched[seen[key]];
    const status = item.collectionStatus || "오류";
    // Budget/time limits are not API failures. Leave these books eligible for continuation.
    if (status === "대기") return;
    processed += 1;
    const row = [book.bookId, key, item.cover, item.description, item.title, item.author, item.publisher, item.pubDate, item.isbn13, item.link, status, nowKst_(), status === "오류" ? now + CONFIG.META_RETRY_MS : ""]
      .map(function (value) { return typeof value === "string" && value.charAt(0) === "=" ? "'" + value : value; });
    const previous = table.records[book.bookId];
    if (previous) table.sheet.getRange(previous.row, 1, 1, META_HEADERS.length).setValues([row]);
    else appended.push(row);
    table.records[book.bookId] = {
      row: previous ? previous.row : appendStart + appended.length - 1,
      sourceKey: key, item: item, retryAt: status === "오류" ? now + CONFIG.META_RETRY_MS : 0
    };
  });
  if (appended.length) {
    const requiredRows = table.sheet.getLastRow() + appended.length;
    if (requiredRows > table.sheet.getMaxRows()) table.sheet.insertRowsAfter(table.sheet.getMaxRows(), requiredRows - table.sheet.getMaxRows());
    table.sheet.getRange(table.sheet.getLastRow() + 1, 1, appended.length, META_HEADERS.length).setValues(appended);
  }
  SpreadsheetApp.flush();
  console.log("도서메타 " + processed + "권 처리. 완료/미검색은 재수집하지 않으며 오류는 24시간 뒤 재시도합니다.");
  return { processed: processed, budgetExhausted: Boolean(fetchOptions.budgetExhausted) };
}

// One click starts the whole catalog. A one-shot trigger resumes unfinished work.
function syncAllBookMetadata() {
  if (!getAladinKey_()) throw new Error("ALADIN_TTB_KEY를 먼저 설정해주세요.");
  removeBookMetadataTrigger();
  PropertiesService.getScriptProperties().setProperty("METADATA_SYNC_ALL", "1");
  scheduleMetadataContinuation_(60000);
  return continueBookMetadataSync();
}

function continueBookMetadataSync() {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty("METADATA_SYNC_ALL") !== "1") return;
  const lock = LockService.getUserLock();
  if (!lock.tryLock(1000)) return;
  try {
    if (properties.getProperty("METADATA_SYNC_ALL") !== "1") return;
    // Schedule recovery before work: a platform timeout cannot lose the continuation.
    scheduleMetadataContinuation_(10 * 60000);
    const deadline = Date.now() + CONFIG.META_SYNC_BUDGET_MS;
    ensureSheet_(getSpreadsheet_(), CONFIG.META_SHEET_NAME, META_HEADERS);
    const snapshot = { table: readMetadataTable_(), books: readBooks_() };
    let processed = 0;
    let result = {};
    while (Date.now() < deadline && properties.getProperty("METADATA_SYNC_ALL") === "1") {
      result = syncBookMetadataBatch_(deadline, snapshot);
      processed += result.processed;
      if (!result.processed || result.budgetExhausted) break;
    }
    if (properties.getProperty("METADATA_SYNC_ALL") !== "1") return { processed: processed, stopped: true };
    const remaining = snapshot.books.filter(function (book) {
      const record = snapshot.table.records[book.bookId];
      return !record || record.sourceKey !== metadataSourceKey_(book) || ["완료", "미검색"].indexOf(record.item.collectionStatus) === -1;
    });
    if (!remaining.length) {
      stopAllBookMetadataSync();
      console.log("전체 도서메타 수집 완료: " + snapshot.books.length + "권. exportBookMetadata로 내보낼 수 있습니다.");
      return { processed: processed, remaining: 0 };
    }
    let delay = 60000;
    if (result.budgetExhausted) {
      const day = Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, "yyyy-MM-dd");
      delay = Math.max(60000, Date.parse(day + "T00:05:00+09:00") + 86400000 - Date.now());
    } else if (!result.processed) {
      // Only failures awaiting their cooldown remain; don't poll every minute.
      const nextRetry = Math.min.apply(null, remaining.map(function (book) {
        const record = snapshot.table.records[book.bookId];
        return record ? record.retryAt : 0;
      }));
      delay = Math.max(60000, nextRetry - Date.now());
    }
    scheduleMetadataContinuation_(delay);
    console.log("이번 실행 " + processed + "권 처리, 남은 " + remaining.length + "권은 자동으로 이어서 수집합니다.");
    return { processed: processed, remaining: remaining.length };
  } catch (error) {
    // Preserve the flag, but back off on sheet/service errors.
    if (properties.getProperty("METADATA_SYNC_ALL") === "1") scheduleMetadataContinuation_(60 * 60000);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function scheduleMetadataContinuation_(delay) {
  clearMetadataContinuation_();
  ScriptApp.newTrigger("continueBookMetadataSync").timeBased().after(delay).create();
}

function clearMetadataContinuation_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "continueBookMetadataSync") ScriptApp.deleteTrigger(trigger);
  });
}

function stopAllBookMetadataSync() {
  PropertiesService.getScriptProperties().deleteProperty("METADATA_SYNC_ALL");
  clearMetadataContinuation_();
}

function reserveMetadataBudget_(count) {
  const properties = PropertiesService.getScriptProperties();
  const day = Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, "yyyy-MM-dd");
  const saved = JSON.parse(properties.getProperty("METADATA_DAILY_BUDGET") || "{}");
  const used = saved.day === day ? Number(saved.used || 0) : 0;
  if (used + count > CONFIG.META_DAILY_REQUEST_BUDGET) return false;
  properties.setProperty("METADATA_DAILY_BUDGET", JSON.stringify({ day: day, used: used + count }));
  return true;
}

function installBookMetadataTrigger() {
  if (ScriptApp.getProjectTriggers().some(function (trigger) { return trigger.getHandlerFunction() === "syncBookMetadata"; })) return;
  ScriptApp.newTrigger("syncBookMetadata").timeBased().everyMinutes(10).create();
}

function removeBookMetadataTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "syncBookMetadata") ScriptApp.deleteTrigger(trigger);
  });
}

// Private Drive file: only book metadata, never applicants, settings or API keys.
function exportBookMetadata() {
  const table = readMetadataTable_();
  const items = Object.create(null);
  readBooks_().forEach(function (book) {
    const record = table.records[book.bookId];
    if (record && record.sourceKey === metadataSourceKey_(book) && ["완료", "미검색"].indexOf(record.item.collectionStatus) !== -1) {
      items[book.bookId] = Object.assign({ sourceKey: record.sourceKey }, record.item);
    }
  });
  const file = DriveApp.createFile("book-metadata.json", JSON.stringify({ generatedAt: nowKst_(), items: items }), "application/json");
  console.log("다운로드 후 사이트에 반영: " + file.getUrl());
  return file.getUrl();
}

function readCacheJson_(key) {
  try {
    const value = CacheService.getScriptCache().get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) { return null; }
}

function writeCacheJson_(key, value, seconds) {
  // Cache eviction/size limits must not turn a successful read into an error.
  try { CacheService.getScriptCache().put(key, JSON.stringify(value), seconds); } catch (error) {}
}

function aladinLookupByIsbn_(key, isbn13) {
  return fetchAladinFirstItem_(CONFIG.ALADIN_API_BASE + "ItemLookUp.aspx?" + toQuery_({ ttbkey: key, itemIdType: "ISBN13", ItemId: isbn13, output: "js", Version: CONFIG.ALADIN_VERSION, Cover: "Big" }));
}

function aladinSearchByTitle_(key, title, author) {
  const queries = buildAladinQueries_(title, author);
  for (let index = 0; index < queries.length; index += 1) {
    const item = fetchAladinFirstItem_(CONFIG.ALADIN_API_BASE + "ItemSearch.aspx?" + toQuery_({
      ttbkey: key,
      Query: queries[index].query,
      QueryType: queries[index].type,
      SearchTarget: "Book",
      MaxResults: 1,
      start: 1,
      output: "js",
      Version: CONFIG.ALADIN_VERSION,
      Cover: "Big"
    }));
    if (item) return item;
  }
  return null;
}

function fetchAladinFirstItem_(url) {
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() >= 400) return null;
  const data = JSON.parse(response.getContentText());
  return data && data.item && data.item.length ? data.item[0] : null;
}

function normalizeAladinItem_(item) {
  if (!item) return { title: "", author: "", publisher: "", pubDate: "", description: "", cover: "", isbn13: "", link: "" };
  return { title: item.title || "", author: item.author || "", publisher: item.publisher || "", pubDate: item.pubDate || "", description: item.description || "", cover: item.cover || "", isbn13: item.isbn13 || "", link: item.link || "" };
}

function buildAladinQueries_(title, author) {
  const cleanTitle = cleanSearchText_(title);
  const cleanAuthor = cleanAuthorText_(author);
  const titleWithoutSubtitle = cleanTitle.split(/[:：-]/)[0].trim();
  const titleWithoutBrackets = cleanTitle.replace(/\([^)]*\)/g, "").replace(/\[[^\]]*\]/g, "").trim();
  const queries = [];

  addAladinQuery_(queries, "Title", cleanTitle);
  addAladinQuery_(queries, "Keyword", cleanAuthor ? cleanTitle + " " + cleanAuthor : cleanTitle);
  addAladinQuery_(queries, "Title", titleWithoutSubtitle);
  addAladinQuery_(queries, "Keyword", cleanAuthor ? titleWithoutSubtitle + " " + cleanAuthor : titleWithoutSubtitle);
  addAladinQuery_(queries, "Title", titleWithoutBrackets);
  addAladinQuery_(queries, "Keyword", cleanAuthor ? titleWithoutBrackets + " " + cleanAuthor : titleWithoutBrackets);

  return queries;
}

function addAladinQuery_(queries, type, query) {
  const text = String(query || "").trim().replace(/\s+/g, " ");
  if (!text || text.length < 2) return;
  const key = type + ":" + text;
  for (let index = 0; index < queries.length; index += 1) {
    if (queries[index].key === key) return;
  }
  queries.push({ key: key, type: type, query: text });
}

function cleanSearchText_(value) {
  return String(value || "")
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanAuthorText_(value) {
  return String(value || "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/지음|저자|엮음|옮김|저|역/g, "")
    .split(/[,;·|\/]/)[0]
    .replace(/\s+/g, " ")
    .trim();
}

function getBookMap_(requestedBooks) {
  const map = {};
  const sheet = getSpreadsheet_().getSheetByName(CONFIG.BOOK_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return map;
  const indexes = headerIndexes_(sheet.getRange(1, 1, 1, BOOK_HEADERS.length).getDisplayValues()[0]);
  const wanted = new Set(requestedBooks.map(function (item) { return requireText_(item.bookId, "도서ID"); }));
  // Large carts use one bulk read instead of up to twenty remote row reads.
  if (wanted.size > 4) {
    sheet.getRange(2, 1, lastRow - 1, BOOK_HEADERS.length).getDisplayValues().forEach(function (row) {
      if (!wanted.has(cell_(row, indexes, "도서ID"))) return;
      const book = rowToBook_(row, indexes);
      map[book.bookId] = book;
    });
    return map;
  }
  // Build a fresh, narrow ID index so sorting/inserting sheet rows cannot stale it.
  const ids = sheet.getRange(2, indexes["도서ID"] + 1, lastRow - 1, 1).getDisplayValues();
  ids.forEach(function (row, index) {
    if (!wanted.has(String(row[0]).trim())) return;
    const book = rowToBook_(sheet.getRange(index + 2, 1, 1, BOOK_HEADERS.length).getDisplayValues()[0], indexes);
    map[book.bookId] = book;
  });
  return map;
}

function getPendingBookIdSet_() {
  const set = {};
  // Never use a display cache to authorize an application.
  const sheet = getSpreadsheet_().getSheetByName(CONFIG.REQUEST_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return set;
  const indexes = headerIndexes_(sheet.getRange(1, 1, 1, REQUEST_HEADERS.length).getDisplayValues()[0]);
  const ids = sheet.getRange(2, indexes["도서ID"] + 1, lastRow - 1, 1).getDisplayValues();
  const statuses = sheet.getRange(2, indexes["상태"] + 1, lastRow - 1, 1).getDisplayValues();
  ids.forEach(function (row, i) {
    if (["신청접수", "처리중", "확정"].indexOf(String(statuses[i][0]).trim()) !== -1) set[String(row[0]).trim()] = true;
  });
  return set;
}

function rowToBook_(row, indexes) {
  return {
    bookId: cell_(row, indexes, "도서ID"),
    registrationNo: cell_(row, indexes, "등록번호"),
    title: cell_(row, indexes, "서명"),
    author: cell_(row, indexes, "저자"),
    callNo: cell_(row, indexes, "청구기호"),
    location: cell_(row, indexes, "소장위치"),
    price: Number(String(cell_(row, indexes, "가격")).replace(/[^0-9]/g, "")) || 0,
    publicationYear: cell_(row, indexes, "출판년도"),
    detailUrl: cell_(row, indexes, "도서상세URL"),
    isbn13: cell_(row, indexes, "ISBN13"),
    category: cell_(row, indexes, "카테고리") || "기타",
    status: cell_(row, indexes, "상태") || "신청가능",
    availableQuantity: cell_(row, indexes, "신청가능수량") === "" ? 1 : Number(cell_(row, indexes, "신청가능수량")),
    note: cell_(row, indexes, "비고"),
  };
}

function ensureSheets_() {
  const ss = getSpreadsheet_();
  ensureSheet_(ss, CONFIG.BOOK_SHEET_NAME, BOOK_HEADERS);
  const requestSheet = ensureSheet_(ss, CONFIG.REQUEST_SHEET_NAME, REQUEST_HEADERS);
  ensurePickupCampusColumn_(requestSheet);
  ensureSheet_(ss, CONFIG.USER_SHEET_NAME, USER_HEADERS);
  const settingsSheet = ensureSheet_(ss, CONFIG.SETTINGS_SHEET_NAME, ["설정항목", "값", "비고"]);
  ensureDefaultSettings_(settingsSheet);
  ensureOperationSheet_(ss);
  ensureSheet_(ss, CONFIG.META_SHEET_NAME, META_HEADERS);
}

function ensureOperationSheet_(ss) {
  const sheet = ensureSheet_(ss, CONFIG.OPERATION_SHEET_NAME, OPERATION_HEADERS);
  const headers = sheet.getRange(1, 1, 1, 3).getDisplayValues()[0];
  if (OPERATION_HEADERS.some(function (header, index) { return headers[index] !== header; })) {
    throw new Error("운영 시트의 A~C열 제목은 설정항목, 값, 설명이어야 합니다. 기존 데이터를 확인해주세요.");
  }
  const existing = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues().map(function (row) { return row[0]; }) : [];
  const missing = DEFAULT_OPERATION.filter(function (row) { return existing.indexOf(row[0]) === -1; });
  if (missing.length) {
    const start = sheet.getLastRow() + 1;
    // Text keeps date-only input distinct from an explicit midnight deadline.
    sheet.getRange(start, 2, missing.length, 1).setNumberFormat("@");
    sheet.getRange(start, 1, missing.length, 3).setValues(missing);
  }
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 360);
  sheet.setColumnWidth(3, 580);
  sheet.getRange(1, 1, sheet.getLastRow(), 3).setWrap(true);
}

function ensurePickupCampusColumn_(sheet) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const column = REQUEST_HEADERS.length;
    if (sheet.getMaxColumns() < column) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), column - sheet.getMaxColumns());
    }
    const header = sheet.getRange(1, column).getDisplayValue().trim();
    if (header === "수령캠퍼스") return;
    if (header || !sheet.getRange(1, column, sheet.getMaxRows(), 1).isBlank()) {
      throw new Error("신청현황 R열에 기존 데이터가 있습니다. 수령캠퍼스 열 위치를 확인해주세요.");
    }
    sheet.getRange(1, column).setValue("수령캠퍼스");
  } finally {
    lock.releaseLock();
  }
}

function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureDefaultSettings_(sheet) {
  const lastRow = sheet.getLastRow();
  const existing = {};
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().forEach(function (row) {
      const key = String(row[0] || "").trim();
      if (key) existing[key] = true;
    });
  }
  const rows = DEFAULT_SETTINGS.filter(function (row) { return !existing[row[0]]; });
  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") || getSetting_("SPREADSHEET_ID");
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function getAladinKey_() {
  return PropertiesService.getScriptProperties().getProperty("ALADIN_TTB_KEY") || getSetting_("ALADIN_TTB_KEY");
}

function getSetting_(key) {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) return "";
  const sheet = active.getSheetByName(CONFIG.SETTINGS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return "";
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues();
  for (let i = 0; i < values.length; i += 1) {
    if (values[i][0] === key) return String(values[i][1] || "").trim();
  }
  return "";
}

function headerIndexes_(headers) {
  const map = {};
  headers.forEach(function (header, index) { map[String(header || "").trim()] = index; });
  return map;
}

function cell_(row, indexes, header) {
  const index = indexes[header];
  return index === undefined ? "" : String(row[index] || "").trim();
}

function parsePost_(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error("요청 본문이 비어 있습니다.");
  return JSON.parse(e.postData.contents);
}

function parseMetaItems_(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function requireText_(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(label + "을(를) 입력해주세요.");
  return text;
}

function normalizePhone_(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function nowKst_() {
  return Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, CONFIG.DATETIME_FORMAT);
}

function normalizeTerminology_(value) {
  return String(value || "").replace(/교원/g, "교직원").replace(/교번/g, "직번");
}

function toQuery_(params) {
  return Object.keys(params).map(function (key) { return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]); }).join("&");
}

function maskName_(name) {
  const text = String(name || "").trim();
  if (!text) return "신청자";
  if (text.length === 1) return text + "*";
  return text.charAt(0) + "*".repeat(text.length - 1);
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function friendlyError_(error) {
  const message = error && error.message ? error.message : String(error || "");
  if (message.indexOf("Illegal spreadsheet id or key") !== -1) {
    return "구글시트 ID가 올바르지 않습니다. Apps Script 프로젝트 설정의 SPREADSHEET_ID에는 구글시트 주소의 /d/와 /edit 사이에 있는 값만 입력해주세요.";
  }
  return message;
}
