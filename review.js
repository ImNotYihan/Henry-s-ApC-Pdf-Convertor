'use strict';
const $ = selector => document.querySelector(selector);
const core = APReviewCore;
let assignment = null, readerId = null, expectedBase = null, running = false, cancelled = false, exporting = false, pdfUrl = null;
const assetCache = new Map();
const sourceId = Number(new URL(location.href).searchParams.get('source'));
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
function progress(message, value) { $('#progress-text').textContent=message;$('#progress').value=value; }
function checkCancel() { if(cancelled) throw new Error('Reading cancelled. No PDF was generated.'); }
async function callReader(method, args=[]) {
  const [result] = await chrome.scripting.executeScript({target:{tabId:readerId},func:(method,args,expected)=>{
    if (!globalThis.APReviewReader) return null;
    if (globalThis.APReviewCore.assignmentUrl(location.href) !== expected) throw new Error('The reading tab moved to a different assignment. Please start again.');
    return globalThis.APReviewReader[method](...args);
  },args:[method,args,expectedBase]});
  return result?.result;
}
async function inject() {
  await chrome.scripting.executeScript({target:{tabId:readerId},files:['core.js','reader.js']});
}
async function waitFor(read, message, timeout=45000) {
  const end=Date.now()+timeout;
  let lastError;
  while(Date.now()<end) {
    checkCancel();
    try {
      const tab=await chrome.tabs.get(readerId);
      if (tab.url && !tab.url.startsWith(core.ORIGIN+'/')) throw new Error('Your AP Classroom session needs attention. Sign in on the source tab, then try again.');
      if (tab.status === 'complete') {
        await inject();
        const value=await read();
        if(value) return value;
      }
    } catch(e) {
      lastError=e;
      if (/No tab|session needs attention/i.test(e.message)) throw e;
    }
    await delay(500);
  }
  throw new Error(message + (lastError ? '\n'+lastError.message : ''));
}
async function navigate(url) {
  checkCancel();
  let clicked=false;
  try { clicked=await callReader('navigate',[url]); } catch { /* A page navigation may destroy the old script. */ }
  if(!clicked) await chrome.tabs.update(readerId,{url});
}
async function closeReader() {
  if(readerId != null) {
    const id=readerId;readerId=null;
    await chrome.tabs.remove(id).catch(()=>{});
    await chrome.runtime.sendMessage({type:'release-reader'}).catch(()=>{});
  }
}
async function fetchImage(src) {
  if(/^data:image\/(png|jpeg|gif|webp);base64,/i.test(src)) return src;
  const url=new URL(src,core.ORIGIN);
  if(url.protocol!=='https:' || url.hostname!=='assets.learnosity.com') throw new Error('This image host is not supported: '+url.hostname);
  if(!assetCache.has(url.href)) {
    const pending=(async()=>{
      const response=await fetch(url.href,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
      if(!response.ok) throw new Error('Image download failed ('+response.status+').');
      const blob=await response.blob();
      if(blob.size>15*1024*1024) throw new Error('An image is too large to embed.');
      // Decode and re-encode to PNG. This also safely supports original SVG figures
      // without allowing active SVG markup into the extension.
      const bitmap=await createImageBitmap(blob);
      if(bitmap.width*bitmap.height>25000000) {bitmap.close();throw new Error('An image is too large to render.');}
      const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
      canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();
      return canvas.toDataURL('image/png');
    })();
    assetCache.set(url.href,pending);
    pending.catch(()=>assetCache.delete(url.href));
  }
  return assetCache.get(url.href);
}
async function freezeHTML(value) {
  const t=document.createElement('template');t.innerHTML=value;
  for(const img of t.content.querySelectorAll('img')) {
    checkCancel();
    img.setAttribute('src',await fetchImage(img.getAttribute('src')||''));
    img.removeAttribute('srcset');
  }
  return core.cleanHTML(t.innerHTML);
}
async function freezeQuestion(q) {
  q.shared=await freezeHTML(q.shared);
  for(const part of q.parts) {
    part.stem=await freezeHTML(part.stem);
    part.response=await freezeHTML(part.response);
    for(const option of part.options) option.html=await freezeHTML(option.html);
  }
  return q;
}
async function startRead() {
  if(running||exporting) return;
  running=true;cancelled=false;assignment=null;$('#confirm').checked=false;
  $('#preview').hidden=true;$('#error-panel').hidden=true;$('#loading').hidden=false;
  $('#step-read').setAttribute('aria-current','step');$('#step-check').removeAttribute('aria-current');$('#step-save').removeAttribute('aria-current');
  try {
    progress('Opening a temporary reading tab…',2);
    const source=await chrome.tabs.get(sourceId);
    const base=core.assignmentUrl(source.url);
    if(!base) throw new Error('The source tab is no longer a completed AP Classroom assignment. Open the extension from Results Overview again.');
    expectedBase=base;
    const owner=await chrome.tabs.getCurrent();
    const reader=await chrome.tabs.create({url:base,active:false,openerTabId:owner.id});readerId=reader.id;
    const owned=await chrome.runtime.sendMessage({type:'own-reader',readerId});
    if(!owned?.ok) throw new Error(owned?.error||'Could not create a reading session.');
    let overview=await waitFor(async()=>{
      const result=await callReader('overview');
      return result?.questions?.length ? result : null;
    },'The question table did not load. Make sure the Questions tab is available and your teacher has released the results.');
    // A result table may populate over multiple render frames.
    await delay(500);
    const stable=await callReader('overview');if(stable?.questions?.length>=overview.questions.length)overview=stable;
    if(overview.questions.some(q=>!q.reference)) progress('Reading questions individually…',8);
    else progress(`Found ${overview.questions.length} questions. Loading their contents…`,8);
    assignment={...overview,readAt:new Date().toISOString(),questions:[]};
    await navigate(overview.questions[0].url);
    for(let i=0;i<overview.questions.length;i++) {
      checkCancel();const record=overview.questions[i];
      progress(`Reading question ${record.number} · ${i+1} of ${overview.questions.length}`,10+(i/overview.questions.length)*78);
      let q=null;
      try {await inject();q=await callReader('extract',[record]);} catch { /* The initial detail page may still be loading. */ }
      if(!q) {
        if(i>0) await navigate(record.url);
        q=await waitFor(()=>callReader('extract',[record]),`Question ${record.number} did not load. Nothing will be exported until every question is read.`);
      }
      try { await freezeQuestion(q); } catch(e) {throw new Error(`Question ${record.number}: a figure could not be embedded.\n${e.message}\nTry reading again when the connection is stable.`);}
      assignment.questions.push(q);
    }
    if(assignment.questions.length!==overview.questions.length) throw new Error('The question count changed during reading. Please try again.');
    progress('Preparing the preview…',96);
    await renderPreview();progress('Ready',100);
    $('#loading').hidden=true;$('#preview').hidden=false;
    $('#step-read').removeAttribute('aria-current');$('#step-read').classList.add('done');$('#step-check').setAttribute('aria-current','step');
  } catch(e) {
    assignment=null;$('#loading').hidden=true;$('#error-panel').hidden=false;
    $('#error-message').textContent=e.message || String(e);
  } finally {await closeReader();running=false;}
}
function contentHTML(q, answers=true) {
  let html=q.shared||'';
  q.parts.forEach(part=>{
    html+='<div class="part">'+part.stem;
    for(const option of part.options) {
      const cls=answers?`${option.selected?' selected':''}${option.correct?' answer':''}`:'';
      const tags=answers?[option.selected?'Your answer':'',option.correct?'Correct answer':''].filter(Boolean).join(' · '):'';
      html+=`<div class="option${cls}"><span class="option-label">${core.escape(option.label)}</span><div class="option-body">${option.html}${tags?`<div class="option-tags">${tags}</div>`:''}</div></div>`;
    }
    if(answers&&part.response)html+='<div class="answer-note">Your response</div>'+part.response;
    if(answers&&part.options.length&&!part.options.some(o=>o.correct))html+='<p class="answer-note">Correct answer not revealed by AP Classroom.</p>';
    html+='</div>';
  });
  return html;
}
async function renderMath(root) {
  if(!root.querySelector('math')) return;
  await MathJax.startup.promise;
  for(const math of [...root.querySelectorAll('math')]) {
    const rendered=await MathJax.mathml2svgPromise(math.outerHTML,{display:math.getAttribute('display')==='block'});
    const svg=rendered.querySelector('svg');
    if(!svg) throw new Error('A formula could not be rendered.');
    const view=svg.getAttribute('viewBox')?.split(/\s+/).map(Number);
    const ex=7.6;
    const width=Number.parseFloat(svg.getAttribute('width'))*ex;
    const height=Number.parseFloat(svg.getAttribute('height'))*ex;
    svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
    svg.setAttribute('width',String(width||view?.[2]/100||30));svg.setAttribute('height',String(height||view?.[3]/100||20));
    svg.setAttribute('color','#202d3b');svg.style.color='#202d3b';
    const image=new Image();image.className='math-image';image.alt=math.getAttribute('alttext')||math.textContent;
    image.style.width=svg.getAttribute('width')+'px';image.style.height=svg.getAttribute('height')+'px';
    image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));
    await image.decode();math.replaceWith(image);
  }
}
function counts() {
  const groups=core.groups(assignment.questions);
  $('#total-count').textContent=assignment.questions.length;$('#missed-count').textContent=groups.missed.length;$('#correct-count').textContent=groups.correct.length;
  $('#read-warning').hidden=!groups.unknown.length;
  $('#read-warning').textContent=`${groups.unknown.length} question(s) have no score. Choose a result for each before generating your PDF.`;
  $('#export').disabled=!$('#confirm').checked||groups.unknown.length>0||exporting;
  $('#export-status').textContent=groups.unknown.length?'Classify all unscored questions to continue.':$('#confirm').checked?'Ready to create your review PDF.':'Confirm the preview to continue.';
}
async function renderPreview() {
  $('#assignment-title').textContent=assignment.title;
  $('#assignment-meta').textContent=`${assignment.questions.length} questions · ${assignment.totalScore||'Results from AP Classroom'} · Read ${new Date(assignment.readAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}`;
  const list=$('#question-list');list.replaceChildren();
  const grouped=core.groups(assignment.questions);
  for(const [label,questions] of [['01 · Missed questions',grouped.missed],['02 · Correct questions',grouped.correct],['Needs a result',grouped.unknown]]) {
    if(!questions.length)continue;
    const heading=document.createElement('div');heading.className='group-heading';heading.textContent=label;list.append(heading);
    for(const q of questions) {
      const row=document.createElement('details');row.className='question-row';row.dataset.id=q.id;
      row.innerHTML=`<summary><span class="q-number">Q${q.number}</span><span class="q-title">${core.escape(q.title)}</span><span class="pill ${q.status}">${core.STATUS[q.status]}</span><span class="chevron" aria-hidden="true">›</span></summary><div class="question-detail"><p class="q-meta">${core.escape([q.scoreText?`Score: ${q.scoreText}`:'',q.topic?`Topic ${q.topic}`:'',q.skills?`Skill ${q.skills}`:''].filter(Boolean).join(' · '))}</p><div class="question-content">${contentHTML(q)}</div>${q.warnings.map(w=>`<p class="warning">${core.escape(w)}</p>`).join('')}<div class="result-editor"><label for="result-${q.id}">Result in this PDF</label><select id="result-${q.id}" aria-label="Result for question ${q.number}">${Object.entries(core.STATUS).map(([value,label])=>`<option value="${value}"${q.status===value?' selected':''}>${label}</option>`).join('')}</select></div><a class="source-link" target="_blank" rel="noopener noreferrer" href="${core.escape(q.url)}">View original question ↗</a></div>`;
      row.querySelector('select').addEventListener('change',e=>{
        q.status=e.target.value;row.querySelector('.pill').className='pill '+q.status;row.querySelector('.pill').textContent=core.STATUS[q.status];
        $('#confirm').checked=false;invalidatePdf();counts();
        // Group order is recalculated for the PDF; preserve the open question while editing.
        $('#read-warning').hidden=false;$('#read-warning').textContent='A result was updated. Questions will be regrouped in the PDF. Confirm the preview again.';
      });
      list.append(row);
    }
  }
  await renderMath(list);
  counts();
}
function invalidatePdf(){if(pdfUrl){URL.revokeObjectURL(pdfUrl);pdfUrl=null;}$('#download-again').hidden=true;}
$('#confirm').addEventListener('change',()=>assignment&&counts());
$('#show-answers').addEventListener('change',()=>{invalidatePdf();});
$('#cancel').addEventListener('click',()=>{cancelled=true;closeReader();});
$('#retry').addEventListener('click',startRead);$('#reread').addEventListener('click',()=>{invalidatePdf();startRead();});
$('#open-source').addEventListener('click',()=>chrome.tabs.update(sourceId,{active:true}).catch(()=>{}));
$('#expand').addEventListener('click',()=>{const open=$('#expand').textContent==='Expand all';document.querySelectorAll('.question-row').forEach(e=>e.open=open);$('#expand').textContent=open?'Collapse all':'Expand all';});
$('#export').addEventListener('click',async()=>{
  if(!assignment||exporting||!$('#confirm').checked||core.groups(assignment.questions).unknown.length)return;
  exporting=true;counts();$('#export-status').textContent='Preparing formulas and figures…';$('#show-answers').disabled=true;$('#reread').disabled=true;$('#confirm').disabled=true;
  document.querySelectorAll('.result-editor select').forEach(e=>e.disabled=true);
  try {
    invalidatePdf();
    const bytes=await APReviewPDF.generate(assignment,$('#show-answers').checked,message=>$('#export-status').textContent=message);
    pdfUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
    const name=core.filename(assignment.title);const link=$('#download-again');link.href=pdfUrl;link.download=name;link.hidden=false;
    await chrome.downloads.download({url:pdfUrl,filename:name,saveAs:true});
    $('#step-check').removeAttribute('aria-current');$('#step-check').classList.add('done');$('#step-save').setAttribute('aria-current','step');
    $('#export-status').textContent='PDF ready. Choose a location in the save dialog, or use the download link.';
  }catch(e){$('#export-status').textContent='Could not finish the PDF: '+e.message;}
  finally{exporting=false;$('#show-answers').disabled=false;$('#reread').disabled=false;$('#confirm').disabled=false;document.querySelectorAll('.result-editor select').forEach(e=>e.disabled=false);$('#export').disabled=!$('#confirm').checked;}
});
startRead();
