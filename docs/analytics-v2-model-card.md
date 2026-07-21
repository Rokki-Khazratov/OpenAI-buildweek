# ExamTwin analytics.v2 model card

## Intended use

`analytics.v2` is an explainable preparation index for one user and one configured exam.
It ranks study priorities and selects skills for an adaptive mock. It is not a pass
probability, diagnosis, grade prediction, or comparison between people.

## Inputs and boundaries

Only validated `QuestionEvaluation` facts become `skill_observation.v1` records. Each
record contains identifiers, normalized score, point share, evaluator confidence,
validated question difficulty, optional bounded duration, taxonomy provenance, and
model version. Raw answers, feedback, source quotes, and prompts are excluded.

## Calculation

- evidence is recency-weighted with a 30-day half-life;
- evaluator confidence is clamped to `[0.25, 1]`;
- validated hard/easy difficulty applies only a small bounded score correction;
- mastery is weighted by points, confidence, recency, and blueprint weight;
- confidence combines evidence coverage, consistency, and freshness;
- readiness is `weighted mastery − uncertainty penalty`, bounded to `0..100`;
- timing never decreases mastery and is only disclosed as a secondary signal;
- trends require at least three attempt-level signals.

The constants are returned by the API. Any formula change requires a new
`model_version`; any selection change requires a new `policy_version`.

## Adaptive policy v2

The policy balances confirmed gaps, evidence collection, retention refresh, blueprint
constraints, and target diversity. Metadata stores candidates, selected targets,
selection reasons, exploration share, readiness before generation, and policy version.

## Confidence

Confidence describes evidence coverage and consistency. It does not describe model
accuracy. One question remains low evidence even when its score is high.

## Privacy and cohort use

Personal analytics is available only to the user. Cohort analytics is owner-only,
aggregate-only, version-compatible, and suppressed below the configured member/support
threshold. Student rows, answers, feedback, and individual weaknesses are never returned
by the cohort analytics endpoint.

## Known limitations

- difficulty is generated or configured and is not ground truth;
- duration is affected by question type, interruptions, and accommodations;
- the benchmark is synthetic until real consented outcomes exist;
- the index is not calibrated against final exam outcomes;
- causal claims cannot be made from observational improvement.

## Validation and rollback

The frozen synthetic benchmark checks monotonicity, sparse-evidence conservatism,
noise stability, trend direction, diversity, and bounds. Candidate policies run in
shadow storage first. Rollback changes configuration/model selection and never rewrites
historical snapshots.
