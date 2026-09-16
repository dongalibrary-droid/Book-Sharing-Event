const fs = require('node:fs');
const path = require('node:path');

function sourceKey(book) {
  return JSON.stringify([String(book.isbn13 || '').replace(/[^0-9Xx]/g, ''), String(book.title || '').trim(), String(book.author || '').trim()]);
}

function mergeMetadata(catalog, snapshot) {
  if (!Array.isArray(catalog.books) || !snapshot.items || typeof snapshot.items !== 'object' || Array.isArray(snapshot.items)) {
    throw new Error('도서목록 또는 도서메타 JSON 형식이 올바르지 않습니다.');
  }
  let matched = 0;
  for (const book of catalog.books) {
    const key = sourceKey(book);
    if (book.metadataSourceKey !== key) {
      delete book.metadata;
      delete book.metadataSourceKey;
    }
    const item = snapshot.items[book.bookId];
    if (!item || item.sourceKey !== key || !['완료', '미검색'].includes(item.collectionStatus)) continue;
    // Explicit public field list; never copy arbitrary sheet columns into the site.
    book.metadata = {};
    for (const field of ['cover', 'description', 'title', 'author', 'publisher', 'pubDate', 'isbn13', 'link', 'collectionStatus', 'updatedAt']) {
      book.metadata[field] = String(item[field] || '');
    }
    book.metadataSourceKey = key;
    matched += 1;
  }
  return matched;
}

if (require.main === module) {
  if (!process.argv[2]) throw new Error('사용법: node scripts/import-book-metadata.cjs 다운로드한/book-metadata.json');
  const target = path.resolve(__dirname, '../public/assets/data/career-books.json');
  const catalog = JSON.parse(fs.readFileSync(target, 'utf8'));
  const snapshot = JSON.parse(fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace(/^\uFEFF/, ''));
  const matched = mergeMetadata(catalog, snapshot);
  if (!matched) throw new Error('일치하는 수집 결과가 없어 파일을 변경하지 않았습니다. 도서ID·ISBN·서명·저자를 확인해주세요.');
  fs.writeFileSync(target + '.tmp', JSON.stringify(catalog), 'utf8');
  fs.renameSync(target + '.tmp', target);
  console.log(`${matched}권의 표지·소개를 정적 도서목록에 반영했습니다. public 폴더를 배포해주세요.`);
}

module.exports = { mergeMetadata, sourceKey };
