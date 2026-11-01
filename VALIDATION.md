# Validation for v1.0.0

Validated on November 1, 2026.

## Automated checks

Eight passing tests cover exact AP Classroom URL matching, score parsing, partial/unscored handling, original-number sorting, safe filenames, HTML sanitization, overview extraction, reference-specific question extraction, and the manifest/dependency contract.

## Local assignment validation

Against a local DOM sample of a completed multiple-choice assignment:

- All 37 question references matched their overview records.
- All 148 answer options were captured.
- Each question's selected and revealed correct answer was captured.
- The two missed questions matched the overview's zero scores.
- All 58 MathML formulas were preserved for local rendering.
- Fifteen question figures were embedded in the preview/PDF.

Real questions, answers, scores, and source snapshots are excluded from this repository and release archive.

## Browser and PDF validation

The English preview was exercised in Chrome, including the confirmation gate and PDF generation, under the same script/image/content restrictions as the extension. A generated 35-page A4 sample was rendered and visually inspected, including section order, selected/correct markings, formulas, figures, and multi-page graph options.

This validation used a development preview and local DOM snapshots. The unpacked extension has not been installed in the user's signed-in Chrome profile as part of this validation. Chrome tab/session/download orchestration therefore still needs an installed-profile smoke test. Free-response, audio/video, and interactive question formats have not been validated.
