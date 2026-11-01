# Henry's ApC-Pdf Convertor

A small, English-only Chrome extension for reviewing **completed AP Classroom assignments**. Read an assignment, check a compact preview, then download an A4 review PDF with **missed questions first and correct questions second**.

## Install

1. Download the ZIP from [Releases](https://github.com/ImNotYihan/Henry-s-ApC-Pdf-Convertor/releases/latest) and extract it.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose the extracted folder containing `manifest.json`.
5. Pin **Henry's ApC-Pdf Convertor** from Chrome's Extensions menu.

No build step is needed. The rendering libraries are bundled locally. This is an unpacked extension, not a Chrome Web Store listing.

## Use

1. Sign in to AP Classroom and open a completed assignment's **Results Overview** or **Question Details** page.
2. Open the extension and click **Read assignment**.
3. Keep the review tab open while a temporary AP Classroom tab reads the assignment. Your original tab is preserved.
4. Check the question count and results. Expand any question to inspect its text, options, figures, and answers. You can correct the result category in the preview.
5. Confirm **I checked the preview. The questions and results are correct.**
6. Click **Generate & download PDF** and choose where to save it.

The PDF preserves original question numbers. Partial-credit questions go in **Missed questions**. Unscored questions require you to choose a result before export. The answer checkbox lets you make a practice copy without the selected/correct answer markings.

## What is supported

- Completed assignment result URLs on `apclassroom.collegeboard.org`.
- The Learnosity question format currently used by AP Classroom, with exact question-reference matching.
- Multiple-choice stems and options, selected and revealed correct answers, tables, MathML formulas, and figures hosted on `assets.learnosity.com`.
- A concise, expandable preview and two-section A4 PDF, with page numbers.
- Cancellation, retry, missing-image errors, and automatic cleanup of the temporary reading tab.

The current release is validated against a 37-question multiple-choice assignment. Free-response and interactive/media questions are flagged for manual inspection; their response formats vary and are not fully supported. Teacher-hidden answers and unreleased results cannot be supplied. Changes to AP Classroom's page structure may require an adapter update. If a question or figure cannot be read, export stops with an actionable message.

PDF content is rendered at double resolution to preserve formulas and page appearance. Question text is rasterized rather than selectable or searchable. Very long questions continue on subsequent pages; ordinary questions are kept together when they fit.

## Privacy and permissions

There is no backend, account, analytics, AI API, or cloud upload. Assignment content lives in the review tab's memory and is cleared when that tab closes. A small `chrome.storage.session` record tracks temporary-tab ownership only; it does not store questions or scores. Your own signed-in AP Classroom session loads the pages normally. The extension does not inspect cookies or credentials.

| Permission | Purpose |
| --- | --- |
| `activeTab` | Identify the assignment you opened the extension from. |
| `scripting` | Read assignment content from the AP Classroom page. |
| AP Classroom host | Read a temporary assignment tab while keeping your original tab intact. |
| Learnosity asset host | Embed question figures in the local PDF. |
| `storage` | Track and clean up the temporary reading tab. |
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
- `core.js`: URL validation, score classification, grouping, and inert HTML sanitization.
- `review.js`: local extraction session, preview, image embedding, and download.
- `pdf.js`: two-section PDF layout and rendering.
- `background.js`: temporary-tab ownership and cleanup.
- `tests/`: synthetic tests; no real questions or student data are included.

## Bundled dependencies

All executable code is packaged with the extension, with no CDN scripts:

- [html2canvas 1.4.1](https://github.com/niklasvh/html2canvas), MIT.
- [pdf-lib 1.17.1](https://github.com/Hopding/pdf-lib), MIT.
- [MathJax 3.2.2](https://github.com/mathjax/MathJax), Apache-2.0, MathML-to-SVG component.

Dependency license files are included in `vendor/`. The extension's own code is MIT licensed.
