from fastapi.testclient import TestClient

from app.errors import AppError
from app.main import create_app


def test_health_check():
    app = create_app()
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_app_error_response_format():
    app = create_app()

    @app.get("/api/test-app-error")
    def trigger_app_error():
        raise AppError("PLAYLIST_NOT_FOUND", "No playlist found", {"sample_id": "123"})

    client = TestClient(app)
    response = client.get("/api/test-app-error")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "PLAYLIST_NOT_FOUND"
    assert data["error"]["message"] == "No playlist found"
    assert data["error"]["details"] == {"sample_id": "123"}


def test_internal_error_does_not_leak_details():
    app = create_app()

    @app.get("/api/test-internal-error")
    def trigger_internal():
        raise RuntimeError("Secret DB connection string leaked!")

    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/api/test-internal-error")
    assert response.status_code == 500
    data = response.json()
    assert data["error"]["code"] == "INTERNAL_ERROR"
    assert "Secret DB connection string" not in data["error"]["message"]
