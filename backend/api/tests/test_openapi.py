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
