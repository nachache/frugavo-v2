# Scan harness fixture sets

Drop a `*.json` file in this folder and the scan harness picks it up
automatically. No registry to update, no code to touch.

```
npm run scan:test                  # run every set
npm run scan:test -- netflix-only  # run one set by filename stem
npm run scan:test -- --verbose     # show per-stream audit details
```

## File format

```json
{
  "name": "Human readable name",
  "description": "What this set is testing",
  "as_of": "2026-05-25",
  "expected": {
    "min_streams": 1,
    "must_detect": ["Netflix", "Spotify"]
  },
  "transactions": [
    { "date": "2025-12-01", "descriptor": "NETFLIX.COM", "amount": -15.49 },
    { "date": "2026-01-01", "descriptor": "NETFLIX.COM", "amount": -15.49 }
  ]
}
```

Field reference:

- `name` and `description` — printed in the report header.
- `as_of` — optional. The detector itself is date-pure; this is only
  used in the report header.
- `expected.min_streams` — optional. Harness flags the set as FAIL if
  fewer streams confirm.
- `expected.must_detect` — optional. List of merchant substrings the
  harness expects to find in the confirmed stream list. Case-insensitive.
- `transactions[]`:
  - `date` — ISO `YYYY-MM-DD`
  - `descriptor` — raw bank descriptor (the messier the better)
  - `amount` — dollars. Negative = outflow. Positive = inflow (the
    detector filters inflows out).
  - `currency` — optional. Defaults to USD.
  - `pfc_primary` / `pfc_detailed` — optional Plaid PFC tags.

## Contract

The harness only feeds inputs into the existing
`lib/recurrence-detect.ts` + `lib/classify.ts` modules and prints
outputs. It never patches the engine. If a set fails, the engine is
what changed — not the harness.
