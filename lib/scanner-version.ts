// Scanner version.
//
// Stamped on every scan_run, scan_snapshot, and subscription row so
// "same transactions + same as_of_date + same scanner_version → byte-
// identical output" is a verifiable replay guarantee.
//
// Bump the version when ANY of the following change in a way that
// affects the engine's output:
//   - merchant-catalog.json schema or content
//   - lib/merchant-normalize.ts pipeline
//   - lib/recurrence-detect.ts rules (cadence bands, drift tolerance,
//     min occurrences)
//   - lib/classify.ts gates
//   - lib/ai/normalize.ts model id or system prompt
//
// SemVer is the convention: MAJOR for breaking changes the dashboard
// must explain to the user (e.g. category renames), MINOR for additive
// catalog growth, PATCH for bug fixes that may shift edge cases.
//
// Display layer can show "Scanned with engine v3.0.0" so a user
// looking at an old snapshot understands why the result differs from
// today's engine.

export const SCANNER_VERSION = "3.7.0-peace-of-mind-monitoring";
