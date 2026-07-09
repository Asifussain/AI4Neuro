from fastapi.testclient import TestClient

from app.main import create_app


def test_health_ok():
    with TestClient(create_app()) as client:
        res = client.get("/api/v1/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"


def test_health_database_not_configured():
    with TestClient(create_app()) as client:
        res = client.get("/api/v1/health/database")
        assert res.status_code == 200
        # No Supabase configured in the test env.
        assert res.json()["configured"] is False


def test_root_banner():
    with TestClient(create_app()) as client:
        res = client.get("/")
        assert res.status_code == 200
        assert res.json()["api"] == "/api/v1"
