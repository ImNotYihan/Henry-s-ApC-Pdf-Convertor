const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const {parseHTML}=require('linkedom');
const core=require('../core.js');
test('only accepts completed assignment result routes on the exact AP Classroom origin',()=>{
  const expected='https://apclassroom.collegeboard.org/33/assessments/results/123/performance';
  assert.equal(core.assignmentUrl(expected+'/456'),expected);
  assert.equal(core.assignmentUrl('https://apclassroom.collegeboard.org/18/assessments/results/987/performance/654'),'https://apclassroom.collegeboard.org/18/assessments/results/987/performance');
  for(const url of ['https://apclassroom.collegeboard.org.evil.test/33/assessments/results/123/performance','http://apclassroom.collegeboard.org/33/assessments/results/123/performance','https://apclassroom.collegeboard.org/33/assignments','javascript:alert(1)'])assert.equal(core.assignmentUrl(url),null);
});
test('distinguishes full credit, partial credit, zero, and unknown scores',()=>{
  assert.equal(core.score('1 / 1').status,'correct');assert.equal(core.score('0/1 MC point').status,'incorrect');
  assert.equal(core.score('1.5 / 4').status,'partial');
  for(const input of ['Unscored','— / 1','0/0','4/3'])assert.equal(core.score(input).status,'unknown');
});
test('puts missed and partial-credit questions first, preserving original numbers',()=>{
  const {missed,correct,unknown}=core.groups([{number:25,status:'incorrect'},{number:1,status:'correct'},{number:18,status:'partial'},{number:4,status:'unknown'}]);
  assert.deepEqual(missed.map(q=>q.number),[18,25]);assert.deepEqual(correct.map(q=>q.number),[1]);assert.equal(unknown.length,1);
});
test('makes a safe download filename without losing the assignment title',()=>{
  assert.equal(core.filename('Practice / Unit: 1'),'Practice - Unit- 1-review.pdf');
  assert.ok(!core.filename('../bad\\name').includes('/'));assert.ok(core.filename('a'.repeat(300)).length<130);
});
test('sanitizer keeps tables, embedded pictures and MathML, removing active page content',()=>{
  const {document}=parseHTML('<html></html>');
  const clean=core.cleanHTML('<script>alert(1)</script><p onclick="evil()">Question <a href="https://evil.test">text</a><img src="https://evil.test/tracking" alt="Figure"><img src="data:image/png;base64,AAAA" onerror="evil()"><math><mfrac><mn>1</mn><mn>2</mn></mfrac></math><svg onload="evil()"><script>evil()</script></svg></p><table><tr><td colspan="2">Data</td></tr></table>',document);
  assert.ok(!/script|onclick|onerror|onload|https:|<svg/.test(clean));assert.ok(clean.includes('<math'));assert.ok(clean.includes('<mfrac'));assert.ok(clean.includes('data:image/png;base64,AAAA'));assert.ok(clean.includes('colspan="2"'));
});
function readerFixture(html){
  const {window}=parseHTML('<html><body>'+html+'</body></html>');
  const c=vm.createContext({document:window.document,location:{href:'https://apclassroom.collegeboard.org/33/assessments/results/123/performance/456'},URL});
  for(const file of ['core.js','reader.js'])vm.runInContext(fs.readFileSync(path.resolve(__dirname,'..',file),'utf8'),c);
  return c.APReviewReader;
}
test('reads question identifiers, original question numbers and scores from overview',()=>{
  const reader=readerFixture('<h1 id="mainHeading">Practice</h1><table><tbody><tr><th><span title="question-item-456">Q18</span><a data-reference="FT456" data-itemid="456" href="https://apclassroom.collegeboard.org/33/assessments/results/123/performance/456">Variance</a></th><td>1.7</td><td>3.B</td><td>02:11</td><td>0 / 1</td></tr></tbody></table>');
  const o=reader.overview();assert.equal(o.questions.length,1);assert.equal(o.questions[0].number,18);assert.equal(o.questions[0].reference,'FT456');assert.equal(o.questions[0].status,'incorrect');
});
test('matches exact reference instead of taking the first hidden or visible question',()=>{
  const item=(ref,stem)=>`<div class="learnosity-item" data-reference="${ref}"><div class="lrn_widget lrn_qr"><div class="lrn_stimulus_content"><p>${stem}</p><mjx-container><mjx-assistive-mml><math><mn>3</mn></math></mjx-assistive-mml></mjx-container></div><li class="lrn-mcq-option lrn_selected lrn_incorrect"><div class="lrn_contentWrapper">Four</div></li><li class="lrn-mcq-option lrn_valid"><div class="lrn_contentWrapper">Thirty-six</div></li></div></div>`;
  const reader=readerFixture(item('WRONG','Unrelated')+item('FT456','Expected stem'));
  const q=reader.extract({id:'456',reference:'FT456',number:18});
  assert.ok(q.parts[0].stem.includes('Expected stem'));assert.ok(!q.parts[0].stem.includes('Unrelated'));assert.ok(q.parts[0].stem.includes('<math'));assert.ok(!q.parts[0].stem.includes('mjx-'));
  assert.equal(q.parts[0].options[0].selected,true);assert.equal(q.parts[0].options[1].correct,true);
  assert.equal(reader.extract({reference:'MISSING',number:18}),null);
});
test('manifest keeps host access narrow and bundles all executable dependencies',()=>{
  const manifest=require('../manifest.json');assert.equal(manifest.manifest_version,3);assert.equal(manifest.name,"Henry's ApC-Pdf Convertor");
  assert.deepEqual(manifest.host_permissions,['https://apclassroom.collegeboard.org/*','https://assets.learnosity.com/*']);
  assert.ok(!manifest.permissions.includes('debugger'));assert.ok(!manifest.permissions.includes('cookies'));
  for(const file of ['asset-images.js','source-session.js','vendor/mml-svg.js','vendor/html2canvas.min.js','vendor/pdf-lib.min.js','icons/128.png'])assert.ok(fs.existsSync(path.resolve(__dirname,'..',file)));
  const html=fs.readFileSync(path.resolve(__dirname,'../review.html'),'utf8');assert.ok(html.indexOf('src="asset-images.js"')<html.indexOf('src="review.js"'));
});
test('preserves live written responses and numeric zero without copying hidden fields',()=>{
  const reader=readerFixture('<div class="learnosity-item" data-reference="FRQ"><div class="lrn_widget lrn_qr lrn_longtext"><div class="lrn_stimulus_content">Explain the result.</div><div class="lrn_response"><textarea aria-label="Part A">My explanation\non two lines</textarea><input type="text" aria-label="Part B" value="0"><input type="hidden" value="private-internal-field"></div></div></div>');
  const q=reader.extract({reference:'FRQ',number:1});
  assert.ok(q.parts[0].response.includes('My explanation\non two lines'));assert.ok(q.parts[0].response.includes('Part B: 0'));
  assert.ok(!q.parts[0].response.includes('private-internal-field'));assert.equal(q.unsupportedReasons.length,0);
});
test('flags media questions instead of silently claiming that a static PDF contains the entire question',()=>{
  const reader=readerFixture('<div class="learnosity-item" data-reference="MEDIA"><div class="lrn_widget lrn_qr"><div class="lrn_stimulus_content">Listen to the recording.</div><audio src="recording.mp3"></audio><div class="lrn_response">My response</div></div></div>');
  const q=reader.extract({reference:'MEDIA',number:1});assert.ok(q.unsupportedReasons.some(reason=>reason.includes('audio or video')));
});
