"""Public API contract smoke tests."""

from fastapi.testclient import TestClient


def test_main_crud_paths_are_documented(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()

    assert "/api/v1/auth/register" in schema["paths"]
    assert "/api/v1/auth/login" in schema["paths"]
    assert "/api/v1/auth/refresh" in schema["paths"]
    assert "/api/v1/auth/logout" in schema["paths"]
    assert "/api/v1/me" in schema["paths"]
    assert set(schema["paths"]["/api/v1/workspaces"]) >= {"get", "post"}
    assert set(schema["paths"]["/api/v1/workspaces/{workspace_id}"]) >= {
        "get",
        "patch",
        "delete",
    }
    assert set(schema["paths"]["/api/v1/subjects"]) >= {"get", "post"}
    assert set(schema["paths"]["/api/v1/subjects/{subject_id}"]) >= {
        "get",
        "patch",
        "delete",
    }
    assert set(schema["paths"]["/api/v1/subjects/{subject_id}/exams"]) >= {
        "get",
        "post",
    }
    assert set(schema["paths"]["/api/v1/exams/{exam_id}"]) >= {
        "get",
        "patch",
        "delete",
    }
    assert set(schema["paths"]["/api/v1/subjects/{subject_id}/classes"]) >= {
        "get",
        "post",
    }
    assert set(schema["paths"]["/api/v1/classes/{class_id}"]) >= {
        "get",
        "patch",
        "delete",
    }
    assert "post" in schema["paths"]["/api/v1/exams/{exam_id}/mocks"]
    assert "post" in schema["paths"]["/api/v1/mocks/{mock_id}/attempts"]
    assert "put" in schema["paths"]["/api/v1/attempts/{attempt_id}/responses/{question_id}"]
    assert "post" in schema["paths"]["/api/v1/attempts/{attempt_id}/submit"]
    assert "get" in schema["paths"]["/api/v1/exams/{exam_id}/statistics"]
    assert set(schema["paths"]["/api/v1/exams/{exam_id}/publication"]) >= {
        "get",
        "put",
        "delete",
    }
    assert "get" in schema["paths"]["/api/v1/library/publications"]
    assert "get" in schema["paths"]["/api/v1/library/publications/{publication_id}"]
    assert "post" in schema["paths"]["/api/v1/library/publications/{publication_id}/clone"]
    assert set(schema["paths"]["/api/v1/classes/{class_id}/members"]) >= {
        "get",
        "post",
    }
    assert "delete" in schema["paths"]["/api/v1/classes/{class_id}/members/{user_id}"]
    assert "get" in schema["paths"]["/api/v1/classes/{class_id}/dashboard"]
