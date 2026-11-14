const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const LS = 'smallwins_records_v1';
const NICK = 'smallwins_nickname_v1';
const ENERGY = 'smallwins_energy_v1';
class Element {
  constructor(tag='div', doc) { this.tagName=tag.toUpperCase(); this.ownerDocument=doc; this.children=[]; this.listeners={}; this.style={}; this.dataset={}; this.attributes={}; this.value=''; this._text=''; this._html=''; this.className=''; this.isConnected=true; this.disabled=false;
    this.classList={ contains:x=>this.className.split(' ').includes(x), add:x=>{if(!this.classList.contains(x))this.className += ' '+x;}, remove:x=>{this.className=this.className.split(' ').filter(v=>v!==x).join(' ');}, toggle:(x,v)=>{v=v??!this.classList.contains(x); this.classList[v?'add':'remove'](x); return v;} };
  }
  set textContent(v){this._text=String(v);this.children=[];} get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  set innerHTML(v){this._html=String(v);this.children=[];this._text='';} get innerHTML(){return this._html;}
  setAttribute(k,v){this.attributes[k]=String(v);} getAttribute(k){return this.attributes[k]??null;} removeAttribute(k){delete this.attributes[k];}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);} dispatch(k,opts={}){const e={target:this,preventDefault(){this.defaultPrevented=true;},...opts}; for(const fn of this.listeners[k]||[])fn(e);return e;}
  appendChild(x){x.parentElement=this;this.children.push(x);return x;} append(...xs){xs.forEach(x=>this.appendChild(x));} replaceChildren(...xs){this.children=[];this._text='';this._html='';this.append(...xs);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this); this.isConnected=false;}
  contains(x){return x===this || this.children.some(c=>c.contains(x));} focus(){this.ownerDocument.activeElement=this;}
  matches(s){return s==='button' ? this.tagName==='BUTTON' : s.startsWith('.') ? this.classList.contains(s.slice(1)) : s.startsWith('#') ? this.id===s.slice(1) : false;}
  querySelectorAll(s){return this.children.flatMap(x=>[...(x.matches(s)?[x]:[]),...x.querySelectorAll(s)]);}
  querySelector(s){return this.querySelectorAll(s)[0]||null;} closest(s){return this.matches(s)?this:this.parentElement?.closest(s)||null;}
  setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;} getBoundingClientRect(){return{left:0,bottom:300,width:340};}
}
function record(id,text='旧版 #生活',mood='calm',days=0){const d=new Date();d.setDate(d.getDate()-days); const dk=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; return{id,text,mood,dateKey:dk,ts:d.getTime()-(Number(id)||0),timeText:dk+' 12:34'};}
function app(initial=[],extra={}){
 const elements=new Map(); const document={listeners:{},activeElement:null};
 document.body=new Element('body',document);
 document.createElement=tag=>new Element(tag,document); document.getElementById=id=>elements.get(id)||null;
 const ids=['home-date','home-greeting','stat-streak','stat-happy','recent-list','recent-empty','input-text','tag-suggest','mood-group','btn-save','today-list','today-empty','btn-clear-today','wall-search','wall-list','wall-empty','btn-wall-clear','btn-wall-clear-input','random-text','random-time','random-mood','btn-random-next','btn-install','install-tip','nickname-input','nickname-preview','energy-input','energy-preview','btn-export','btn-clear-all','modal','modal-title','modal-body','modal-close','modal-delete','page-home','page-today','page-wall','page-random','page-settings'];
 for(const id of ids){const el=document.createElement(id.startsWith('btn-')||id.startsWith('modal-')&&['modal-close','modal-delete'].includes(id)?'button':id==='input-text'?'textarea':'div');el.id=id;elements.set(id,el);document.body.appendChild(el);}
 elements.get('recent-list').appendChild(elements.get('recent-empty'));
 for(const id of ['modal-title','modal-body','modal-close','modal-delete']){elements.get(id).remove();elements.get(id).isConnected=true;elements.get('modal').appendChild(elements.get(id));}
 const moodButtons=['calm','happy','relaxed','lazy'].map(m=>{const el=document.createElement('button');el.dataset.mood=m;el.className='mood-btn';elements.get('mood-group').appendChild(el);return el;});
 const tabs=['home','today','wall','random','settings'].map(p=>{const el=document.createElement('button');el.className='tabbar-btn';el.dataset.target='page-'+p;document.body.appendChild(el);return el;});
 document.querySelector=s=>s.startsWith('#')?(elements.get(s.slice(1))||document.body.querySelector(s)):document.body.querySelector(s);
 document.querySelectorAll=s=>s==='.topnav button, .tabbar-btn'?tabs:s==='#mood-group .mood-btn'?moodButtons:s==='[data-target]'?tabs:document.body.querySelectorAll(s);
 document.addEventListener=(k,f)=>(document.listeners[k]??=[]).push(f);
 const store=new Map([[LS,typeof initial==='string'?initial:JSON.stringify(initial)],[NICK,'原昵称']]);
 let failWrite=Boolean(extra.failWrite),failRead=Boolean(extra.failRead);const localStorage={getItem(k){if(failRead)throw new Error('blocked');return store.get(k)??null;},setItem(k,v){if(failWrite)throw new Error('quota');store.set(k,String(v));}};
 const listeners={};const window={addEventListener:(k,f)=>(listeners[k]??=[]).push(f),scrollTo(){},PointerEvent:function(){}};
 const confirms=[],prompts=[],copied=[],timers=new Map(); let timerId=0;
 const context={document,window,localStorage,navigator:{clipboard:{writeText:async t=>copied.push(t)}},confirm:msg=>{confirms.push(msg);return extra.confirm??true;},prompt:(msg,text)=>{prompts.push({msg,text});},console,Date,Math,setTimeout:(f,ms)=>{timers.set(++timerId,{f,ms});return timerId;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:f=>f(),...extra.context};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8'),context,{filename:'main.js'});
 return{el:id=>elements.get(id),tabs,moodButtons,store,confirms,prompts,copied,document,context,timers,click:id=>elements.get(id).dispatch('click'),event:(k,e={})=>(listeners[k]||[]).forEach(f=>f(e)),failWrite:v=>failWrite=v,failRead:v=>failRead=v,read:()=>JSON.parse(store.get(LS))};
}


// Exercise the retained legacy runtime with the same DOM/storage boundary used by runtime.test.cjs.
function holdRecord(a, index = 0) {
  const row = a.el('wall-list').children[index];
  row.dispatch('pointerdown');
  const hold = [...a.timers.values()].find(timer => timer.ms === 520);
  assert.ok(hold);
  hold.f();
}

test('legacy resumed snapshot appends without losing a newer forest record', () => {
  const a = app([record('1', '原记录')]);
  a.store.set(LS, JSON.stringify([record('1', '原记录'), record('2', '森林新增')]));
  a.el('input-text').value = '旧版继续记录';
  a.click('btn-save');
  assert.deepEqual(a.read().map(r => r.text), ['原记录', '森林新增', '旧版继续记录']);
});

test('legacy single deletion preserves records added since this page was loaded', () => {
  const a = app([record('1', '待删除')]);
  a.store.set(LS, JSON.stringify([record('1', '待删除'), record('2', '森林新增')]));
  holdRecord(a);
  assert.deepEqual(a.read().map(r => r.text), ['森林新增']);
});

test('legacy clear today applies to latest records and preserves newer previous-day records', () => {
  const a = app([record('1', '今天')]);
  a.store.set(LS, JSON.stringify([record('1', '今天'), record('2', '另一页今天'), record('3', '另一页昨天', null, 1)]));
  a.click('btn-clear-today');
  assert.deepEqual(a.read().map(r => r.text), ['另一页昨天']);
});

for (const button of ['btn-wall-clear', 'btn-clear-all']) {
  test('legacy ' + button + ' clears latest records even when its initial snapshot was empty', () => {
    const a = app();
    a.store.set(LS, JSON.stringify([record('1', '刚刚从新版写入')]));
    a.click(button);
    assert.deepEqual(a.read(), []);
  });
}

for (const event of ['pageshow', 'storage', 'focus']) {
  test('legacy ' + event + ' synchronizes the list without clearing the draft or mood', () => {
    const a = app();
    a.el('input-text').value = '还没封存的正文';
    a.moodButtons[1].dispatch('click');
    a.store.set(LS, JSON.stringify([record('1', '森林新增')]));
    a.event(event, event === 'pageshow' ? {persisted:true} : {key:LS});
    assert.equal(a.el('stat-happy').textContent, '1');
    assert.equal(a.el('wall-list').children.length, 1);
    assert.equal(a.el('input-text').value, '还没封存的正文');
    assert.equal(a.moodButtons[1].classList.contains('active'), true);
  });
}

for (const mutation of ['save', 'delete', 'today', 'wall', 'all']) {
  test('legacy ' + mutation + ' does not replace malformed persisted data', () => {
    const a = app([record('1')]);
    a.store.set(LS, '{broken json');
    a.el('input-text').value = '保留草稿';
    assert.doesNotThrow(() => {
      if (mutation === 'delete') holdRecord(a);
      else a.click({save:'btn-save',today:'btn-clear-today',wall:'btn-wall-clear',all:'btn-clear-all'}[mutation]);
    });
    assert.equal(a.store.get(LS), '{broken json');
    assert.equal(a.el('input-text').value, '保留草稿');
    assert.match(a.document.querySelector('#__toast').textContent, /读取/);
  });
}

test('legacy blocked reads cannot turn a previous snapshot into a new write', () => {
  const a = app([record('1')]);
  a.failRead(true);
  a.el('input-text').value = '保留草稿';
  assert.doesNotThrow(() => a.click('btn-save'));
  assert.equal(a.read().length, 1);
  assert.equal(a.el('input-text').value, '保留草稿');
});

test('legacy failed save keeps draft and does not leak its failed record into a later save', () => {
  const a = app([record('1')]);
  a.failWrite(true);
  a.el('input-text').value = '失败草稿';
  assert.doesNotThrow(() => a.click('btn-save'));
  assert.equal(a.el('input-text').value, '失败草稿');
  assert.equal(a.read().length, 1);
  a.failWrite(false);
  a.el('input-text').value = '成功记录';
  a.click('btn-save');
  assert.deepEqual(a.read().map(r => r.text), ['旧版 #生活', '成功记录']);
});

for (const mutation of ['delete', 'today', 'wall', 'all']) {
  test('legacy failed ' + mutation + ' leaves persisted and rendered records intact', () => {
    const a = app([record('1')]);
    a.failWrite(true);
    assert.doesNotThrow(() => {
      if (mutation === 'delete') holdRecord(a);
      else a.click({today:'btn-clear-today',wall:'btn-wall-clear',all:'btn-clear-all'}[mutation]);
    });
    assert.equal(a.read().length, 1);
    assert.equal(a.el('stat-happy').textContent, '1');
    assert.match(a.document.querySelector('#__toast').textContent, /失败/);
  });
}

test('legacy startup tolerates inaccessible nickname and record storage', () => {
  const a = app([], {failRead:true});
  assert.match(a.el('home-greeting').textContent, /夏央/);
  a.el('input-text').value = '保留草稿';
  assert.doesNotThrow(() => a.click('btn-save'));
  assert.equal(a.el('input-text').value, '保留草稿');
});

test('legacy failed nickname blur save keeps stored nickname and entered value', () => {
  const a = app();
  a.failWrite(true);
  a.el('nickname-input').value = '未保存昵称';
  assert.doesNotThrow(() => a.el('nickname-input').dispatch('blur'));
  assert.equal(a.store.get(NICK), '原昵称');
  assert.equal(a.el('nickname-input').value, '未保存昵称');
  assert.match(a.document.querySelector('#__toast').textContent, /失败/);
});

test('settings fields save on blur without action buttons', () => {
  const a = app();
  a.el('nickname-input').value = '森林昵称';
  a.el('nickname-input').dispatch('blur');
  assert.equal(a.store.get(NICK), '森林昵称');
  a.el('energy-input').value = '今天也有值得记下的一刻。';
  a.el('energy-input').dispatch('blur');
  assert.equal(a.store.get(ENERGY), '今天也有值得记下的一刻。');
});

test('legacy lifecycle nickname sync preserves an unsubmitted nickname edit', () => {
  const a = app();
  a.el('nickname-input').value = '正在编辑';
  a.store.set(NICK, '森林昵称');
  a.event('storage', {key:NICK});
  assert.match(a.el('home-greeting').textContent, /森林昵称/);
  assert.equal(a.el('nickname-input').value, '正在编辑');
});

test('composition Enter is ignored and normal Enter stays in the draft', () => {
  const a = app();
  a.el('input-text').value = '输入法候选';
  a.el('input-text').dispatch('keydown', {key:'Enter',isComposing:true});
  assert.equal(a.read().length, 0);
  a.el('input-text').dispatch('compositionstart');
  a.el('input-text').dispatch('keydown', {key:'Enter'});
  assert.equal(a.read().length, 0);
  a.el('input-text').dispatch('compositionend');
  a.el('input-text').dispatch('keydown', {key:'Enter',shiftKey:true});
  assert.equal(a.read().length, 0);
  a.el('input-text').dispatch('keydown', {key:'Enter'});
  assert.equal(a.read().length, 0);
  assert.equal(a.el('input-text').value, '输入法候选');
});

test('legacy export with no clipboard shows selectable latest records', () => {
  const a = app([record('1')], {context:{navigator:{}}});
  a.store.set(LS, JSON.stringify([record('1'), record('2', '森林新增')]));
  a.click('btn-export');
  assert.equal(a.prompts.length, 1);
  assert.match(a.prompts[0].text, /森林新增/);
});
