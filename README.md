# 동아대학교 도서관 도서 나눔

학생/교직원이 도서 나눔 대상 도서를 온라인 서점처럼 검색하고, 개별 신청 또는 장바구니 신청을 할 수 있는 정적 웹사이트입니다.

## 구성

- `public/index.html`: 학생/교직원 로그인 첫 화면
- `public/catalog.html`: 도서목록, 카테고리, 검색, 미리보기, 장바구니 신청
- `public/detail.html`: 개별 도서 상세 소개 페이지
- `public/status.html`: 로그인한 학생/교직원의 신청 진행상황 및 신청 취소
- `public/guide.html`: 학생/교직원용 이용안내
- `public/assets/data/career-books.json`: 웹사이트 도서 데이터
- `apps-script/career-book-giveaway/Code.gs`: 구글시트와 알라딘 API를 연결하는 Apps Script
- `outputs/career-book-giveaway/dong-a-career-book-giveaway-google-sheets-template.xlsx`: 구글시트 업로드용 템플릿
- `docs/setup.md`: 배포 및 연결 안내

## 다시 생성

원본 엑셀 목록이 바뀌면 아래 명령으로 JSON과 구글시트 템플릿을 다시 만듭니다.

```bash
npm run build:data
```

PowerShell 실행 정책 때문에 `npm`이 막히면 아래처럼 실행해도 됩니다.

```bash
python scripts/build-career-books.py
```

## 운영 문구

신청 기간과 이미지 팝업은 `운영` 시트에서 관리합니다. `setupCareerBookGiveawaySheets` 실행 후 운영 시작·종료일시, 팝업 이미지 URL과 노출 시작·종료일시를 입력하세요. 기간 밖에는 모든 신규 신청/담기 버튼이 `신청 기간 아님`으로 비활성화되고 서버에서도 접수가 차단됩니다. 팝업은 모든 페이지에 표시되며 `오늘 하루 안 봄`과 `닫기`를 지원합니다. [기존 플랫폼 적용 및 입력 예시](docs/setup.md#운영-기간과-이미지-팝업-설정)를 참고하세요.

표지·소개는 관리자용 `syncAllBookMetadata`를 한 번 실행해 전체 도서를 `도서메타` 시트에 미리 저장합니다. 시간/호출 한도에 도달하면 자동으로 이어서 처리하며, 중지는 `stopAllBookMetadataSync`로 합니다. `exportBookMetadata`로 내보낸 JSON을 `node scripts/import-book-metadata.cjs "book-metadata.json"`으로 가져와 배포하면 해당 도서는 Apps Script 표지 조회도 생략합니다. 목록 재생성 후에는 메타데이터를 다시 가져와야 합니다. [수집·자동 실행·배포 절차](docs/setup.md)를 참고하세요. 검증은 `npm test`로 실행합니다.

Apps Script의 `setupCareerBookGiveawaySheets`를 실행하면 구글시트 `설정` 시트에 사이트 문구 항목이 자동으로 준비됩니다.

- `SITE_TITLE`: 로그인 화면과 브라우저 제목에 표시되는 행사명
- `SITE_EYEBROW`: 로그인 화면 상단 보조 문구
- `SITE_DESCRIPTION`: 로그인 화면 안내 문구
- `FOOTER_TITLE`, `FOOTER_HEADING`, `FOOTER_QUOTE`, `FOOTER_DESCRIPTION`: 하단 푸터 소개 문구
