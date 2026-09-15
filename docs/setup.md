# 취업지원실 도서 나눔 행사 배포 안내

첨부 엑셀의 내용은 데이터로만 사용합니다. 운영 지시사항은 이 문서와 사용자 요청을 기준으로 합니다.

## 1. 구글시트 만들기

1. `outputs/career-book-giveaway/dong-a-career-book-giveaway-google-sheets-template.xlsx` 파일을 Google Drive에 업로드합니다.
2. 업로드한 파일을 Google Sheets로 엽니다.
3. 시트는 `도서목록`, `신청현황`, `이용자`, `설정` 4개로 구성되어 있습니다.
4. `도서목록`의 `ISBN13` 열을 채우면 알라딘 표지와 소개 매칭 정확도가 좋아집니다.

## 2. Apps Script 연결

1. 구글시트에서 `확장 프로그램 > Apps Script`를 엽니다.
2. `apps-script/career-book-giveaway/Code.gs` 내용을 붙여 넣습니다.
3. Script Properties에 아래 값을 저장합니다.
   - `ALADIN_TTB_KEY`: 보유 중인 알라딘 Open API TTBKey
   - `SPREADSHEET_ID`: 신청을 받을 구글시트 주소의 `/d/`와 `/edit` 사이에 있는 긴 ID입니다. 같은 시트에 바인딩된 Apps Script라면 생략 가능하지만, 배포 오류를 줄이려면 등록하는 것을 권장합니다.
     - 예: `https://docs.google.com/spreadsheets/d/구글시트ID/edit#gid=0` 주소에서 `구글시트ID` 부분만 입력합니다.
     - `https://script.google.com/macros/library/d/...` 주소의 ID는 Apps Script 라이브러리 ID라서 `SPREADSHEET_ID`로 쓰면 안 됩니다.
     - `1AbCdEfGhijk12345XYZ` 같은 예시 값이 남아 있으면 반드시 실제 구글시트 ID로 바꿉니다.
4. Apps Script 편집기 상단 함수 선택 목록에서 `setupCareerBookGiveawaySheets`를 선택하고 `실행`을 눌러 권한을 승인합니다.
   - 첫 실행 때 권한 승인 창이 나오면 Google 계정을 선택합니다.
   - "이 앱은 Google에서 확인하지 않았습니다" 화면이 나오면 `고급 > 프로젝트로 이동 > 허용` 순서로 승인합니다.
   - 실행 후 구글시트에 `도서목록`, `신청현황`, `이용자`, `설정` 시트가 있는지 확인합니다.
5. 필요하면 함수 선택 목록에서 `setSpreadsheetId`, `setAladinTtbKey`를 각각 실행해 값을 대화상자에 입력할 수 있습니다.
6. `배포 > 새 배포 > 웹 앱`을 선택합니다.
7. 실행 권한은 본인, 접근 권한은 행사 운영 방식에 맞게 설정합니다.
8. 배포 후 웹 앱 URL을 복사합니다.

## 3. 웹사이트와 연결

`public` 폴더 안의 각 HTML 파일 상단에 있는 `appsScriptUrl` 값을 Apps Script 웹 앱 URL로 바꿉니다.

```html
window.CAREER_BOOKS_CONFIG = {
  appsScriptUrl: "https://script.google.com/macros/s/배포ID/exec",
  dataUrl: "assets/data/career-books.json"
};
```

## 4. 페이지 구성

- `index.html`: 학생 로그인
- `catalog.html`: 도서목록, 카테고리별 신청, 도서 미리보기
- `detail.html`: 알라딘 API 표지와 소개를 보여주는 개별 도서 상세 페이지
- `status.html`: 본인 신청 진행상황 확인 및 신청 취소
- `guide.html`: 학생용 이용안내

## 5. GitHub Pages 배포

1. 이 폴더를 GitHub 저장소로 올립니다.
2. GitHub Pages 배포 경로를 `public` 폴더 또는 저장소 루트에 맞춥니다.
3. 저장소 루트로 배포한다면 `public` 안의 파일들을 배포 루트에 맞게 사용하세요.

## 운영 메모

### 도서목록 로딩 개선 적용 (2026-09-15)

**Apps Script를 먼저 업데이트한 뒤 웹사이트를 배포하세요.** 새 프런트엔드는 `catalogSummary`, `catalog`, `booksByIds` API를 사용하므로 기존 Apps Script만 연결되어 있으면 목록 조회 오류가 표시됩니다.

**이미 운영 중인 플랫폼은 기존 구글시트와 기존 Apps Script 프로젝트를 그대로 사용합니다.** 새 구글시트 생성, 엑셀 재업로드, 도서·신청·이용자 데이터 이관은 필요하지 않습니다. 아래는 기존 플랫폼 업데이트 절차이며, 문서 앞부분의 신규 구축 절차를 다시 진행할 필요가 없습니다.

1. 연결된 Google Sheets의 Apps Script 편집기에서 `apps-script/career-book-giveaway/Code.gs` 전체 내용으로 교체하고 저장합니다.
2. 기존 프로젝트의 `SPREADSHEET_ID`, `ALADIN_TTB_KEY` 설정을 그대로 유지합니다. 운영 시트에 `도서목록` A~Q열, `신청현황` A~R열(마지막 열 `수령캠퍼스`), `이용자`, `설정`이 이미 준비되어 있으면 `setupCareerBookGiveawaySheets`를 다시 실행할 필요가 없습니다. 초기 설정 함수는 신규 구축 또는 필수 시트·열이 없는 경우에만 실행합니다.
3. `배포 > 배포 관리 > 기존 웹 앱 수정 > 새 버전 > 배포`로 업데이트합니다. 기존 `/exec` URL을 유지합니다.
4. 웹 앱 URL 뒤에 `?action=catalogSummary`를 붙여 `ok: true`와 전체·신청 가능·카테고리별 집계를 확인합니다. `?action=catalog&page=1&pageSize=25`는 최대 25권을 반환해야 합니다.
5. 수정된 `public/assets/js/app.js`와 `public/*.html`을 배포합니다. 이 저장소는 `main`에 push하면 GitHub Actions가 `public` 폴더를 GitHub Pages로 배포합니다.

동작 방식:

- 전체 집계를 별도로 요청하며 도서 표지를 기다리지 않고 표시합니다. 목록은 현재 페이지 25권을 먼저 표시하고 바로 다음 페이지의 도서 정보 25권만 미리 받습니다.
- 검색·카테고리·정렬·신청 가능 필터는 **구글시트의 전체 도서**를 대상으로 처리합니다. 목록의 기준 데이터가 정적 JSON에서 구글시트 `도서목록`으로 바뀝니다.
- 표지 API는 현재 페이지에만 호출합니다. 앞 6권을 우선 조회하고 이후 8권씩 처리합니다. Apps Script는 각 묶음을 `UrlFetchApp.fetchAll`로 조회하며, 페이지 전환 시 이전 페이지의 후속 묶음 조회를 중단합니다. 이미 서버에서 실행 중인 한 묶음은 완료될 수 있습니다.
- 상세 페이지와 장바구니는 필요한 도서 ID만 요청합니다. 정상 연결 상태에서는 전체 `career-books.json`이나 전체 신청현황을 다운로드하지 않습니다. Apps Script URL이 없는 로컬 미리보기는 기존 정적 JSON을 사용합니다.
- 페이지 응답은 브라우저에서 30초 동안 최대 8개 캐시합니다. 전체 집계 서버 캐시는 30초, 신청현황 서버 캐시는 60초입니다. `신청상태 새로고침`은 캐시를 우회합니다. 실제 신청 시에는 잠금 안에서 최신 신청현황을 다시 검증합니다.
- 표지 조회 성공과 검색 결과 없음은 최대 6시간 재사용합니다. HTTP/API 오류는 검색 결과 없음으로 저장하지 않습니다.

배포 후 확인:

- 개발자 도구 Network에서 최초 목록이 `catalogSummary`, `catalog` 1·2페이지, 현재 페이지 `bookMetaBatch`만 요청하는지 확인합니다(`settings` 요청은 별도). 전체 JSON 요청이 없어야 합니다.
- 3페이지로 이동하고 카테고리, 검색, 정렬, 신청 가능 필터를 바꿔 해당 조건의 결과만 보이는지 확인합니다.
- 미리보기·상세·여러 페이지에서 담은 장바구니와 신청상태 새로고침을 확인합니다.

로컬 회귀 검증: `node scripts/test-catalog.cjs`, `node scripts/test-pickup-campus.cjs`.
현재 4,726권 테스트 데이터에서 전체 JSON은 2,515,331바이트, 집계 응답은 약 480바이트, 첫 25권 응답은 약 14KB입니다. 이는 모의 데이터로 계산한 전송량이며 실제 응답 시간 측정값은 아닙니다. 운영 속도는 Apps Script와 알라딘 응답 시간에 따라 달라집니다.

참고: [Apps Script UrlFetchApp 공식 문서](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app#fetchAll(Object)), [Cache 공식 문서](https://developers.google.com/apps-script/reference/cache/cache).

### 기존 플랫폼에 수령 캠퍼스 기능 적용

1. 연결된 Google Sheets의 Apps Script에서 `apps-script/career-book-giveaway/Code.gs` 전체 내용으로 기존 코드를 교체하고 저장합니다.
2. `setupCareerBookGiveawaySheets`를 실행합니다. 기존 A~Q열과 신청 기록은 유지하며, `신청현황` R1에 `수령캠퍼스`가 추가됩니다. 기존 신청의 캠퍼스는 빈칸으로 유지됩니다. R열에 다른 데이터가 있으면 덮어쓰지 않고 오류로 알립니다.
3. 기존 웹 앱 배포를 새 코드 버전으로 업데이트합니다. 기존 웹 앱 URL을 유지하면 사이트의 URL 설정을 바꿀 필요가 없습니다.
4. 수정된 `public/assets/js/app.js`와 `public/assets/css/styles.css`를 웹사이트에 반영합니다.
5. 개별 도서 또는 장바구니에서 신청할 때 캠퍼스를 선택하지 않으면 제출되지 않는지 확인합니다. 두 선택지 각각으로 신청하여 R열에 `한림도서관(승학)` 또는 `부민도서관(부민)`이 저장되는지 확인합니다.

장바구니로 여러 권을 신청하면 선택한 캠퍼스가 모든 신청 행에 저장됩니다. 본인 신청 내역에도 수령 캠퍼스가 표시되며, 과거 신청은 `미지정`으로 표시됩니다. 첨부 엑셀을 운영 시트에 다시 업로드할 필요는 없습니다. 기존 업로드용 템플릿에도 설정 함수를 실행하면 열이 추가되며, 템플릿 생성 코드는 새 열을 포함하도록 수정되어 있습니다.

- `신청현황`의 상태는 `신청접수`, `처리중`, `확정`, `취소`, `중복`, `마감` 중 하나로 관리합니다.
- `신청접수`, `처리중`, `확정` 상태인 도서는 사이트에서 신청 진행중으로 표시됩니다.
- 알라딘 API 키는 웹페이지에 넣지 말고 Apps Script의 Script Properties에만 저장하세요.
- 웹사이트는 정적 파일이라 GitHub Pages에서 동작하고, 신청 처리와 알라딘 API 호출은 Apps Script가 중계합니다.
