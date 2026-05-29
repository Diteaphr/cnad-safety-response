"""Portal schema validators."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.portal import CreateEventIn

pytestmark = pytest.mark.no_db


def test_create_event_in_rejects_custom_type_when_not_other():
    with pytest.raises(ValidationError):
        CreateEventIn(
            title="T",
            type="Earthquake",
            startAt="2026-01-01T00:00:00Z",
            customTypeName="Only for Other",
        )
