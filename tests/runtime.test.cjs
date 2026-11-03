const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const LS = 'smallwins_records_v1';
const NICK = 'smallwins_nickname_v1';
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
 const ids=['home-date','home-greeting','stat-streak','stat-happy','recent-list','recent-empty','input-text','tag-suggest','mood-group','btn-save','today-list','today-empty','btn-clear-today','wall-search','wall-list','wall-empty','btn-wall-clear','btn-wall-clear-input','random-text','random-time','random-mood','btn-random-next','btn-install','install-tip','nickname-input','nickname-preview','btn-save-nickname','btn-export','btn-clear-all','modal','modal-title','modal-body','modal-close','modal-delete','page-home','page-today','page-wall','page-random','page-settings'];
 for(const id of ids){const el=document.createElement(id.startsWith('btn-')||id.startsWith('modal-')&&['modal-close','modal-delete'].includes(id)?'button':id==='input-text'?'textarea':'div');el.id=id;elements.set(id,el);document.body.appendChild(el);}
 elements.get('recent-list').appendChild(elements.get('recent-empty'));
 for(const id of ['modal-title','modal-body','modal-close','modal-delete']){elements.get(id).remove();elements.get(id).isConnected=true;elements.get('modal').appendChild(elements.get(id));}
 const moodButtons=['calm','happy','relaxed','lazy'].map(m=>{const el=document.createElement('button');el.dataset.mood=m;el.className='mood-btn';elements.get('mood-group').appendChild(el);return el;});
 const tabs=['home','today','wall','random','settings'].map(p=>{const el=document.createElement('button');el.className='tabbar-btn';el.dataset.target='page-'+p;document.body.appendChild(el);return el;});
 document.querySelector=s=>s.startsWith('#')?(elements.get(s.slice(1))||document.body.querySelector(s)):document.body.querySelector(s);
 document.querySelectorAll=s=>s==='.topnav button, .tabbar-btn'?tabs:s==='#mood-group .mood-btn'?moodButtons:s==='[data-target]'?tabs:document.body.querySelectorAll(s);
 document.addEventListener=(k,f)=>(document.listeners[k]??=[]).push(f);
 const store=new Map([[LS,typeof initial==='string'?initial:JSON.stringify(initial)],[NICK,'原昵称']]);
 let failWrite=false,failRead=false;const localStorage={getItem(k){if(failRead)throw new Error('blocked');return store.get(k)??null;},setItem(k,v){if(failWrite)throw new Error('quota');store.set(k,String(v));}};
 const listeners={};const window={addEventListener:(k,f)=>(listeners[k]??=[]).push(f),scrollTo(){},PointerEvent:function(){}};
 const confirms=[],prompts=[],copied=[],timers=new Map(); let timerId=0;
 const context={document,window,localStorage,navigator:{clipboard:{writeText:async t=>copied.push(t)}},confirm:msg=>{confirms.push(msg);return extra.confirm??true;},prompt:(msg,text)=>{prompts.push({msg,text});},console,Date,Math,setTimeout:(f,ms)=>{timers.set(++timerId,{f,ms});return timerId;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:f=>f(),...extra.context};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8'),context,{filename:'main.js'});
 return{el:id=>elements.get(id),tabs,moodButtons,store,confirms,prompts,copied,document,context,timers,click:id=>elements.get(id).dispatch('click'),event:(k,e={})=>(listeners[k]||[]).forEach(f=>f(e)),failWrite:v=>failWrite=v,failRead:v=>failRead=v,read:()=>JSON.parse(store.get(LS))};
}

test('loads unchanged legacy schema and renders accessible record buttons with body before mood',()=>{const a=app([record('1')]);assert.equal(a.el('stat-happy').textContent,'1');const row=a.el('recent-list').children.find(x=>x.classList.contains('item'));assert.equal(row.tagName,'BUTTON');assert.match(row.textContent,/旧版 #生活.*平静/s);assert.equal(row.children[0].children[0].className,'item-text');});
test('saving preserves schema, optional mood and existing nickname',()=>{const a=app([record('1')]);a.el('input-text').value=' 新的一步 #工作 ';a.click('btn-save');const saved=a.read().find(r=>r.text==='新的一步 #工作');assert.ok(saved);assert.deepEqual(Object.keys(saved).sort(),['dateKey','id','mood','text','timeText','ts']);assert.equal(saved.mood,null);assert.equal(a.store.get(NICK),'原昵称');assert.equal(a.el('input-text').value,'');});
test('failed write retains draft and does not poison next successful save',()=>{const a=app([record('1')]);a.el('input-text').value='未写入';a.failWrite(true);assert.doesNotThrow(()=>a.click('btn-save'));assert.equal(a.el('input-text').value,'未写入');assert.equal(a.read().length,1);a.failWrite(false);a.el('input-text').value='真正写入';a.click('btn-save');assert.deepEqual(a.read().map(r=>r.text),['旧版 #生活','真正写入']);});
test('malformed stored records remain untouched when trying to save',()=>{const a=app('{bad json');a.el('input-text').value='新记录';a.click('btn-save');assert.equal(a.store.get(LS),'{bad json');assert.equal(a.el('input-text').value,'新记录');});
test('a newer tab or legacy-page write is merged before saving',()=>{const a=app([record('1')]);a.store.set(LS,JSON.stringify([record('1'),record('2','另一个页面') ]));a.el('input-text').value='当前页面';a.click('btn-save');assert.deepEqual(a.read().map(r=>r.text),['旧版 #生活','另一个页面','当前页面']);});
test('storage event refreshes counters without erasing an unsaved draft',()=>{const a=app();a.el('input-text').value='草稿';a.store.set(LS,JSON.stringify([record('1')]));a.event('storage',{key:LS});assert.equal(a.el('stat-happy').textContent,'1');assert.equal(a.el('input-text').value,'草稿');});
test('IME Enter never saves; ordinary Enter still saves and Shift Enter stays multiline',()=>{const a=app();a.el('input-text').value='输入法候选';a.el('input-text').dispatch('keydown',{key:'Enter',isComposing:true});assert.equal(a.read().length,0);a.el('input-text').dispatch('keydown',{key:'Enter',shiftKey:true});assert.equal(a.read().length,0);a.el('input-text').dispatch('keydown',{key:'Enter'});assert.equal(a.read().length,1);});
test('clear today can be cancelled and does not alter yesterday',()=>{const a=app([record('1'),record('2','昨天',null,1)],{confirm:false});a.click('btn-clear-today');assert.equal(a.confirms.length,1);assert.equal(a.read().length,2);});
test('search only matches body, handles empty results, clear restores the list',()=>{const a=app([record('1','工作ABC','happy'),record('2','生活','calm')]);a.el('wall-search').value='abc';a.el('wall-search').dispatch('input');assert.equal(a.el('wall-list').children.length,1);a.el('wall-search').value='愉悦';a.el('wall-search').dispatch('input');assert.equal(a.el('wall-list').children.length,0);assert.equal(a.el('wall-empty').style.display,'');a.click('btn-wall-clear-input');assert.equal(a.el('wall-list').children.length,2);});
test('detail preserves full text and precise saved time; keyboard deletion confirms',()=>{const r=record('1','<b>全文</b>\n第二行');const a=app([r],{confirm:false});const row=a.el('wall-list').children[0];row.focus();row.dispatch('click');assert.equal(a.el('modal-title').textContent,r.timeText);assert.equal(a.el('modal-body').textContent,r.text);assert.equal(a.el('modal').getAttribute('aria-hidden'),'false');a.click('modal-delete');assert.equal(a.confirms.length,1);assert.equal(a.read().length,1);a.click('modal-close');assert.equal(a.el('modal').getAttribute('aria-hidden'),'true');assert.equal(a.document.activeElement,row);});
test('long press does not trigger a detail click after a cancelled delete',()=>{const a=app([record('1')],{confirm:false});const row=a.el('wall-list').children[0];row.dispatch('pointerdown',{pointerType:'touch',clientX:10,clientY:10});const hold=[...a.timers.values()].find(t=>t.ms===520);assert.ok(hold);hold.f();row.dispatch('pointerup');row.dispatch('click');assert.equal(a.confirms.length,1);assert.notEqual(a.el('modal').getAttribute('aria-hidden'),'false');});
test('fullwidth tag suggestions insert a historical tag into body',()=>{const a=app([record('1','旧事 ＃生活')]);a.el('input-text').value='今天 ＃生';a.el('input-text').selectionStart=5;a.el('input-text').dispatch('input');assert.equal(a.el('tag-suggest').children[0].textContent,'#生活');a.el('tag-suggest').children[0].dispatch('click');assert.equal(a.el('input-text').value,'今天 #生活 ');});
test('random review keeps body/time/mood separate and current selection across reentry',()=>{const r=record('1','读完一本书','calm');const a=app([r]);assert.equal(a.el('random-text').textContent,r.text);assert.equal(a.el('random-time').textContent,r.timeText);assert.equal(a.el('random-mood').textContent,'平静');a.tabs[3].dispatch('click');assert.equal(a.el('random-text').textContent,r.text);assert.equal(a.tabs[3].getAttribute('aria-current'),'page');});
test('export falls back to a selectable prompt when clipboard is absent',()=>{const a=app([record('1')],{context:{navigator:{}}});a.click('btn-export');assert.equal(a.prompts.length,1);assert.match(a.prompts[0].text,/旧版 #生活/);});
test('nickname quota failure keeps saved greeting and unsubmitted input',()=>{const a=app();a.el('nickname-input').value='新昵称';a.failWrite(true);assert.doesNotThrow(()=>a.click('btn-save-nickname'));assert.equal(a.store.get(NICK),'原昵称');assert.equal(a.el('nickname-input').value,'新昵称');assert.match(a.el('home-greeting').textContent,/原昵称/);});
