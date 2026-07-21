"""Startup reconciliation sweep for sessions abandoned by a crash/restart."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _backdate(fake_supabase, session_id: str, when: datetime) -> None:
    for row in fake_supabase.tables["analysis_sessions"]:
        if row["id"] == session_id:
            row["updated_at"] = _iso(when)


def test_list_stale_sessions_only_returns_old_non_terminal_rows(db_service, fake_supabase):
    stale = db_service.create_session(
        modality="eeg", analysis_type="binary", original_filename="a.npy",
        patient_id="11111111-1111-1111-1111-111111111111",
    )
    fresh = db_service.create_session(
        modality="eeg", analysis_type="binary", original_filename="b.npy",
        patient_id="11111111-1111-1111-1111-111111111111",
    )
    completed = db_service.create_session(
        modality="eeg", analysis_type="binary", original_filename="c.npy",
        patient_id="11111111-1111-1111-1111-111111111111",
    )
    db_service.mark_completed(str(completed["id"]))

    old_cutoff_source = datetime.now(timezone.utc) - timedelta(minutes=60)
    _backdate(fake_supabase, str(stale["id"]), old_cutoff_source)
    _backdate(fake_supabase, str(completed["id"]), old_cutoff_source)  # terminal, must stay excluded

    cutoff = _iso(datetime.now(timezone.utc) - timedelta(minutes=30))
    result_ids = {row["id"] for row in db_service.list_stale_sessions(older_than_iso=cutoff)}

    assert result_ids == {str(stale["id"])}
    assert str(fresh["id"]) not in result_ids
    assert str(completed["id"]) not in result_ids


def test_reconcile_stale_sessions_marks_failed_and_logs_event(db_service, fake_supabase, monkeypatch):
    from app import main as main_module

    stale = db_service.create_session(
        modality="mri", analysis_type="multiclass", original_filename="scan.nii.gz",
        patient_id="11111111-1111-1111-1111-111111111111",
    )
    _backdate(fake_supabase, str(stale["id"]), datetime.now(timezone.utc) - timedelta(hours=2))

    monkeypatch.setattr(main_module, "DatabaseService", lambda: db_service)

    main_module._reconcile_stale_sessions()

    session = db_service.get_session(str(stale["id"]))
    assert session["status"] == "failed"
    assert "restart or crash" in session["error_message"]

    events = [
        e for e in fake_supabase.tables.get("job_events", [])
        if e["session_id"] == str(stale["id"])
    ]
    assert any("reconciliation sweep" in e["message"] for e in events)
