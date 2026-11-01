# Validation for v1.0.2

Validated on November 1, 2026.

## Automated regression suite

All 27 tests pass. Coverage includes URL and score parsing, reference matching, safe HTML, question ordering, existing-tab reading/restoration/cancellation, failure without a new sign-in tab, SVG MIME detection, raster image caching, failed-image cleanup, dimensions/size limits, HTTP failures, and host restrictions.

Static textarea and numeric responses are also checked, including preserving numeric zero and excluding hidden form fields. Audio/video questions are explicitly flagged as incomplete for a static PDF rather than silently exported without their required content.

## Assignment-independent extraction

Two local snapshots of completed assignments were checked:

| Sample | Questions | Options | Formulas |
| --- | --- | --- | --- |
| A | 37 | 148 | 58 |
| B | 40 | 160 | 83 |
| Total | 77 | 308 | 141 |

Every question reference, selected answer, revealed correct answer, and overview score matched. No assignment ID, question number, subject title, or figure-specific exception is used in the adapters. Real questions, answer keys, source snapshots, figures, and generated study PDFs are excluded from this repository and release.

## Actual Chrome image/PDF checks

The reported decoder failure was reproduced on all four SVG answer figures in sample B: the old `createImageBitmap(blob)` path rejected them with the same error as the report. The replacement image-element decoder converted and reloaded all 32 unique figures from that assignment. Additional PNG, JPEG, GIF, and WebP fixtures also passed, for 36 successful real-browser image conversions in total. Browser tests used the extension's packaged decoder code and the same script/image content-security restrictions.

Sample B's full 40-question preview and 39-page A4 PDF were generated in a local Chrome development preview. All PDF pages were rendered and visually inspected, including the four previously failing SVG histograms, section order, selected/correct markings, tables, and formulas. The prior 37-question PDF was also visually checked. This is real decoder/rendering validation using private local test data, not a claim that every installed-profile workflow has been tested.

## Support boundary

These checks do **not** prove compatibility with every AP Classroom assignment or subject. The extension requires completed, released results using the supported Learnosity results interface. It does not grade active assignments or reveal hidden content. Only ordinary static written/numeric FRQ controls have fixture coverage; other FRQ formats have not been fully validated. Audio/video, embedded frames, interactive canvas questions, unknown page structures, and unsupported image hosts stop export instead of producing an incomplete review document. An installed-profile smoke test for the updated package remains separate from the local browser validation above.
