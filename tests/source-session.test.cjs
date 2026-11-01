const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const {parseHTML}=require('linkedom');
const core=require('../core.js');const SourceSession=require('../source-session.js');
const base='https://apclassroom.collegeboard.org/33/assessments/results/123/performance';
const first=base+'/456',second=base+'/789';
const rows=()=>`<h1 id="mainHeading">Practice</h1><table><tbody>${[[456,1,'FT456','0/1'],[789,2,'FT789','1/1']].map(([id,n,ref,score])=>`<tr><th><span title="question-item-${id}">Q${n}</span><a href="${base}/${id}" data-reference="${ref}">Question ${n}</a></th><td>1.7</td><td>3.B</td><td>01:00</td><td>${score}</td></tr>`).join('')}</tbody></table>`;
const item=ref=>`<div class="learnosity-item" data-reference="${ref}"><div class="lrn_widget lrn_qr"><div class="lrn_stimulus_content"><p>Practice question ${ref}</p></div><li class="lrn-mcq-option lrn_selected"><div class="lrn_contentWrapper">Option A</div></li><li class="lrn-mcq-option lrn_valid"><div class="lrn_contentWrapper">Option B</div></li></div></div>`;
function browserFixture(start=base,options={}) {
  const {window,document}=parseHTML('<html><body></body></html>');
  const location={href:start};const calls=[],routes=[],scrolls=[];let closed=false,clock=0;
  window.scrollX=0;window.scrollY=320;window.scrollTo=(x,y)=>scrolls.push([x,y]);
  const context=vm.createContext({window,document,location,URL,requestAnimationFrame:fn=>fn()});
  function render(url) {
    location.href=url;
    document.body.innerHTML=url===base?rows():`<a href="${base}">Results Overview</a>`+(options.empty?'':item('FT456')+item('FT789'));
    for(const a of document.querySelectorAll('a'))a.addEventListener('click',event=>{
      event.preventDefault();routes.push(a.href);render(a.href);
    });
  }
  render(start);
  const forbidden=name=>async()=>{throw new Error('Forbidden tab operation: '+name);};
  const api={tabs:{
    get:async id=>{assert.equal(id,42);if(closed)throw new Error('No tab');return {id,url:location.href,status:'complete'};},
    create:forbidden('create'),remove:forbidden('remove'),update:forbidden('update'),reload:forbidden('reload')
  },scripting:{executeScript:async input=>{
    assert.equal(input.target.tabId,42);calls.push(input);
    if(input.files) {for(const file of input.files)vm.runInContext(fs.readFileSync(path.resolve(__dirname,'..',file),'utf8'),context);return [];}
    context.args=input.args;return [{result:vm.runInContext('('+input.func.toString()+')(...args)',context)}];
  }}};
  const session=new SourceSession(api,core,{now:()=>clock,sleep:async ms=>{clock+=ms;}});
  return {session,context,api,calls,routes,scrolls,location,close:()=>closed=true};
}
test('reads the existing signed-in tab and returns to its overview without creating or reloading any tab',async()=>{
  const f=browserFixture();await f.session.open(42);const overview=await f.session.getOverview();
  assert.equal(overview.questions.length,2);await f.session.openQuestion(first);
  assert.equal((await f.session.call('extract',[overview.questions[0]])).reference,'FT456');
  // The second question is already in this document; no per-question navigation.
  assert.equal((await f.session.call('extract',[overview.questions[1]])).reference,'FT789');
  assert.deepEqual(f.routes,[first]);assert.equal(await f.session.restore(),'');
  assert.equal(f.location.href,base);assert.deepEqual(f.scrolls,[[0,320]]);assert.deepEqual(f.routes,[first,base]);
});
test('starting on Question Details uses its existing breadcrumb and restores that same question',async()=>{
  const f=browserFixture(second);await f.session.open(42);const overview=await f.session.getOverview();
  assert.equal(overview.questions.length,2);await f.session.openQuestion(first);await f.session.restore();
  assert.equal(f.location.href,second);assert.deepEqual(f.routes,[base,first,base,second]);
});
test('cancelled reading restores the source page and keeps it open',async()=>{
  const f=browserFixture();await f.session.open(42);await f.session.openQuestion(first);f.session.cancel();
  await assert.rejects(f.session.waitFor(()=>null,'timeout'),/Reading cancelled/);
  assert.equal(await f.session.restore(),'');assert.equal(f.location.href,base);await f.api.tabs.get(42);
});
test('leaves a source tab alone if the user has moved to another assignment',async()=>{
  const f=browserFixture();await f.session.open(42);f.location.href=base.replace('/123/','/999/');
  await assert.rejects(f.session.call('overview'),/moved away/);
  assert.match(await f.session.restore(),/kept open/);assert.deepEqual(f.routes,[]);
});
test('does not reopen a source tab that the user closed',async()=>{
  const f=browserFixture();await f.session.open(42);f.close();
  await assert.rejects(f.session.call('overview'),/was closed/);assert.match(await f.session.restore(),/kept open/);
});
test('a missing question link fails safely without a direct URL load or a new sign-in page',async()=>{
  const f=browserFixture();await f.session.open(42);
  await assert.rejects(f.session.openQuestion(base+'/missing'),/not available/);assert.equal(f.location.href,base);assert.deepEqual(f.routes,[]);
});
test('a plain anchor without the AP Classroom router cannot cause a native document reload',async()=>{
  const f=browserFixture();await f.session.open(42);
  f.context.document.body.innerHTML=`<a href="${first}">Question 1</a>`;
  assert.equal(await f.session.call('navigate',[first]),false);assert.equal(f.location.href,base);
});
test('the source read times out rather than launching a replacement tab',async()=>{
  const f=browserFixture(base,{empty:true});await f.session.open(42);await f.session.openQuestion(first);
  await assert.rejects(f.session.waitFor(()=>f.session.call('extract',[{number:1,reference:'FT456'}]),'Question did not load',500),/Question did not load/);
  await f.session.restore();assert.equal(f.location.href,base);
});
test('the packaged review uses a same-tab session and has no tab-closing background worker',()=>{
  const review=fs.readFileSync(path.resolve(__dirname,'../review.js'),'utf8');const session=fs.readFileSync(path.resolve(__dirname,'../source-session.js'),'utf8');
  assert.ok(!/tabs\.(create|remove|reload)\s*\(/.test(review+session));
  assert.ok(!/tabs\.update\([^)]*\{\s*url/.test(review+session));
  const manifest=require('../manifest.json');assert.ok(!manifest.background);assert.ok(!manifest.permissions.includes('storage'));
  const html=fs.readFileSync(path.resolve(__dirname,'../review.html'),'utf8');assert.ok(html.indexOf('source-session.js')<html.indexOf('src="review.js"'));
});
