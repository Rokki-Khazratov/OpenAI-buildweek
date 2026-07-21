# ExamTwin Data Science: D0 → D3

## 1. Назначение

Этот документ — следующий исполнимый Data Science roadmap, построенный от состояния
`main` после M6 и персонального `analytics.v1`.

> **Execution update (2026-07-21):** ограничение hackathon timebox снято по решению
> владельца проекта. D0–D3 реализованы в ветке `codex/ds-d0-d3-complete`; этот документ
> теперь служит acceptance contract и историей исходных ограничений.

Текущий статус реализации:

- **D0:** normal-mode golden seed, live Vertex proof, model card и judge runbook;
- **D1:** `skill_observation.v1`, snapshots, rebuild, taxonomy, quality и operations;
- **D2:** `analytics.v2`, `adaptive.v2`, frozen benchmark, difficulty/time guardrails,
  shadow results и versioned generation metadata;
- **D3:** owner-only aggregate cohort analytics, suppression, compatible single-exam
  scope, experiment events и privacy-safe frontend.

Он не повторяет уже выполненную работу. Текущая точка старта:

```text
validated QuestionEvaluation facts
→ deterministic personal skill metrics
→ mastery / confidence / trend
→ explainable readiness index
→ ranked recommendation
→ adaptive target skills
→ blueprint-safe adaptive mock
→ new evaluated attempt
→ changed analytics
```

Порядок работы фиксирован:

```text
D0 Release proof and freeze
→ D1 Trustworthy data foundation
→ D2 Calibrated adaptive policy
→ D3 Privacy-safe cohort intelligence
```

Первоначальный timebox требовал выполнять только D0 до submission. После явного
решения реализовать D0–D3 полностью этапы были выполнены последовательно: каждый
следующий слой строится на contract предыдущего.

### Milestone scorecard

| Milestone | Primary decision metric | Driver metrics | Guardrails | Release gate |
|---|---|---|---|---|
| D0 | Golden-flow completion | seed repeatability, provider proof, visible adaptation | zero manual SQL, honest provider label, no private-data leakage | 1/1 normal-mode judge flow passes twice from a clean seed |
| D1 | Snapshot/rebuild equivalence | observation acceptance, rebuild success, compute latency | user isolation, rejected-row explanations, immutable source facts | stored and rebuilt payloads match for every golden fixture |
| D2 | Policy quality on frozen benchmark | recommendation precision, responsiveness, target diversity | sparse-evidence conservatism, volatility, rollback readiness | candidate beats v1 on predeclared metrics and regresses on no guardrail |
| D3 | Eligible cohort insight coverage | supported skills, active learners, evidence coverage gain | small-group suppression, version compatibility, no student-answer exposure | every published aggregate passes permission, support and compatibility checks |

Это decision gates, а не production baselines. Численные targets для D1–D3 фиксируются
только после появления baseline dataset; до этого нельзя подгонять thresholds под
желаемый результат.

---

## 2. Что уже реализовано

### Backend

- pure engine `backend/api/app/modules/analytics/model.py`;
- compute-on-read service `backend/api/app/modules/analytics/service.py`;
- `GET /api/v1/exams/{exam_id}/analytics`;
- `GET /api/v1/analytics/overview`;
- versioned contract `analytics.v1`;
- recency weighting, evidence coverage, consistency, confidence и trends;
- readiness как индекс `0..100`, а не вероятность сдачи;
- deterministic recommendation ranking;
- adaptive targets и generation metadata;
- validation generated skill taxonomy и target coverage;
- isolation по текущему пользователю и отсутствие raw answers в analytics response.

### Frontend

- global Statistics;
- global Analytics;
- per-exam readiness и skill evidence;
- отдельное отображение mastery и confidence;
- improving / stable / declining / insufficient-data states;
- adaptive CTA и сохранённый adaptation context;
- representative demo dataset с противоположными skill trends.

### Verification

- pure analytics tests;
- PostgreSQL integration coverage;
- доказательство изменения readiness после новой evaluation;
- frontend loading/error/empty/evidence tests;
- CI backend, frontend и P0 E2E smoke.

### Осознанные ограничения `analytics.v1`

- readiness не является pass probability;
- модель не обучается на пользователях;
- analytics вычисляется on-read, snapshots отсутствуют;
- skill taxonomy хранится внутри approved blueprint, а не как отдельный semantic layer;
- difficulty и response time пока не входят в mastery;
- advanced class/cohort analytics не используют personal `analytics.v1`;
- нет offline calibration dataset и production monitoring.

---

# D0 — Release proof and DS contract freeze

## 3. Цель D0

Доказать один непрерывный реальный flow и заморозить честный DS contract для
submission:

```text
normal-mode account
→ exam + approved blueprint
→ grounded or explicitly deterministic mock
→ evaluated attempt
→ analytics.v1 response
→ visible readiness / confidence / trend
→ adaptive mock with saved targets and reason
```

D0 не добавляет новую модель. Он превращает существующую модель в доказуемый release.

## 4. D0 scope

### D0.0 — Repository release integration — DONE

- M6 и DS commits merged в `main`;
- formatter gate исправлен;
- frontend tests добавлены в CI;
- backend, frontend и P0 E2E jobs зелёные.

### D0.1 — Normal-mode golden dataset

Создать локальный воспроизводимый seed, который проходит через реальные API и
PostgreSQL, а не через `NEXT_PUBLIC_DEMO_MODE=true`.

Минимальный exam:

| Skill | Attempt 1 | Attempt 2 | Attempt 3 | Ожидаемый signal |
|---|---:|---:|---:|---|
| Dynamic programming | 35% | 48% | 58% | improving, weak |
| Graph algorithms | 75% | 62% | 50% | declining |
| Complexity | 85% | 88% | 90% | established |
| Recursion | — | — | 70% | low evidence |

Seed обязан создавать только localhost data и быть idempotent.

Предпочтительный новый файл:

```text
scripts/seed-ds-golden-flow.mjs
```

Он должен вывести:

```json
{
  "exam_id": "...",
  "attempt_ids": ["..."],
  "readiness": 0,
  "confidence": 0,
  "priority_skill": "...",
  "adaptive_targets": ["..."]
}
```

### D0.2 — Live AI proof or explicit fallback proof

Выполнить `scripts/vertex-sandbox-smoke.mjs` в текущем release environment.

Успех означает:

- artifact processed;
- blueprint extracted and approved;
- generator metadata содержит `provider=vertex`;
- generated questions имеют owned citations;
- evaluation содержит provider/model/confidence;
- analytics после submit использует сохранённые evaluation facts;
- adaptive generation metadata содержит targets и `readiness_before`.

Если Vertex нестабилен, release path переключается на явный deterministic mode.
Нельзя показывать deterministic result как live Vertex result.

### D0.3 — DS golden regression test

Добавить один компактный regression fixture, проверяющий вместе:

- expected trend direction;
- sparse-evidence protection;
- readiness bounds;
- recommendation ordering;
- adaptive target selection;
- readiness change after new evidence;
- отсутствие private answer/feedback в response.

Не проверять точные floating-point значения шире, чем требует contract. Проверять
направление, границы, ordering и version.

### D0.4 — Model card and demo runbook

Создать:

```text
docs/analytics-v2-model-card.md
docs/judge-demo-runbook.md
```

Model card фиксирует:

- назначение readiness index;
- формулы и constants;
- required evidence;
- что confidence означает и чего не означает;
- known limitations;
- privacy boundary;
- deterministic behavior;
- versioning policy.

Runbook фиксирует точные клики и ожидаемые visible signals на 2–3 минуты видео.

### D0.5 — Release freeze

После D0.1–D0.4:

- полный CI;
- normal-mode browser smoke;
- сохранённый Vertex/fallback smoke output;
- commit и tag/checkpoint;
- запрет новых DS features до submission.

## 5. D0 Definition of Done

D0 закрыт, только если:

- judge flow работает без ручного SQL;
- normal-mode analytics не зависит от frontend demo fixture;
- provider результата виден и честно подписан;
- readiness меняется после новой attempt;
- adaptive mock содержит реальные target skills;
- targets и rationale сохранены в metadata;
- model card объясняет uncertainty;
- CI и browser smoke зелёные;
- есть короткий воспроизводимый demo runbook.

## 6. D0 порядок на оставшиеся 3–4 часа

1. **0:00–0:35** — golden normal-mode seed.
2. **0:35–1:20** — live Vertex smoke; fallback decision не позднее 45 минут.
3. **1:20–1:55** — golden DS regression test.
4. **1:55–2:25** — model card и judge runbook.
5. **2:25–3:10** — normal-mode browser rehearsal и исправление blockers.
6. **3:10–3:30** — full CI, checkpoint, freeze.
7. **Оставшийся buffer** — только video/submission blockers.

---

# D1 — Trustworthy data foundation

## 7. Цель D1

Сделать analytics воспроизводимой, наблюдаемой и пригодной для сравнения версий без
повторного сканирования всей истории на каждом запросе.

## 8. D1 deliverables

### D1.1 — Canonical observation contract

Ввести версионированное внутреннее представление:

```text
skill_observation.v1
```

Поля:

```text
user_id
exam_id
attempt_id
question_id
skill_id
observed_at
normalized_score
point_share
evaluation_confidence
difficulty
duration_seconds (nullable)
taxonomy_source
evaluation_model_version
```

Raw answer в observation layer не хранится.

### D1.2 — Analytics snapshots

Добавить append-only snapshot после evaluated attempt:

```text
analytics_snapshots
```

Минимальные поля:

```text
id
user_id
exam_id
attempt_id
model_version
input_revision_hash
computed_at
readiness_index
readiness_confidence
payload JSONB
```

Compute-on-read остаётся fallback и механизмом rebuild.

### D1.3 — Idempotent recomputation

- один snapshot на `(attempt_id, model_version, input_revision_hash)`;
- rebuild command для одного exam/user;
- safe backfill;
- сравнение stored snapshot с fresh calculation;
- drift report без изменения validated evaluation facts.

### D1.4 — Data-quality checks

Автоматические проверки:

- orphan attempts/evaluations;
- unknown skill IDs;
- duplicate question observations;
- invalid score bounds;
- zero/negative max points;
- timestamps in the future;
- missing approved blueprint coverage;
- analytics NaN/Infinity;
- private data leakage in serialized payload.

### D1.5 — Skill semantic layer

Разделить stable skill identity и display label:

- canonical skill ID;
- aliases;
- blueprint version mapping;
- source section;
- merged/renamed skills;
- language-independent identity where possible.

Не делать автоматический cross-course merge без human confirmation.

### D1.6 — Observability

Метрики:

- analytics compute latency;
- observation count per profile;
- low-evidence profile share;
- unknown-skill rate;
- snapshot rebuild failures;
- recommendation action distribution;
- adaptive target coverage validation failures.

## 9. D1 tests

- migration upgrade/downgrade safety;
- snapshot idempotency;
- rebuild equivalence;
- taxonomy rename stability;
- corrupted observation rejection;
- user isolation;
- payload privacy;
- performance fixture with 100 attempts / 1000 evaluations.

## 10. D1 Definition of Done

- один attempt детерминированно создаёт один versioned snapshot;
- profile можно полностью rebuild;
- rebuild и stored result совпадают;
- data-quality report объясняет rejected observations;
- analytics response не зависит от raw answer storage;
- latency и failure metrics доступны.

---

# D2 — Calibrated adaptive policy

## 11. Цель D2

Перейти от хорошей deterministic heuristic к измеряемой персонализации, не выдавая
ложную точность и не превращая readiness в неподтверждённую pass probability.

## 12. D2 deliverables

### D2.1 — Offline evaluation dataset

Собрать anonymized/synthetic benchmark:

- repeated attempts;
- controlled improving/declining/stable patterns;
- sparse and conflicting evidence;
- different blueprint weights;
- evaluator confidence noise;
- skill renames and missing coverage;
- target dates and long evidence gaps.

Каждый scenario содержит expected qualitative outcome, а не только exact number.

### D2.2 — Metric calibration report

Для каждой версии сравнивать:

- stability under one noisy question;
- responsiveness to repeated new evidence;
- monotonicity when performance improves;
- sparse-evidence conservatism;
- recommendation precision against scenario labels;
- adaptive target diversity;
- readiness volatility.

### D2.3 — Difficulty-aware mastery

Добавить difficulty только после проверки качества input:

```text
adjusted_score = f(score, question_difficulty, evaluation_confidence)
```

Difficulty должна быть versioned и validated. LLM-generated difficulty без
calibration не считается ground truth.

### D2.4 — Time signal

Использовать response duration только как secondary signal:

- не штрафовать accessibility accommodations;
- не сравнивать разные question types напрямую;
- winsorize extreme durations;
- не снижать mastery только за медленный ответ;
- показывать пользователю, когда timing повлиял на recommendation.

### D2.5 — Adaptive policy v2

Policy выбирает mix:

- exploitation: confirmed high-impact gaps;
- evidence collection: uncertain high-weight skills;
- retention: previously strong but stale skills;
- diversity guardrail: не повторять один skill бесконечно;
- blueprint constraints: sections/counts/points неизменны.

Metadata:

```text
policy_version
candidate_skills
selected_skills
selection_reasons
exploration_share
readiness_before
expected_information_gain (optional)
```

### D2.6 — Counterfactual replay

На historical observations сравнивать `analytics.v1` и candidate policy без
изменения пользовательских данных.

## 13. D2 rollout rules

- `analytics.v1` остаётся control;
- новая версия получает отдельный `model_version`;
- shadow calculation перед UI rollout;
- no silent model switch;
- rollback — configuration change, не migration rollback;
- UI всегда показывает confidence и evidence count.

## 14. D2 Definition of Done

- benchmark воспроизводим;
- новая policy превосходит v1 по заранее выбранным metrics;
- noisy single observation не создаёт confirmed weakness;
- target diversity guardrail работает;
- shadow results сохраняются отдельно;
- rollout и rollback документированы.

---

# D3 — Privacy-safe cohort intelligence

## 15. Цель D3

Расширить DS на Classes без раскрытия student-level private data и без сравнения
несопоставимых exams.

## 16. D3 deliverables

### D3.1 — Cohort eligibility

Агрегировать только если:

- class и exam scope валидны;
- blueprint/taxonomy versions совместимы;
- metric model versions совместимы;
- support превышает privacy threshold;
- пользователь имеет owner/teacher permission;
- raw answers и individual feedback исключены.

### D3.2 — Privacy thresholds

Минимум:

- suppress small groups;
- minimum support per skill;
- округление percentages;
- отсутствие individual drill-down по умолчанию;
- opt-in leaderboard отдельно от analytics;
- audit event на cohort export.

### D3.3 — Cohort metrics

Разрешённые metrics:

- active learners;
- attempt coverage;
- median readiness index;
- readiness confidence distribution;
- skill mastery distribution с support;
- common low-evidence areas;
- common confirmed gaps;
- change over time;
- percentage of learners needing more evidence.

Нельзя показывать `weak skill` без confidence/support context.

### D3.4 — Comparable-segment rules

Не смешивать:

- разные blueprint versions без mapping;
- разные model versions;
- full exams и section-only attempts без label;
- stale и fresh evidence без disclosure;
- deterministic и Vertex evaluations без provider metadata.

### D3.5 — Experimentation

После достаточного трафика:

- recommendation acceptance rate;
- adaptive mock completion rate;
- next-attempt improvement;
- evidence coverage gain;
- retention after 7/14 days;
- guardrails: abandonment, volatility, repeated-target concentration.

Эксперименты не оптимизируются по одной readiness цифре.

### D3.6 — Cohort UI

Class dashboard должен разделять:

```text
Observed facts
Modelled indicators
Confidence / support
Recommended class action
```

Teacher видит aggregate reason, но не private student answer.

## 17. D3 tests

- privacy threshold suppression;
- owner/member permission matrix;
- cross-version incompatibility;
- taxonomy mapping;
- support counts;
- no PII/raw answer leakage;
- opt-in leaderboard isolation;
- aggregate recomputation after member removal;
- deleted exam/class behavior.

## 18. D3 Definition of Done

- class insight всегда имеет support и confidence;
- small cohorts подавляются;
- incompatible exams не смешиваются;
- member не получает owner analytics;
- raw responses никогда не попадают в cohort API;
- cohort action объясним и воспроизводим;
- experiments имеют primary metric и guardrails.

---

# 19. Общие правила D0–D3

## Versioning

- любое изменение формулы меняет `model_version`;
- constants возвращаются в response или model card;
- historical snapshots не переписываются молча;
- frontend не угадывает формулы backend;
- provider и evaluator version сохраняются рядом с observation.

## Privacy

- raw answers не являются analytics payload;
- source quotes не используются в aggregate UI;
- user-level DS доступен только самому пользователю;
- cohort DS использует suppression и role checks;
- logs не содержат private prompts или artifacts.

## Scientific honesty

- readiness index не называется probability;
- confidence не называется accuracy;
- insufficient evidence отображается явно;
- correlation не превращается в causal claim;
- synthetic benchmark маркируется как synthetic;
- модель не считается улучшенной без заранее заданных metrics.

## Engineering gates

Каждый D milestone требует:

- pure unit tests;
- PostgreSQL integration tests;
- OpenAPI coverage;
- privacy assertions;
- frontend states;
- migration drift check;
- typecheck/lint/build;
- one reproducible end-to-end scenario;
- model/version documentation.

---

# 20. Приоритет от текущего момента

Следующая работа выполняется строго так:

1. D0 normal-mode golden seed.
2. D0 live Vertex proof или явное fallback решение.
3. D0 regression fixture.
4. D0 model card и judge runbook.
5. Submission freeze.
6. После хакатона — D1 observation/snapshot foundation.
7. Затем D2 offline calibration и adaptive policy v2.
8. Только затем D3 cohort intelligence.

Главное правило ближайших часов:

> Не строить новую DS-модель, пока существующий personal adaptive loop не доказан
> в normal mode и не упакован в воспроизводимый judge flow.
