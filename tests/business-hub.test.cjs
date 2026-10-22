const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const moduleSource = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]
  .replace(/^import[\s\S]*?from\s+"[^"]+";/gm, '')
  // vm.Script otherwise incorrectly publishes module-scoped function declarations.
  .replace(/^async function (\w+)\(/gm, 'const $1 = async function(')
  .replace(/^function (\w+)\(/gm, 'const $1 = function(');

function app() {
  const elements = new Map();
  const store = new Map();
  const records = new Map();
  const element = () => ({ value: '', style: {}, textContent: '', innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(child) { (this.children ||= []).push(child); },
    querySelector() { return element(); }, addEventListener() {}, remove() {}, focus() {},
    setAttribute() {}, after() {}, click() {} });
  const getElementById = id => {
    if (id.startsWith('recurd-')) return null;
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const context = {
    console: { log() {}, warn() {}, error() {} }, URL, AbortController, Intl, setTimeout: () => 1, clearTimeout() {},
    setInterval: () => 1, clearInterval() {},
    alert() {}, confirm: () => true,
    navigator: {}, location: { origin: 'http://localhost' },
    Chart: class Chart { destroy() {} },
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k,v) => store.set(k,String(v)),
      removeItem: k => store.delete(k), key: i => [...store.keys()][i], get length() { return store.size; } },
    document: { getElementById, createElement: element, addEventListener() {}, querySelectorAll: () => [], body: element() },
    initializeApp: () => ({}), getAuth: () => ({}), getFirestore: () => ({}),
    onAuthStateChanged() {}, collection: (_db, ...parts) => parts.join('/'),
    doc: (_db, ...parts) => parts.join('/'), query: x => x, orderBy() {},
    onSnapshot: () => () => {}, serverTimestamp: () => ({ seconds: 123, nanoseconds: 0 }),
    Timestamp: class Timestamp { constructor(seconds,nanoseconds) { this.seconds=seconds; this.nanoseconds=nanoseconds; } },
    getDocs: async () => ({ forEach() {} }),
    getDoc: async ref => ({ exists: () => records.has(ref), data: () => records.get(ref) }),
    addDoc: async (ref,data) => { records.set(ref+'/random',data); return {id:'random'}; },
    setDoc: async (ref,data) => { records.set(ref,data); },
    updateDoc: async (ref,data) => { records.set(ref,{...records.get(ref),...data}); },
    deleteDoc: async ref => { records.delete(ref); },
    runTransaction: async (_db,fn) => fn({
      get: async ref => ({exists: () => records.has(ref),data: () => records.get(ref)}),
      set: (ref,data) => { records.set(ref,data); }
    }),
    writeBatch: () => { const writes=[];return {set: (r,d)=>writes.push([r,d]),commit: async()=>writes.forEach(([r,d])=>records.set(r,d))}; },
    signOut: async () => {}, signInWithEmailAndPassword: async () => {}, createUserWithEmailAndPassword: async () => {}
  };
  context.window = context;
  context.window.addEventListener = () => {};
  vm.createContext(context);
  vm.runInContext(moduleSource, context);
  return { context, elements, store, records, run: code => vm.runInContext(code,context), get: getElementById };
}

test('recurring task row binds events without querying an unattached button', () => {
  const a=app();
  a.run("activeTab='vanhanh';recurringTasks=[{id:'demo',taskText:'demo',type:'monthly',dayOfMonth:1,active:true}];renderRecurring()");
  assert.equal(a.get('recurring-list').children.length,1);
});

test('due recurrence creates exactly one todo across repeated checks', async () => {
  const a=app();
  a.run("currentUser={uid:'demo'};const n=new Date();recurringTasks=[{id:'demo',active:true,type:'monthly',dayOfMonth:n.getDate(),taskText:'demo'}]");
  await a.run('_checkRecurringTasks()'); await a.run('_checkRecurringTasks()');
  assert.equal([...a.records.keys()].filter(k=>k.startsWith('users/demo/todos/')).length,1);
  assert.equal([...a.records.values()].find(v=>v.text==='demo').dueDate,a.run('today()'));
});

test('failed recurrence can retry without a premature local success marker', async () => {
  const a=app();let fail=true;
  const transaction=a.context.runTransaction;
  a.context.runTransaction=async (...args)=>{if(fail) throw Error('offline');return transaction(...args);};
  a.run("currentUser={uid:'demo'};const n=new Date();recurringTasks=[{id:'retry',active:true,type:'monthly',dayOfMonth:n.getDate(),taskText:'retry'}]");
  await a.run('_checkRecurringTasks()');fail=false;await a.run('_checkRecurringTasks()');
  assert.equal([...a.records.values()].filter(v=>v.text==='retry').length,1);
});

test('voice entry resets previous income and displays current schema as plain text', async () => {
  const a=app();a.get('tx-thu').value='900000';
  a.context.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({thu:0,chi:100000,mang:'kh',desc:'<img src=x onerror=alert(1)>',date:'2026-10-22',confidence:1})}}]})});
  a.store.set('or_key','test-only');await a.run("parseVoiceTransaction('demo')");
  assert.equal(Number(a.get('tx-thu').value),0);
  assert.equal(Number(a.get('tx-chi').value),100000);
  assert.doesNotMatch(a.get('voice-status').textContent,/undefined|NaN/);
  assert.equal(a.get('voice-status').innerHTML,'');
});

test('stop recording stops the recognition engine', () => {
  const a=app();let stopped=false;
  a.context.SpeechRecognition=class {start(){} stop(){stopped=true;}};
  a.run('startRecording();stopRecording()');assert.equal(stopped,true);
});

test('Vietnam business date does not go backwards at 00:30', () => {
  const a=app();assert.equal(a.run("businessDate(new Date('2026-10-22T00:30:00+07:00'))"),'2026-10-22');
});

test('deal and search rendering escape untrusted HTML', () => {
  const a=app();const payload='<img src=x onerror=alert(1)>';
  const card=a.run(`dealCard({id:'demo',mang:'kh',ten:${JSON.stringify(payload)}})`);
  assert.doesNotMatch(card,/<img src=x/);assert.match(card,/&lt;img/);
  a.run(`renderSearchDropdown(${JSON.stringify(payload)},[])`);
  assert.doesNotMatch(a.get('search-dropdown').innerHTML,/<img src=x/);
});

test('chat text never becomes HTML markup', () => {
  const a=app();a.run("appendChatMsg('<img src=x onerror=alert(1)>','user')");
  assert.equal(a.get('it-chat-messages').children[0].children[0].textContent,'<img src=x onerror=alert(1)>');
});

test('inline UI handlers have global entry points', () => {
  const a=app();for(const name of ['renderPipeline','runAllReminders','_itModalSetPreview']) assert.equal(typeof a.context[name],'function',name);
});

test('backup covers cloud business collections and rejects malformed files before writes', async () => {
  const a=app();for(const name of ['cksCustomers','recurringTasks','itCustomErrors','rentPayments']) assert.equal(a.run(`BACKUP_COLLECTIONS.includes('${name}')`),true,name);
  a.run("currentUser={uid:'demo'}");
  await a.run("confirmImport({appName:'Other app',data:{deals:[{id:'bad'}]}})");
  assert.equal(a.records.size,0);
});

test('merge restore keeps unrelated records and original timestamps', async () => {
  const a=app();a.run("currentUser={uid:'demo'}");a.records.set('users/demo/deals/existing',{ten:'existing'});
  await a.run("confirmImport({appName:'Business Hub',version:2,data:{deals:[{id:'restored',createdAt:{seconds:10,nanoseconds:20},ten:'demo'}]}})");
  assert.equal(a.records.has('users/demo/deals/existing'),true);
  assert.equal(a.records.get('users/demo/deals/restored').createdAt.seconds,10);
  assert.equal(a.records.get('users/demo/deals/restored').createdAt.nanoseconds,20);
});

test('negative transaction amounts are rejected before writes', async () => {
  const a=app();a.run("currentUser={uid:'demo'}");
  for(const [id,v] of Object.entries({'tx-date':'2026-10-22','tx-thu':'-100','tx-chi':'0','tx-desc':'demo','tx-mang':'kh'})) a.get(id).value=v;
  await a.run('addTX()');assert.equal(a.records.size,0);
});

test('paying rent persists to cloud instead of only local storage', async () => {
  const a=app();a.run("currentUser={uid:'demo'};apartments=[{id:'apt1',address:'demo',price:'100',status:'occupied'}]");
  await a.run("toggleRentPaid('apt1',10,2026)");
  assert.equal([...a.records.entries()].some(([k,v])=>k.startsWith('users/demo/rentPayments/')&&v.paid===true),true);
});

test('module and classic scripts parse in the Firebase Hosting source', () => {
  for(const [,attrs,src] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if(!src.trim())continue;
    new vm.Script(attrs.includes('module')?src.replace(/^import[\s\S]*?from\s+"[^"]+";/gm,''):src);
  }
  const config=JSON.parse(fs.readFileSync(path.join(__dirname,'../firebase.json'),'utf8'));
  assert.equal(config.hosting.public,'public');
});

test('backup validation rejects the entire invalid file before the first write', async () => {
  const a=app();a.run("currentUser={uid:'demo'}");
  await a.run("confirmImport({appName:'Business Hub',version:3,data:{deals:[{id:'good',ten:'demo'},{id:'../bad'}]}})");
  assert.equal(a.records.size,0);
});

test('legacy rent migration preserves a newer unpaid cloud status', async () => {
  const a=app();a.run("currentUser={uid:'demo'}");
  a.store.set('rent_status_2026_10',JSON.stringify({apt1:true,apt2:true}));
  a.records.set('users/demo/rentPayments/2026_10_apt1',{apartmentId:'apt1',month:10,year:2026,paid:false});
  await a.run('migrateRentLocalToCloud()');
  assert.equal(a.records.get('users/demo/rentPayments/2026_10_apt1').paid,false);
  assert.equal(a.records.get('users/demo/rentPayments/2026_10_apt2').paid,true);
  assert.equal(a.store.get('rent_cloud_migrated_demo'),'1');
});

test('monthly report correctly shows improvement from a negative previous balance', () => {
  const a=app();a.run("activeTab='baocao';_bcMonth=10;_bcYear=2026;transactions=[{date:'2026-09-01',thu:0,chi:100,mang:'kh'},{date:'2026-10-01',thu:0,chi:50,mang:'kh'}];renderBaoCao()");
  assert.match(a.get('bc-kpi-ln').innerHTML,/↑50/);
});

test('occupied apartments and urgent followups retain priority zero in sort order', () => {
  const a=app();a.run("activeTab='vanhanh';apartments=[{id:'a',address:'OCCUPIED',status:'occupied'},{id:'b',address:'FINDING',status:'finding'}];renderApartments();followups=[{id:'c',name:'NORMAL',urgency:'normal'},{id:'d',name:'URGENT',urgency:'urgent'}];renderFollowups()");
  const apartments=a.get('apt-list').innerHTML,followups=a.get('fu-list').innerHTML;
  assert.ok(apartments.indexOf('OCCUPIED')<apartments.indexOf('FINDING'));
  assert.ok(followups.indexOf('URGENT')<followups.indexOf('NORMAL'));
});

test('unsafe contract URLs are rejected and highlighted search text is escaped', () => {
  const a=app();assert.equal(a.run("safeLink('javascript:alert(1)')"),'');
  assert.match(a.run("safeLink('https://example.com/contract')"),/^https:/);
  assert.doesNotMatch(a.run("hlText('<img src=x onerror=alert(1)>','img')"),/<img/);
});

test('rent schedule escapes customer and address fields', () => {
  const a=app();
  a.run("apartments=[{id:'a',address:'<img src=x onerror=alert(1)>',tenant:'<svg onload=alert(1)>',price:'100',status:'occupied',payDay:'1'}];renderRentSchedule()");
  assert.doesNotMatch(a.get('rent-list').innerHTML,/<img|<svg/);
});

test('service worker does not intercept API GETs or return HTML for missing scripts', async () => {
  const listeners={};let cacheFallbacks=0;
  const context={URL,Response,fetch:async()=>{throw Error('offline');},
    self:{location:{origin:'http://localhost'},addEventListener:(name,fn)=>listeners[name]=fn},
    caches:{match:async()=>{cacheFallbacks++;return undefined;}}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/sw.js'),'utf8'),context);
  let response;
  const wait=[];
  const event=request=>({request,respondWith:p=>response=p,waitUntil:p=>wait.push(p)});
  listeners.fetch(event({method:'GET',url:'https://firestore.googleapis.com/data',mode:'cors',destination:''}));
  assert.equal(response,undefined);
  listeners.fetch(event({method:'GET',url:'https://www.gstatic.com/firebasejs/missing.js',mode:'cors',destination:'script'}));
  const result=await response;await Promise.all(wait);
  assert.equal(result.type,'error');assert.equal(cacheFallbacks,1);
});

test('Firestore subscriptions retain document IDs and include documents lacking createdAt', () => {
  const a=app();a.context.onSnapshot=(ref,callback)=>{
    if(ref.endsWith('/deals'))callback({forEach:fn=>fn({id:'real-id',data:()=>({id:'spoofed-id',ten:'demo'})})});
    return ()=>{};
  };
  a.run("activeTab='none';currentUser={uid:'demo'};subscribeAll()");
  assert.equal(a.run('deals[0].id'),'real-id');
});
