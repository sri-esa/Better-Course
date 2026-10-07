from typing import Any, Dict, Optional


class AppError(Exception):
    STATUS_MAP: Dict[str, int] = {
        "INVALID_URL": 400,
        "VALIDATION_ERROR": 422,
        "PLAYLIST_NOT_FOUND": 404,
        "PLAYLIST_PRIVATE": 403,
        "PLAYLIST_TOO_LARGE": 422,
        "PLAYLIST_EMPTY": 422,
        "YOUTUBE_QUOTA_EXCEEDED": 503,
        "PLAN_NOT_FOUND": 404,
        "PLAN_COMPLETE": 409,
        "RATE_LIMITED": 429,
        "INTERNAL_ERROR": 500,
    }

    def __init__(
        self,
        code: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        status_code: Optional[int] = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}
        self.status_code = status_code or self.STATUS_MAP.get(code, 500)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            }
        }
