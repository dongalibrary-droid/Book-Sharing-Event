const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const raw = fs.readFileSync(process.argv[2] || 'public/assets/js/app.js', 'utf8');
const source = raw.replace(/\}\)\(\);\s*$/, `
  showLoading = message => { window.loading = message; };
  hideLoading = () => { window.loading = false; };
  toast = message => { window.messages.push(message); };
  refreshPending = async () => { window.refreshes += 1; };
  window.api = {state, els, cancelRequest, bulkCancelRequests, loadMyRequests, markRequestCancelled};
})();`);
function fixture() {
  const calls = [];
  const timers = new Map();
  let id = 0;
  const context = vm.createContext({
    window: {CAREER_BOOKS_CONFIG:{appsScriptUrl:'https://example.org/exec'}, confirm:()=>true, messages:[], refreshes:0},
    document: {body:{dataset:{page:'status'}}, addEventListener:()=>{}, querySelectorAll:()=>[]},
    localStorage:{getItem:()=>null, setItem:()=>{}}, URL, AbortController, console,
    setTimeout:(fn,ms)=>{const key=++id; if(ms===1500 || ms===1000) queueMicrotask(fn); else timers.set(key,{fn,ms}); return key;},
    clearTimeout:key=>timers.delete(key),
    fetch:(url,options)=>new Promise((resolve,reject)=>{
      calls.push({url,options,resolve,reject});
      options.signal.addEventListener('abort',()=>reject(Object.assign(new Error('timeout'),{name:'AbortError'})));
    }),
  });
  vm.runInContext(source,context);
  const api=context.window.api;
  api.state.user={studentId:'test',studentName:'test',phone:'000'};
  api.state.myRequests=['a','b'].map(requestId=>({requestId,bookId:requestId,status:'신청접수',title:requestId}));
  api.state.pendingIds=new Set(['a','b']);
  Object.assign(api.els,{myRequests:{querySelectorAll:()=>[]},myRequestCount:{},bulkActions:{},bulkCancelSelected:{}});
  return {api,calls,timers,window:context.window};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const respond=(call,data)=>call.resolve({ok:true,json:async()=>data});
const cancelled=id=>({requestId:id,status:'취소'});
(async()=>{
  let f=fixture();
  let work=f.api.cancelRequest('a');
  await f.api.cancelRequest('a');
  assert.equal(f.calls.length,1,'duplicate clicks do not repeat writes');
  respond(f.calls[0],{ok:true}); await work;
  assert.equal(f.calls.length,1,'successful cancellation does not wait for another full read');
  assert.equal(f.api.state.myRequests[0].status,'취소');
  assert.equal(f.api.state.pendingIds.has('a'),false);
  assert.equal(f.window.loading,false);

  // The server committed, but the POST response timed out. Confirm through a read.
  f=fixture(); work=f.api.cancelRequest('a');
  [...f.timers.values()].find(t=>t.ms===15000).fn(); await tick();
  assert.equal(new URL(f.calls[1].url).searchParams.get('action'),'myRequests');
  respond(f.calls[1],{ok:true,entries:[cancelled('a')]}); await work;
  assert.equal(f.api.state.myRequests[0].status,'취소');
  assert.equal(f.calls.filter(c=>c.options.method==='POST').length,1);
  assert.equal(f.window.loading,false);

  f=fixture(); work=f.api.cancelRequest('a');
  f.calls[0].reject(new Error('connection lost')); await tick();
  respond(f.calls[1],{ok:true,entries:[cancelled('b')]}); await tick();
  respond(f.calls[2],{ok:true,entries:[cancelled('a')]}); await work;
  assert.equal(f.api.state.myRequests[0].status,'취소','second read can confirm delayed commit');

  f=fixture(); work=f.api.cancelRequest('a');
  f.calls[0].reject(new Error('offline')); await tick();
  respond(f.calls[1],{ok:true,entries:[cancelled('b')]}); await tick();
  respond(f.calls[2],{ok:false,message:'read failed'}); await work;
  assert.equal(f.api.state.myRequests[0].status,'신청접수','another cancellation or failed read is not success');
  assert.match(f.window.messages.at(-1),/완료 여부/);
  assert.equal(f.window.loading,false);

  f=fixture(); work=f.api.cancelRequest('a');
  respond(f.calls[0],{ok:false,message:'현재 상태에서는 취소할 수 없습니다.'}); await work;
  assert.equal(f.calls.length,1,'explicit rejection does not retry');
  assert.equal(f.api.state.myRequests[0].status,'신청접수');

  f=fixture(); f.api.state.selectedRequestIds=new Set(['a','b']);
  work=f.api.bulkCancelRequests(); respond(f.calls[0],{ok:true}); await tick();
  f.calls[1].reject(new Error('offline')); await tick();
  f.calls[2].reject(new Error('offline')); await tick();
  f.calls[3].reject(new Error('offline')); await work;
  assert.equal(f.api.state.myRequests[0].status,'취소');
  assert.equal(f.api.state.myRequests[1].status,'신청접수');
  assert.deepEqual([...f.api.state.selectedRequestIds],['b']);
  assert.match(f.window.messages.at(-1),/1건 취소 완료/);
  assert.equal(f.window.loading,false);

  f=fixture(); work=f.api.loadMyRequests(false);
  f.api.markRequestCancelled('a');
  respond(f.calls[0],{ok:true,entries:[{requestId:'a',status:'신청접수'}]}); await work;
  assert.equal(f.api.state.myRequests[0].status,'취소','late read cannot undo a confirmed cancellation');
  work=f.api.loadMyRequests(false);
  respond(f.calls[1],{ok:false,message:'read failed'}); await tick();
  respond(f.calls[2],{ok:false,message:'read failed'}); await work;
  assert.equal(f.api.state.myRequests[0].status,'취소','failed refresh preserves known result');
  f=fixture(); work=f.api.loadMyRequests(false);
  assert.equal(f.api.loadMyRequests(true),work,'status refreshes share an in-flight request');
  [...f.timers.values()].find(t=>t.ms===20000).fn(); await tick();
  respond(f.calls[1],{ok:true,entries:[cancelled('a')]}); await work;
  assert.equal(f.api.state.myRequests[0].status,'취소','status read retries a timeout and renders the recovered result');
  console.log('Cancellation response recovery, bounded reads, partial results and stale-read checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
