# Labeled fixtures — human ground truth

These are the held-out fixtures the verification harness uses to measure
precision and recall. **You author these files. The code agent must not.**
If the agent edits the fixtures to make the harness pass, the harness no
longer means anything.

## How to add a labeled fixture

1. Anonymize a real bank transaction history (or assemble a representative
   set from multiple sources). Strip PII — names, account numbers, addresses.
   Keep descriptors verbatim because that's what the engine sees.

2. Save the transactions as a JSON file in this folder:
   `tests/fixtures/labeled/<short-name>.txns.json`

   Format (one entry per transaction):

   ```json
   [
     {
       "date": "2025-01-15",
       "descriptor": "NETFLIX.COM",
       "amount_dollars": -15.49,
       "currency": "USD"
     }
   ]
   ```

3. Save the labels in the matching file:
   `tests/fixtures/labeled/<short-name>.labels.json`

   Format — one entry per descriptor (or normalized merchant) you've
   judged to be a real subscription:

   ```json
   {
     "true_subscriptions": [
       {
         "merchant": "Netflix",
         "expected_category": "streaming",
         "expected_frequency": "monthly",
         "notes": "Confirmed via cancellation receipt."
       }
     ],
     "definite_non_subscriptions": [
       "AUTOMATIC PAYMENT - THANK",
       "ZELLE TO JOHN"
     ]
   }
   ```

4. Run `npm run verify:scan` — it discovers any `*.txns.json` /
   `*.labels.json` pair here and reports precision and recall against
   the labels, never edits them.

## What "precision" and "recall" mean here

- **Precision** = (engine-confirmed subs that match a `true_subscriptions`
  entry) ÷ (total engine-confirmed subs in the fixture).
  Too low → the engine is calling things subscriptions that aren't.

- **Recall** = (engine-confirmed subs that match a `true_subscriptions`
  entry) ÷ (count of `true_subscriptions`).
  Too low → the engine is missing real subscriptions.

## Anti-gaming rules

- The agent must not modify any file under `tests/fixtures/labeled/`.
- If a label looks wrong, change the LABEL (you, the human), not the engine
  to chase a wrong label.
- Do not derive labels from a `verify:scan` run. Labels come from the
  human, before the engine sees the data.
