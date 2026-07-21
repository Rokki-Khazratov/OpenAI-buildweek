# Judge demo runbook (2–3 minutes)

## Preflight

1. Start the complete stack and run `node scripts/seed-ds-golden-flow.mjs`.
2. Confirm `status=passed`, `data_quality_safe=true`, a snapshot ID, and three attempts.
3. If Vertex credentials are configured, run `node scripts/vertex-sandbox-smoke.mjs`.
   Otherwise state explicitly that the demo uses the deterministic fallback.

## Visible flow

1. Sign in as `ds-golden@example.com` / `correct horse battery staple`.
2. Open **Analytics** and select **Adaptive analytics golden flow**.
3. Point out readiness, evidence confidence, and opposing improving/declining trends.
4. Explain that readiness is an index, not a pass probability.
5. Click the adaptive CTA and show target skills plus `adaptive.v2` rationale.
6. Complete one targeted mock and return to analytics to show the new snapshot/readiness.
7. Open the class cohort view and show aggregate support/suppression. State that student
   answers and individual weaknesses never enter this response.

## Recovery

- If live Vertex fails, do not retry for more than 45 seconds; use deterministic mode and
  label it on camera.
- If the seed already exists, it reconciles and prints the same exam instead of duplicating it.
- Do not edit the database or run manual SQL during the demo.
