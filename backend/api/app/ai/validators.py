"""Deterministic validation for AI-generated structures."""

from collections import Counter

from app.ai.schemas import BlueprintDraft, GeneratedMock


def validate_blueprint(
    draft: BlueprintDraft, *, allowed_chunk_ids: set[str]
) -> list[dict[str, str]]:
    errors: list[dict[str, str]] = []
    section_ids = [item.id for item in draft.sections]
    duplicates = [item for item, count in Counter(section_ids).items() if count > 1]
    if duplicates:
        errors.append({"path": "sections", "message": f"Duplicate IDs: {duplicates}"})
    skill_ids = {item.id for item in draft.skill_taxonomy}
    if len(skill_ids) != len(draft.skill_taxonomy):
        errors.append({"path": "skill_taxonomy", "message": "Skill IDs must be unique"})
    for index, section in enumerate(draft.sections):
        unknown_skills = sorted(set(section.skills) - skill_ids)
        if unknown_skills:
            errors.append(
                {
                    "path": f"sections.{index}.skills",
                    "message": f"Unknown skills: {unknown_skills}",
                }
            )
        invalid_refs = sorted(set(section.source_refs) - allowed_chunk_ids)
        if invalid_refs:
            errors.append(
                {
                    "path": f"sections.{index}.source_refs",
                    "message": f"Unknown source refs: {invalid_refs}",
                }
            )
    invalid_rule_refs = sorted(set(draft.rules.source_refs) - allowed_chunk_ids)
    if invalid_rule_refs:
        errors.append(
            {"path": "rules.source_refs", "message": f"Unknown source refs: {invalid_rule_refs}"}
        )
    points = sum(item.points for item in draft.sections)
    duration = sum(item.duration_minutes for item in draft.sections)
    if draft.rules.total_points is not None and draft.rules.total_points != points:
        errors.append(
            {
                "path": "rules.total_points",
                "message": f"Section points sum to {points}, not {draft.rules.total_points}",
            }
        )
    if draft.rules.duration_minutes is not None and draft.rules.duration_minutes != duration:
        errors.append(
            {
                "path": "rules.duration_minutes",
                "message": (
                    f"Section durations sum to {duration}, not {draft.rules.duration_minutes}"
                ),
            }
        )
    return errors


def validate_mock(
    generated: GeneratedMock,
    *,
    blueprint_sections: list[dict[str, object]],
    allowed_chunk_ids: set[str],
    allowed_skill_ids: set[str] | None = None,
    target_skill_ids: set[str] | None = None,
) -> list[str]:
    errors: list[str] = []
    expected = {str(item["id"]): item for item in blueprint_sections}
    actual_counts = Counter(item.section_id for item in generated.questions)
    prompts: set[str] = set()
    for section_id, section in expected.items():
        expected_count = int(str(section.get("questionCount", 0)))
        if actual_counts.get(section_id, 0) != expected_count:
            errors.append(
                f"Section {section_id} needs {expected_count} questions, got "
                f"{actual_counts.get(section_id, 0)}"
            )
        section_questions = [item for item in generated.questions if item.section_id == section_id]
        expected_points = int(str(section.get("points", 0)))
        actual_points = sum(item.points for item in section_questions)
        if actual_points != expected_points:
            errors.append(
                f"Section {section_id} needs {expected_points} points, got {actual_points}"
            )
        expected_type = str(section.get("questionType", "")).strip().casefold()
        for item in section_questions:
            if item.question_type.strip().casefold() != expected_type:
                errors.append(
                    f"Section {section_id} requires question type {section.get('questionType')}"
                )
    for index, item in enumerate(generated.questions):
        if item.section_id not in expected:
            errors.append(f"Question {index + 1} uses unknown section {item.section_id}")
        if allowed_skill_ids is not None:
            invalid_skills = sorted(set(item.skill_ids) - allowed_skill_ids)
            if invalid_skills:
                errors.append(f"Question {index + 1} has unknown skills {invalid_skills}")
        invalid_refs = sorted(set(item.citation_chunk_ids) - allowed_chunk_ids)
        if invalid_refs:
            errors.append(f"Question {index + 1} has invalid citations {invalid_refs}")
        normalized = " ".join(item.prompt.casefold().split())
        if normalized in prompts:
            errors.append(f"Question {index + 1} duplicates another prompt")
        prompts.add(normalized)
        if item.grading_mode == "rubric":
            if item.rubric is None:
                errors.append(f"Question {index + 1} is missing a rubric")
            elif sum(d.max_points for d in item.rubric.dimensions) != item.points:
                errors.append(f"Question {index + 1} rubric points do not match question points")
        if item.grading_mode == "objective" and not item.answer_key.strip():
            errors.append(f"Question {index + 1} is missing an answer key")
    if target_skill_ids:
        generated_skills = {
            skill_id for question in generated.questions for skill_id in question.skill_ids
        }
        missing_targets = sorted(target_skill_ids - generated_skills)
        if missing_targets:
            errors.append(f"Adaptive mock does not cover target skills {missing_targets}")
    return errors
