import logging
import time

from fastapi import Request


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


logger = logging.getLogger("pharmatrix.api")


async def log_request(request: Request, call_next):
    start = time.perf_counter()

    try:
        response = await call_next(request)

        duration_ms = (time.perf_counter() - start) * 1000

        logger.info(
            "%s %s | status=%s | duration_ms=%.2f",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )

        return response

    except Exception:
        duration_ms = (time.perf_counter() - start) * 1000

        logger.exception(
            "%s %s | status=500 | duration_ms=%.2f",
            request.method,
            request.url.path,
            duration_ms,
        )

        raise