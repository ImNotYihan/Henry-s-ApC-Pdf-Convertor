# Validation for v1.0.1

Validated on November 1, 2026.

## Automated checks

Seventeen passing tests cover the existing content adapter and the same-tab regression. The original eight tests cover URL matching, score parsing, sorting, filenames, sanitization, overview extraction, reference matching, and the manifest/dependency contract.

Nine additional tests exercise the source-session controller against simulated Chrome scripting and tab APIs. They cover reading from overview and detail views, reusing already-loaded questions, restoring the original route and scroll, cancellation, a closed source tab, user navigation to a different assignment, missing question links, timeouts, and suppressing native full-document link navigation. The simulated API rejects all attempts to create, remove, update, or reload a browser tab. A package contract also checks that the review does not contain those lifecycle operations, and that there is no tab-closing background worker or storage permission.

The reported v1.0.0 sign-in regression came from creating a fresh AP Classroom tab. Version 1.0.1 removes that path and its direct-URL navigation fallback. It injects the adapter into the tab that was already open when the user clicked the extension.

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

The PDF checks above apply to the unchanged PDF renderer. The same-tab fix is validated with DOM fixtures and simulated Chrome APIs, not a newly installed-profile smoke test. Free-response, audio/video, and interactive question formats have not been validated.
