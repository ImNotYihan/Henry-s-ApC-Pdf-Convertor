# Henry's ApC-Pdf Convertor

A small, English-only Chrome extension for reviewing **completed AP Classroom assignments**. Read an assignment, check a compact preview, then download an A4 review PDF with **missed questions first and correct questions second**.

## Install

1. Download the ZIP from [Releases](https://github.com/ImNotYihan/Henry-s-ApC-Pdf-Convertor/releases/latest) and extract it.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose the extracted folder containing `manifest.json`.
5. Pin **Henry's ApC-Pdf Convertor** from Chrome's Extensions menu.

No build step is needed. The rendering libraries are bundled locally. This is an unpacked extension, not a Chrome Web Store listing.

### Update from an earlier version

Download the latest release. Either replace the contents of your existing unpacked extension folder and click **Reload** in `chrome://extensions`, or remove the old extension and load the newly extracted folder. Close old review pages and open the updated extension again so they do not keep running the previous scripts. Keep your already signed-in AP Classroom assignment tab open while updating.

Version 1.0.1 fixes the repeated sign-in bug by reading your existing assignment tab. It never opens a new AP Classroom tab or loads an assignment URL as a fresh document.

Version 1.0.2 fixes SVG figure decoding across assignments. It loads figures through Chrome's image-element decoder and converts them to inert PNGs for export. This is a format adapter, with no assignment IDs, question numbers, or question-specific exceptions. It also preserves values from ordinary written/numeric response controls instead of dropping them from HTML snapshots.

## Use

1. Sign in to AP Classroom and open a completed assignment's **Results Overview** or **Question Details** page.
2. Open the extension and click **Read assignment**.
3. Keep the review tab and your already signed-in AP Classroom tab open. The extension reads that existing tab, using the site's own question links when needed. When reading finishes or is cancelled, it restores the original question/overview and scroll position where possible. Avoid navigating that tab yourself while reading.
4. Check the question count and results. Expand any question to inspect its text, options, figures, and answers. You can correct the result category in the preview.
5. Confirm **I checked the preview. The questions and results are correct.**
6. Click **Generate & download PDF** and choose where to save it.

The PDF preserves original question numbers. Partial-credit questions go in **Missed questions**. Unscored questions require you to choose a result before export. The answer checkbox lets you make a practice copy without the selected/correct answer markings.

## What is supported

- Completed assignment result URLs on `apclassroom.collegeboard.org`.
- The Learnosity question format currently used by AP Classroom, with exact question-reference matching.
- Multiple-choice stems and options, selected and revealed correct answers, tables, MathML formulas, and SVG/PNG/JPEG/GIF/WebP figures hosted on `assets.learnosity.com`.
- Static written/numeric responses from ordinary form controls. FRQ variants still require checking the full response in the preview.
- A concise, expandable preview and two-section A4 PDF, with page numbers.
- Cancellation, retry, missing-image errors, and restoration of the existing source page. The extension never closes your AP Classroom tab.

The adapter is shared across assignments and subjects that use this results format. It has been checked against two completed multiple-choice assignments with 77 questions in total, plus synthetic written/numeric response fixtures. This does **not** establish compatibility with every AP Classroom assignment or subject. It requires completed results and released question content; it does not grade active assignments or reveal teacher-hidden answers. FRQ formats beyond ordinary text/numeric controls are not fully validated. Audio, video, embedded frames, and interactive canvas questions stop export with an explicit explanation rather than silently producing a PDF missing those components. Changes to AP Classroom's page structure may require an adapter update.

PDF content is rendered at double resolution to preserve formulas and page appearance. Question text is rasterized rather than selectable or searchable. Very long questions continue on subsequent pages; ordinary questions are kept together when they fit.

## Privacy and permissions

There is no backend, account, analytics, AI API, or cloud upload. Assignment content lives in the review tab's memory and is cleared when that tab closes. The extension uses your already-open AP Classroom document and its existing sign-in state. It does not inspect cookies or credentials and does not use extension storage.

| Permission | Purpose |
| --- | --- |
| `activeTab` | Identify the assignment you opened the extension from. |
| `scripting` | Read assignment content from the AP Classroom page. |
| AP Classroom host | Read your already-open assignment tab and its in-page question navigation. |
| Learnosity asset host | Embed question figures in the local PDF. |
| `downloads` | Open Chrome's save dialog for the generated PDF. |

Only the two named hosts are permitted. No all-sites, browsing-history, debugger, or cookie permission is requested. Use exported materials for your personal study and follow your school's and College Board's rules. This project is independent of College Board.

## Development

Requires Node.js 20 or newer for tests only:

```sh
npm install
npm test
```

The extension itself runs without installing npm packages. Reload it in `chrome://extensions` after editing the source.

- `reader.js`: AP Classroom overview and Learnosity DOM adapter.
- `source-session.js`: existing-tab reading, safe in-page navigation, cancellation, and view restoration.
- `asset-images.js`: format-independent browser image decoding, SVG support, and PNG embedding.
- `core.js`: URL validation, score classification, grouping, and inert HTML sanitization.
- `review.js`: local extraction session, preview, image embedding, and download.
- `pdf.js`: two-section PDF layout and rendering.
- `tests/`: synthetic tests; no real questions or student data are included.

## Bundled dependencies

All executable code is packaged with the extension, with no CDN scripts:

- [html2canvas 1.4.1](https://github.com/niklasvh/html2canvas), MIT.
- [pdf-lib 1.17.1](https://github.com/Hopding/pdf-lib), MIT.
- [MathJax 3.2.2](https://github.com/mathjax/MathJax), Apache-2.0, MathML-to-SVG component.

Dependency license files are included in `vendor/`. The extension's own code is MIT licensed.
