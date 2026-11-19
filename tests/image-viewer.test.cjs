const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function fixture(load=async id=>({id})){
 const nodes=new Map(),revoked=[];let active=null;
 const document={getElementById:id=>nodes.get(id),get activeElement(){return active;},listeners:{},addEventListener(k,f){(this.listeners[k]??=[]).push(f);},querySelector(){return null;}};
 class Node{
  constructor(id){this.id=id;this.listeners={};this.style={};this.attrs={};this.hidden=false;this.disabled=false;this.isConnected=true;this.clientWidth=400;this.clientHeight=600;this.naturalWidth=1200;this.naturalHeight=800;this.classList={add(){},remove(){},toggle(){}};}
  addEventListener(k,f){(this.listeners[k]??=[]).push(f);}setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}removeAttribute(k){delete this.attrs[k];}
  focus(){active=this;}showModal(){this.open=true;}close(){this.open=false;this.dispatch('close');}setPointerCapture(){}getBoundingClientRect(){return{left:0,top:0,width:400,height:600};}
  dispatch(k,opts={}){const e={target:this,preventDefault(){},stopPropagation(){},...opts};for(const f of this.listeners[k]||[])f(e);}
 }
 for(const id of ['image-viewer','image-stage','image-full','image-close','image-prev','image-next','image-zoom','image-count','image-status'])nodes.set(id,new Node(id));
 const context={document,window:{addEventListener(){}},URL:{createObjectURL:b=>'blob:'+b.id,revokeObjectURL:u=>revoked.push(u)},console};
 const source=fs.readFileSync(path.join(__dirname,'../image-viewer.js'),'utf8');vm.runInNewContext(source,context);
 const viewer=context.SmallWinsImageViewer.create({load,document});
 return{viewer,el:id=>nodes.get(id),document,revoked,key:key=>(document.listeners.keydown||[]).forEach(f=>f({key,preventDefault(){},stopPropagation(){}}))};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('opens the selected original media and closes back to its thumbnail',async()=>{
 const seen=[];const f=fixture(async id=>{seen.push(id);return{id};});const opener={isConnected:true,focus(){this.focused=true;}};
 await f.viewer.open(['first','second'],1,opener);f.el('image-full').dispatch('load');
 assert.ok(Math.abs(parseFloat(f.el('image-full').style.width)/parseFloat(f.el('image-full').style.height)-1.5)<.001);
 assert.deepEqual(seen,['second']);assert.equal(f.el('image-full').src,'blob:second');assert.equal(f.el('image-count').textContent,'2 / 2');assert.equal(f.viewer.isOpen(),true);
 f.el('image-close').dispatch('click');assert.equal(f.viewer.isOpen(),false);assert.equal(opener.focused,true);assert.deepEqual(f.revoked,['blob:second']);
});

test('gallery navigation stays within one record and resets zoom',async()=>{
 const f=fixture();await f.viewer.open(['first','second'],0);f.el('image-full').dispatch('load');f.el('image-zoom').dispatch('click');assert.match(f.el('image-full').style.transform,/scale\(2\)/);
 f.key('ArrowRight');await tick();f.el('image-full').dispatch('load');assert.equal(f.el('image-full').src,'blob:second');assert.match(f.el('image-full').style.transform,/scale\(1\)/);assert.equal(f.el('image-next').disabled,true);
 f.key('ArrowRight');await tick();assert.equal(f.el('image-full').src,'blob:second');
});

test('a late load from a closed record cannot replace the newly opened image',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve);const f=fixture(async id=>{if(id==='slow')await gate;return{id};});
 const old=f.viewer.open(['slow'],0);f.viewer.close();await f.viewer.open(['fresh'],0);release();await old;
 assert.equal(f.el('image-full').src,'blob:fresh');
});

test('pinch zoom is bounded and a remaining finger can keep panning',async()=>{
 const f=fixture();await f.viewer.open(['photo'],0);f.el('image-full').dispatch('load');const stage=f.el('image-stage');
 stage.dispatch('pointerdown',{pointerId:1,clientX:150,clientY:300});stage.dispatch('pointerdown',{pointerId:2,clientX:250,clientY:300});
 stage.dispatch('pointermove',{pointerId:2,clientX:1200,clientY:300});assert.match(f.el('image-full').style.transform,/scale\(4\)/);
 stage.dispatch('pointerup',{pointerId:2,clientX:1200,clientY:300});stage.dispatch('pointermove',{pointerId:1,clientX:-5000,clientY:300});
 assert.match(f.el('image-full').style.transform,/translate3d\(-600px,/);
 stage.dispatch('pointercancel',{pointerId:1});f.viewer.close();assert.equal(f.viewer.isOpen(),false);
});

test('an unavailable image shows an error while the rest of its gallery remains usable',async()=>{
 const f=fixture(async id=>id==='missing'?null:{id});await f.viewer.open(['missing','good'],0);assert.equal(f.el('image-status').textContent,'图片暂时无法读取');
 f.key('ArrowRight');await tick();assert.equal(f.el('image-full').src,'blob:good');
});

test('touch double-tap zooms and an unzoomed horizontal swipe changes the picture',async()=>{
 const f=fixture();await f.viewer.open(['first','second'],0);f.el('image-full').dispatch('load');const stage=f.el('image-stage');
 for(let i=0;i<2;i++){stage.dispatch('pointerdown',{pointerId:1,clientX:200,clientY:300,pointerType:'touch'});stage.dispatch('pointerup',{pointerId:1,clientX:200,clientY:300,pointerType:'touch'});}
 assert.match(f.el('image-full').style.transform,/scale\(2\)/);f.el('image-zoom').dispatch('click');
 stage.dispatch('pointerdown',{pointerId:1,clientX:300,clientY:300,pointerType:'touch'});stage.dispatch('pointermove',{pointerId:1,clientX:50,clientY:300,pointerType:'touch'});stage.dispatch('pointerup',{pointerId:1,clientX:50,clientY:300,pointerType:'touch'});await tick();
 assert.equal(f.el('image-full').src,'blob:second');
});
