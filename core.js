/* Shared, dependency-free model and HTML sanitization. */
(function (scope) {
  'use strict';
  const ORIGIN = 'https://apclassroom.collegeboard.org';
  const STATUS = {incorrect: 'Missed', partial: 'Partial credit', correct: 'Correct', unknown: 'Unscored'};
  function assignmentUrl(value) {
    try {
      const u = new URL(value);
      const m = u.pathname.match(/^\/(\d+)\/assessments\/results\/(\d+)\/performance(?:\/[^/]+)?\/?$/);
      return u.origin === ORIGIN && m ? `${ORIGIN}/${m[1]}/assessments/results/${m[2]}/performance` : null;
    } catch { return null; }
  }
  function score(value) {
    const m = String(value ?? '').match(/(^|[^\d.])(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?![\d.])/);
    if (!m) return {earned: null, possible: null, status: 'unknown'};
    const earned = Number(m[2]), possible = Number(m[3]);
    if (possible <= 0 || earned > possible) return {earned: null, possible: null, status: 'unknown'};
    return {earned, possible, status: earned === possible ? 'correct' : earned === 0 ? 'incorrect' : 'partial'};
  }
  function groups(questions) {
    const ordered = [...questions].sort((a,b) => a.number - b.number);
    return {
      missed: ordered.filter(q => q.status === 'incorrect' || q.status === 'partial'),
      correct: ordered.filter(q => q.status === 'correct'),
      unknown: ordered.filter(q => q.status === 'unknown')
    };
  }
  function filename(title) {
    return (String(title).normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').slice(0,110) || 'AP-Classroom') + '-review.pdf';
  }
  function escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  // Rebuild a small, inert markup vocabulary. Never import page scripts, styles,
  // event handlers, forms, URLs in SVG, or custom web components.
  function cleanHTML(value, doc = document) {
    const template = doc.createElement('template');
    template.innerHTML = value;
    const allowed = new Set('p div span br strong b em i u s sup sub ul ol li table thead tbody tfoot tr td th caption blockquote pre code h3 h4 hr img math mrow mi mn mo ms mtext mspace mfrac msqrt mroot msub msup msubsup mover munder munderover mfenced mtable mtr mtd mstyle mpadded mphantom menclose semantics annotation'.split(' '));
    const drop = new Set('script style iframe object embed link meta form input button textarea select video audio source canvas svg noscript'.split(' '));
    function walk(node) {
      if (node.nodeType === 3) return doc.createTextNode(node.textContent);
      if (node.nodeType !== 1) return doc.createTextNode('');
      const tag = node.localName.toLowerCase();
      if (drop.has(tag)) return doc.createTextNode('');
      if (!allowed.has(tag)) {
        const fragment = doc.createDocumentFragment();
        for (const child of [...node.childNodes]) fragment.append(walk(child));
        return fragment;
      }
      const out = tag === 'math' || node.namespaceURI === 'http://www.w3.org/1998/Math/MathML'
        ? doc.createElementNS('http://www.w3.org/1998/Math/MathML', tag) : doc.createElement(tag);
      if (tag === 'img') {
        const src = node.getAttribute('src') || '';
        if (!/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z\d+/=\s]+$/i.test(src)) return doc.createTextNode(node.getAttribute('alt') || '[Image unavailable]');
        out.setAttribute('src', src);
        out.setAttribute('alt', node.getAttribute('alt') || 'Question figure');
        const w = Number(node.getAttribute('width'));
        if (w > 0 && w <= 4000) out.setAttribute('width', String(w));
      }
      if (['td','th'].includes(tag)) for (const attr of ['colspan','rowspan']) {
        const n = Number(node.getAttribute(attr)); if (n > 0 && n < 100) out.setAttribute(attr, String(n));
      }
      if (out.namespaceURI === 'http://www.w3.org/1998/Math/MathML') {
        for (const attr of ['display','mathvariant','linethickness','notation','columnalign','rowalign','columnspacing','rowspacing','stretchy','fence','separator']) {
          const v = node.getAttribute(attr); if (v && /^[a-z\d .,%()+-]+$/i.test(v)) out.setAttribute(attr,v);
        }
      }
      for (const child of [...node.childNodes]) out.append(walk(child));
      return out;
    }
    const result = doc.createElement('div');
    for (const node of [...template.content.childNodes]) result.append(walk(node));
    return result.innerHTML;
  }
  const api = {ORIGIN, STATUS, assignmentUrl, score, groups, filename, escape, cleanHTML};
  scope.APReviewCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
