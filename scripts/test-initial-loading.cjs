const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const raw = fs.readFileSync(process.argv[2] || 'public/assets/js/app.js', 'utf8');
const source = raw.replace(/\}\)\(\);\s*$/, `
  window.api = {state, restoreSavedCovers, persistSavedCovers, prepareInitialBooks};
  loadBooks = async () => {};
  loadBookMetadata = (books, options) => window.fetchMetadata(books, options);
})();`);
function fixture(storage = new Map()) {
  const timers = new Map();
  const images = [];
  let id = 0;
  const context = vm.createContext({
    window:{CAREER_BOOKS_CONFIG:{appsScriptUrl:'https://example.org/exec'}},
    document:{body:{dataset:{page:'catalog'}},addEventListener:()=>{}},
    localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
    setTimeout:(fn,ms)=>{const key=++id;timers.set(key,{fn,ms});return key;},clearTimeout:key=>timers.delete(key),
    Image:class {set src(url){images.push(url);this.onload();}}, console, URLSearchParams,
  });
  vm.runInContext(source,context);
  const api=context.window.api;
  api.state.books=[{bookId:'a',title:'Book',author:'Author',isbn13:'123'}];
  return {api,storage,timers,images,window:context.window};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  let f=fixture();
  f.api.state.coverCache.a={cover:'https://example.org/cover.jpg',description:'Intro'};
  f.api.persistSavedCovers(f.api.state.books);
  const saved=f.storage;
  f=fixture(saved);f.api.restoreSavedCovers();
  assert.equal(f.api.state.coverCache.a.cover,'https://example.org/cover.jpg','covers survive navigation');
  f=fixture(saved);f.api.state.books[0].title='Changed';f.api.restoreSavedCovers();
  assert.equal(f.api.state.coverCache.a,undefined,'changed search criteria invalidate a cached cover');
  const record=JSON.parse(saved.get('careerBookSavedCoversV1'));
  record.items[0].at=Date.now()-7*3600000;
  saved.set('careerBookSavedCoversV1',JSON.stringify(record));
  f=fixture(saved);f.api.restoreSavedCovers();
  assert.equal(f.api.state.coverCache.a,undefined,'expired metadata is not reused');
  f=fixture();f.api.state.coverCache.a={};f.api.persistSavedCovers(f.api.state.books);
  assert.equal(JSON.parse(f.storage.get('careerBookSavedCoversV1')).items.length,0,'missing metadata is not persisted');

  f=fixture();let metadataStarted=false;let releaseAvailability;let releaseMetadata;let finished=false;
  f.window.fetchMetadata=(_,options)=>{metadataStarted=options.priority;return new Promise(resolve=>{releaseMetadata=resolve;});};
  const work=f.api.prepareInitialBooks(new Promise(resolve=>{releaseAvailability=resolve;})).then(()=>{finished=true;});
  await tick();assert.equal(metadataStarted,true,'saved metadata starts before availability completes');
  assert.equal(finished,false);
  f.api.state.coverCache.a={cover:'https://example.org/cover.jpg'};
  releaseMetadata();await tick();assert.equal(finished,false,'ready covers do not bypass availability');
  releaseAvailability();await work;
  assert.deepEqual(f.images,['https://example.org/cover.jpg'],'first covers preload before the list is revealed');

  f=fixture();f.window.fetchMetadata=()=>new Promise(()=>{});
  const stalled=f.api.prepareInitialBooks(Promise.resolve(false));await tick();
  [...f.timers.values()].find(timer=>timer.ms===2000).fn();await stalled;
  assert.equal(f.timers.size,0,'missing covers cannot keep the initial overlay open forever');
  console.log('PASS: initial availability gate, early cover fetching, bounded optional wait, preloading and persistent cover validity');
})().catch(error=>{console.error(error);process.exitCode=1;});
