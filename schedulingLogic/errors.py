from __future__ import annotations

from typing import Any, Literal

from fastapi.responses import JSONResponse


NO_CANDIDATES_FOUND = "NO_CANDIDATES_FOUND"
UNSATISFIABLE_CONSTRAINTS = "UNSATISFIABLE_CONSTRAINTS"
DATABASE_CONNECTION_FAILED = "DATABASE_CONNECTION_FAILED"
INVALID_PAYLOAD = "INVALID_PAYLOAD"
SOLVER_FAILED = "SOLVER_FAILED"

SchedulerErrorCode = Literal[
    "NO_CANDIDATES_FOUND",
    "UNSATISFIABLE_CONSTRAINTS",
    "DATABASE_CONNECTION_FAILED",
    "INVALID_PAYLOAD",
    "SOLVER_FAILED",
]

ERROR_MESSAGES: dict[SchedulerErrorCode, str] = {
    NO_CANDIDATES_FOUND: "No candidate sections were found for the requested schedule.",
    UNSATISFIABLE_CONSTRAINTS: "The requested schedule constraints cannot be satisfied.",
    DATABASE_CONNECTION_FAILED: "The scheduler could not connect to the database.",
    INVALID_PAYLOAD: "The scheduler request payload is invalid.",
    SOLVER_FAILED: "The scheduler solver failed to produce a schedule.",
}

ERROR_STATUS_CODES: dict[SchedulerErrorCode, int] = {
    NO_CANDIDATES_FOUND: 404,
    UNSATISFIABLE_CONSTRAINTS: 409,
    DATABASE_CONNECTION_FAILED: 503,
    INVALID_PAYLOAD: 400,
    SOLVER_FAILED: 500,
}


def error_body(
    code: SchedulerErrorCode,
    *,
    message: str | None = None,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message or ERROR_MESSAGES[code],
        }
    }

    if details:
        body["error"]["details"] = details

    return body


def error_response(
    code: SchedulerErrorCode,
    *,
    status_code: int | None = None,
    message: str | None = None,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code or ERROR_STATUS_CODES[code],
        content=error_body(code, message=message, details=details),
    )


__all__ = [
    "DATABASE_CONNECTION_FAILED",
    "ERROR_MESSAGES",
    "ERROR_STATUS_CODES",
    "INVALID_PAYLOAD",
    "NO_CANDIDATES_FOUND",
    "SOLVER_FAILED",
    "SchedulerErrorCode",
    "UNSATISFIABLE_CONSTRAINTS",
    "error_body",
    "error_response",
]
