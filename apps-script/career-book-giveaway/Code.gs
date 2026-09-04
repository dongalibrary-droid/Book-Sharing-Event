const CONFIG = {
  BOOK_SHEET_NAME: "도서목록",
  REQUEST_SHEET_NAME: "신청현황",
  USER_SHEET_NAME: "이용자",
  SETTINGS_SHEET_NAME: "설정",
  ALADIN_API_BASE: "https://www.aladin.co.kr/ttb/api/",
  ALADIN_VERSION: "20131101",
  META_CACHE_SECONDS: 21600,
  PENDING_CACHE_SECONDS: 60,
  MAX_BOOKS_PER_REQUEST: 20,
  MAX_META_BATCH_SIZE: 25,
};

const BOOK_HEADERS = ["도서ID", "등록번호", "서명", "저자", "청구기호", "소장위치", "가격", "출판년도", "도서상세URL", "ISBN13", "카테고리", "상태", "신청가능수량", "신청중수량", "확정수량", "비고", "원본번호"];
const REQUEST_HEADERS = ["신청ID", "신청일시", "상태", "학생명", "학번", "학과", "연락처", "이메일", "신청경로", "도서ID", "등록번호", "서명", "저자", "ISBN13", "메모", "처리자", "처리일시"];
const USER_HEADERS = ["학번", "성명", "휴대폰번호", "개인정보동의", "최초로그인", "최근로그인", "로그인횟수"];

function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = String(params.action || "health");
    if (action === "health") return json_({ ok: true, service: "Dong-A University Library Career Book Giveaway" });
    if (action === "bookMeta") return json_({ ok: true, item: getBookMeta_(params) });
    if (action === "bookMetaBatch") return json_({ ok: true, items: getBookMetaBatch_(params) });
    ensureSheets_();
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
    if (payload.action === "bookMetaBatch") return json_({ ok: true, items: getBookMetaBatch_(payload) });
    ensureSheets_();
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
  SpreadsheetApp.getUi().alert("도서목록, 신청현황, 이용자, 설정 시트를 확인했습니다.");
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
  const studentId = requireText_(payload.studentId, "학번");
  const studentName = requireText_(payload.studentName, "성명");
  const phone = normalizePhone_(requireText_(payload.phone, "휴대폰번호"));
  if (!payload.privacyConsent) throw new Error("개인정보 수집 및 이용에 동의해주세요.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSpreadsheet_().getSheetByName(CONFIG.USER_SHEET_NAME);
    const now = new Date();
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
  const studentId = requireText_(payload.studentId, "학번");
  const phone = normalizePhone_(requireText_(payload.phone, "휴대폰번호"));
  const memo = String(payload.memo || "").trim();
  const source = String(payload.source || "site").trim();

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    const requestSheet = ss.getSheetByName(CONFIG.REQUEST_SHEET_NAME);
    const bookMap = getBookMap_();
    const pendingIds = getPendingBookIdSet_();
    const now = new Date();
    const rows = [];
    const requestIds = [];

    books.forEach(function (item) {
      const bookId = requireText_(item.bookId, "도서ID");
      const book = bookMap[bookId];
      if (!book) throw new Error("도서목록에서 찾을 수 없는 도서입니다: " + bookId);
      if (book.status === "마감" || Number(book.availableQuantity || 1) <= 0) throw new Error("이미 마감된 도서입니다: " + book.title);
      if (pendingIds[bookId]) throw new Error("이미 신청 진행중인 도서입니다: " + book.title);
      const requestId = Utilities.getUuid();
      requestIds.push(requestId);
      rows.push([requestId, now, "신청접수", studentName, studentId, "", phone, "", source, bookId, book.registrationNo, book.title, book.author, book.isbn13 || item.isbn13 || "", memo, "", ""]);
    });

    requestSheet.getRange(requestSheet.getLastRow() + 1, 1, rows.length, REQUEST_HEADERS.length).setValues(rows);
    CacheService.getScriptCache().remove("careerBookPending");
    return { ok: true, requestIds: requestIds, count: rows.length };
  } finally {
    lock.releaseLock();
  }
}

function cancelApplication_(payload) {
  const requestId = requireText_(payload.requestId, "신청ID");
  const studentId = requireText_(payload.studentId, "학번");
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
    sheet.getRange(index + 1, indexes["처리일시"] + 1).setValue(new Date());
    CacheService.getScriptCache().remove("careerBookPending");
    return { ok: true };
  }
  throw new Error("신청내역을 찾을 수 없습니다.");
}

function readMyRequests_(params) {
  const studentId = requireText_(params.studentId, "학번");
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

function readPendingRequests_(forceRefresh) {
  const cache = CacheService.getScriptCache();
  const cached = forceRefresh ? "" : cache.get("careerBookPending");
  if (cached) return JSON.parse(cached);
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
  cache.put("careerBookPending", JSON.stringify(entries), CONFIG.PENDING_CACHE_SECONDS);
  return entries;
}

function getBookMeta_(params) {
  const key = getAladinKey_();
  if (!key) return { description: "", cover: "", message: "ALADIN_TTB_KEY가 설정되지 않았습니다." };
  const isbn13 = String(params.isbn13 || "").replace(/[^0-9Xx]/g, "");
  const title = String(params.title || "").trim();
  const author = String(params.author || "").trim();
  const cacheKey = "aladinMeta:" + (isbn13 || Utilities.base64EncodeWebSafe(title + "|" + author).slice(0, 80));
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);
  let item = isbn13 ? aladinLookupByIsbn_(key, isbn13) : null;
  if (!item && title) item = aladinSearchByTitle_(key, title, author);
  const normalized = normalizeAladinItem_(item);
  cache.put(cacheKey, JSON.stringify(normalized), CONFIG.META_CACHE_SECONDS);
  return normalized;
}

function getBookMetaBatch_(params) {
  const items = parseMetaItems_(params.items);
  const result = {};
  items.slice(0, CONFIG.MAX_META_BATCH_SIZE).forEach(function (item) {
    const bookId = String(item.bookId || "").trim();
    if (!bookId) return;
    result[bookId] = getBookMeta_(item);
  });
  return result;
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

function getBookMap_() {
  const map = {};
  readBooks_().forEach(function (book) { map[book.bookId] = book; });
  return map;
}

function getPendingBookIdSet_() {
  const set = {};
  readPendingRequests_().forEach(function (entry) { set[entry.bookId] = true; });
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
    availableQuantity: Number(cell_(row, indexes, "신청가능수량")) || 1,
    note: cell_(row, indexes, "비고"),
  };
}

function ensureSheets_() {
  const ss = getSpreadsheet_();
  ensureSheet_(ss, CONFIG.BOOK_SHEET_NAME, BOOK_HEADERS);
  ensureSheet_(ss, CONFIG.REQUEST_SHEET_NAME, REQUEST_HEADERS);
  ensureSheet_(ss, CONFIG.USER_SHEET_NAME, USER_HEADERS);
  ensureSheet_(ss, CONFIG.SETTINGS_SHEET_NAME, ["설정항목", "값", "비고"]);
}

function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
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
