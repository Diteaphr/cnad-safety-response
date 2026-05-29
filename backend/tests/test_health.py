def test_live_check_is_lightweight(client):
    resp = client.get("/live")

    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "app": "ok"}


def test_health_check_reports_ready_dependencies(client):
    resp = client.get("/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["app"] == "ok"
    assert body["database"] == "ok"
    # Redis may be explicitly enabled in the test container; when disabled we expect "skipped".
    assert body["redis"] in {"skipped", "ok"}


def test_ready_check_matches_health_contract(client):
    resp = client.get("/ready")

    assert resp.status_code == 200
    assert resp.json()["database"] == "ok"
    assert resp.json()["redis"] in {"skipped", "ok"}


def test_database_health_check_includes_database_context(client):
    resp = client.get("/health/db")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["database"]["status"] == "ok"
    assert body["database"]["name"] == "employee_safety_test"
    assert body["database"]["schema"] == "public"


def test_deep_health_check_flags_missing_migration_table(client):
    resp = client.get("/health/deep")

    assert resp.status_code == 503
    body = resp.json()
    assert body["status"] == "error"
    assert body["database"] == "ok"
    assert body["schema"]["missing_tables"] == []
    assert body["migration"]["alembic_version"] == "missing"
