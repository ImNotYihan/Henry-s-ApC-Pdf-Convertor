/* Runs only when the user starts a read; never collects account credentials. */
(function (scope) {
  'use strict';
  const core = scope.APReviewCore;
  const text = node => (node?.textContent || '').replace(/\s+/g,' ').trim();
  function overview() {
    const base = core.assignmentUrl(location.href);
    if (!base) throw new Error('Open a completed AP Classroom assignment results page first.');
    const records = [];
    for (const row of document.querySelectorAll('table tbody tr, [role="table"] [role="row"]')) {
      const a = [...row.querySelectorAll('a[href]')].find(a => {
        try { return a.href.startsWith(base + '/') && new URL(a.href).pathname.split('/').length === 7; } catch { return false; }
      });
      if (!a) continue;
      const first = row.querySelector('th,[role="rowheader"]') || row;
      const numberLabel = first.querySelector('[title^="question-item-"]');
      const number = Number(text(numberLabel || first).match(/^Q\s*(\d+)/i)?.[1]);
      if (!number) continue;
      const cells = [...row.querySelectorAll('td,[role="cell"]')];
      const result = core.score(text(cells.at(-1)));
      records.push({id:new URL(a.href).pathname.split('/').at(-1), reference:a.dataset.reference || '', number,
        title:text(a), url:a.href, scoreText:text(cells.at(-1)), ...result,
        topic:text(cells[0]), skills:cells.length >= 4 ? text(cells[1]) : '', time:text(cells.at(-2))});
    }
    const unique = [...new Map(records.map(q => [q.id,q])).values()].sort((a,b) => a.number-b.number);
    return {title:text(document.querySelector('#mainHeading,h1')) || 'AP Classroom assignment',
      sourceUrl:base, totalScore:text(document.querySelector('[id^="student-performance-bar"]')), questions:unique};
  }
  function matchingRoot(record) {
    if (record.reference) {
      const roots = [...document.querySelectorAll('.learnosity-item[data-reference]')].filter(e => e.dataset.reference === record.reference);
      // Do not fall back to an unrelated visible item while this reference loads.
      return roots.find(e => e.querySelector('.lrn_stimulus_content,.lrn_question')) || null;
    }
    const heading = document.querySelector('.RI_header__title');
    if (!text(heading).match(new RegExp('^Q\\s*' + record.number + '\\b'))) return null;
    const visible = [...document.querySelectorAll('.learnosity-item')].filter(e => e.getClientRects().length);
    return visible.length === 1 ? visible[0] : null;
  }
  function ready(record) {
    const root = matchingRoot(record);
    if (!root) return false;
    const stems = [...root.querySelectorAll('.lrn_stimulus_content')];
    return stems.length > 0 && stems.every(e => text(e) || e.querySelector('img,math,mjx-container,svg'));
  }
  function normalize(node) {
    const clone = node.cloneNode(true);
    // The accessible MathML is self-contained; the page's MathJax CHTML is not.
    for (const math of clone.querySelectorAll('mjx-container,.MathJax,.MathJax_SVG,.MathJax_CHTML')) {
      const mml = math.querySelector('math');
      if (mml) math.replaceWith(mml.cloneNode(true));
    }
    for (const e of clone.querySelectorAll('.sr-only,.lrn-accessibility-arialive,mjx-assistive-mml,script,style,[role="tooltip"]')) e.remove();
    return clone.innerHTML;
  }
  function extract(record) {
    const root = matchingRoot(record);
    if (!root || !ready(record)) return null;
    const warnings = [];
    const parts = [];
    // A scrollable passage may wrap a question; only select actual question widgets.
    const widgets = [...root.querySelectorAll('.lrn_widget.lrn_qr')].filter(e => !e.parentElement.closest('.lrn_widget.lrn_qr'));
    if (!widgets.length) return null;
    for (const widget of widgets) {
      const stems = [...widget.querySelectorAll('.lrn_stimulus_content')];
      const stem = stems.map(normalize).join('');
      const options = [...widget.querySelectorAll('.lrn-mcq-option')].map((e,i) => ({
        label:String.fromCharCode(65+i), html:normalize(e.querySelector('.lrn_contentWrapper') || e.querySelector('.lrn-possible-answer') || e),
        selected:e.classList.contains('lrn_selected') || !!e.querySelector('input:checked'),
        correct:e.classList.contains('lrn_correct') || e.classList.contains('lrn_valid')
      }));
      // Free-response variants are preserved as visible response content with a warning.
      let response = '';
      if (!options.length) {
        const r = widget.querySelector('.lrn_response');
        response = r ? normalize(r) : '';
        warnings.push('Free-response content: check that your full response appears below.');
      }
      parts.push({stem, options, response});
    }
    const shared = [...root.querySelectorAll('[data-lrn-widget-type="feature"]')]
      .filter(e => !e.querySelector('.lrn_qr'))
      .map(e => normalize(e)).filter(Boolean).join('');
    const missingAnswer = parts.some(p => p.options.length && !p.options.some(o=>o.correct));
    if (missingAnswer) warnings.push('The page has not revealed the correct answer for this question.');
    if (root.querySelector('audio,video,canvas')) warnings.push('Interactive or media content needs a manual check.');
    return {...record, shared, parts, warnings};
  }
  function navigate(url) {
    if (core.assignmentUrl(url) !== core.assignmentUrl(location.href)) throw new Error('Assignment changed. Start a new read.');
    const a = [...document.querySelectorAll('a[href]')].find(e => e.href === url);
    if (!a) return false;
    a.click();
    return true;
  }
  scope.APReviewReader = {overview, ready, extract, navigate};
})(globalThis);
