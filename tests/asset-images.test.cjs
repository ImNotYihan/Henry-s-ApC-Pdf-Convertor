const {test}=require('node:test');const assert=require('node:assert/strict');
const {createStore}=require('../asset-images.js');
const url='https://assets.learnosity.com/organisations/1/figure.svg';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12"><rect width="24" height="12" fill="blue"/></svg>';
function fixture(options={}) {
  const objects=new Map(),released=[],draws=[];let count=0,seenType;
  const store=createStore({
    fetch:async(u,init)=>{count++;assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');return {ok:options.ok!==false,status:options.status||200,blob:async()=>new Blob([options.body??svg],{type:options.type??'image/svg+xml'})};},
    makeImage:()=>({naturalWidth:options.width??24,naturalHeight:options.height??12,set src(value){if(!value)return;seenType=objects.get(value).type;queueMicrotask(()=>options.invalid?this.onerror?.():this.onload?.());}}),
    makeCanvas:()=>({getContext:()=>({drawImage:image=>draws.push(image)}),toDataURL:()=>options.encoded??'data:image/png;base64,AAAA'}),
    createURL:blob=>{const id='blob:test/'+objects.size;objects.set(id,blob);return id;},revokeURL:id=>released.push(id)
  });
  return {store,released,draws,count:()=>count,type:()=>seenType};
}
test('converts SVG using an image element, without relying on the raster-only ImageBitmap decoder',async()=>{
  const f=fixture();assert.equal(await f.store.load(url),'data:image/png;base64,AAAA');assert.equal(f.type(),'image/svg+xml');assert.equal(f.draws.length,1);assert.equal(f.released.length,1);
});
test('detects SVG payloads with XML headers even when the MIME label and filename are misleading',async()=>{
  const f=fixture({type:'application/octet-stream',body:'<?xml version="1.0"?>\n<!-- exported chart -->\n'+svg});
  await f.store.load(url.replace('.svg','.jpg'));assert.equal(f.type(),'image/svg+xml');
});
test('uses the same path for raster figures and caches repeated figures',async()=>{
  const f=fixture({type:'image/png',body:'raster fixture'});await Promise.all([f.store.load(url),f.store.load(url)]);
  assert.equal(f.count(),1);assert.equal(f.type(),'image/png');assert.equal(f.draws.length,1);
});
test('does not mistake an SVG string inside raster metadata for the image format',async()=>{
  const f=fixture({type:'image/jpeg',body:'JPEG metadata contains <svg width="2"> as descriptive text'});await f.store.load(url);assert.equal(f.type(),'image/jpeg');
});
test('evicts failed decoding attempts and releases the temporary object URL',async()=>{
  const f=fixture({invalid:true});await assert.rejects(f.store.load(url),/not a supported or valid image/);await assert.rejects(f.store.load(url),/not a supported or valid image/);
  assert.equal(f.count(),2);assert.equal(f.released.length,2);
});
test('keeps invalid, empty and oversized figures from silently producing a blank PDF',async()=>{
  for(const [options,message] of [[{body:''},/empty/],[{width:0},/no usable dimensions/],[{width:10000,height:10000},/too large/],[{encoded:'data:,'},/could not be encoded/]]){
    const f=fixture(options);await assert.rejects(f.store.load(url),message);
  }
});
test('rejects HTTP errors and unapproved image origins',async()=>{
  const f=fixture({ok:false,status:403});await assert.rejects(f.store.load(url),/403/);
  for(const other of ['http://assets.learnosity.com/a.svg','https://assets.learnosity.com.evil.test/a.svg','https://user:password@assets.learnosity.com/a.svg','https://assets.learnosity.com:444/a.svg'])await assert.rejects(f.store.load(other),/host is not supported/);
  assert.equal(f.count(),1);
});
test('retains already embedded PNGs without downloading them again',async()=>{
  const f=fixture();assert.equal(await f.store.load('data:image/png;base64,AAAA'),'data:image/png;base64,AAAA');assert.equal(f.count(),0);
});
