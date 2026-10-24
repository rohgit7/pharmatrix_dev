from __future__ import annotations

from datetime import date, datetime, time as dt_time, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi import HTTPException, status

# Authoritative business timezone for Pharmatrix operations
BUSINESS_TIMEZONE_STR = "Asia/Kolkata"
BUSINESS_TIMEZONE = ZoneInfo(BUSINESS_TIMEZONE_STR)

_override_planning_date: date | None = None


def set_planning_date_override(d: date | None) -> None:
    """Useful in integration testing to evaluate specific operational calendar dates."""
    global _override_planning_date
    _override_planning_date = d


def get_business_timezone() -> ZoneInfo:
    return BUSINESS_TIMEZONE


def get_business_now() -> datetime:
    """Current timestamp in the configured business timezone."""
    return datetime.now(timezone.utc).astimezone(BUSINESS_TIMEZONE)


def get_today_business_date() -> date:
    """Current calendar date D in the configured business timezone."""
    return get_business_now().date()


def get_operational_planning_date() -> date:
    """
    Authoritative operational planning date D+1 (tomorrow) in Asia/Kolkata.
    All daily route optimization, pickup selection, and dispatch planning
    workflows strictly operate on this date.
    """
    if _override_planning_date is not None:
        return _override_planning_date
    return get_today_business_date() + timedelta(days=1)


def get_planning_date_bounds(planning_date: date | None = None) -> tuple[datetime, datetime]:
    """
    Returns (start_dt, end_dt) spanning [00:00:00, 23:59:59.999999] in business timezone,
    converted to timezone-aware datetimes.
    """
    if planning_date is None:
        planning_date = get_operational_planning_date()
    start = datetime.combine(planning_date, dt_time.min, tzinfo=BUSINESS_TIMEZONE)
    end = start + timedelta(days=1)
    return start, end


def normalize_to_business_date(dt_or_d: datetime | date | str | None) -> date | None:
    """Converts any date, datetime, or ISO string to calendar date in Asia/Kolkata."""
    if dt_or_d is None:
        return None
    if isinstance(dt_or_d, str):
        try:
            # Handle ISO string or simple YYYY-MM-DD
            if "T" in dt_or_d:
                parsed = datetime.fromisoformat(dt_or_d.replace("Z", "+00:00"))
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=BUSINESS_TIMEZONE)
                return parsed.astimezone(BUSINESS_TIMEZONE).date()
            return date.fromisoformat(dt_or_d[:10])
        except Exception:
            return None
    if isinstance(dt_or_d, datetime):
        if dt_or_d.tzinfo is None:
            dt_or_d = dt_or_d.replace(tzinfo=BUSINESS_TIMEZONE)
        return dt_or_d.astimezone(BUSINESS_TIMEZONE).date()
    if isinstance(dt_or_d, date):
        return dt_or_d
    return None


def validate_is_operational_planning_date(
    route_date: datetime | date | str,
    action_description: str = "Route planning and optimization",
) -> date:
    """
    Backend validation enforcing that operational workflows run strictly on D+1 (tomorrow).
    Rejects any past, today, or arbitrary future date submissions.
    """
    planning_date = get_operational_planning_date()
    normalized = normalize_to_business_date(route_date)

    if normalized is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{action_description} requires a valid route date format.",
        )

    today = get_today_business_date()
    if normalized < today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"{action_description} cannot operate on past dates ({normalized}). "
                f"Next-day operational cycle planning date is {planning_date} ({BUSINESS_TIMEZONE_STR})."
            ),
        )
    if normalized == today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"{action_description} cannot operate on today's date ({normalized}). "
                f"The daily operational cycle operates strictly on tomorrow's date ({planning_date} in {BUSINESS_TIMEZONE_STR})."
            ),
        )
    if normalized != planning_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"{action_description} is restricted to the next calendar day ({planning_date} in {BUSINESS_TIMEZONE_STR}). "
                f"Received requested date {normalized}."
            ),
        )

    return normalized
