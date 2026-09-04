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
   - `SPREADSHEET_ID`: 현재 구글시트 ID. 같은 시트에 바인딩된 Apps Script라면 생략 가능합니다.
4. `배포 > 새 배포 > 웹 앱`을 선택합니다.
5. 실행 권한은 본인, 접근 권한은 행사 운영 방식에 맞게 설정합니다.
6. 배포 후 웹 앱 URL을 복사합니다.

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

- `신청현황`의 상태는 `신청접수`, `처리중`, `확정`, `취소`, `중복`, `마감` 중 하나로 관리합니다.
- `신청접수`, `처리중`, `확정` 상태인 도서는 사이트에서 신청 진행중으로 표시됩니다.
- 알라딘 API 키는 웹페이지에 넣지 말고 Apps Script의 Script Properties에만 저장하세요.
- 웹사이트는 정적 파일이라 GitHub Pages에서 동작하고, 신청 처리와 알라딘 API 호출은 Apps Script가 중계합니다.
