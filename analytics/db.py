"""Shared database utilities for the analytics engine.

Both ``generate_mock_data.py`` and ``forecast.py`` talk to the *same* PostgreSQL
database that the Next.js/Prisma app uses. The single source of truth for the
connection is ``frontend/.env`` (``DATABASE_URL``).

Prisma decorates its connection string with a ``?schema=public`` query parameter
that libpq (and therefore psycopg) does not understand, so we normalise the URL
before handing it to psycopg and set the search_path explicitly instead.
"""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import parse_qs, urlsplit, urlunsplit

import psycopg
from dotenv import load_dotenv

# analytics/db.py -> project root is one level up.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_ENV = PROJECT_ROOT / "frontend" / ".env"


def _load_database_url() -> tuple[str, str]:
    """Return ``(conninfo, search_path)`` derived from ``DATABASE_URL``.

    Raises a clear error if the variable is missing or still a placeholder.
    """
    # Load frontend/.env first, then fall back to the process environment.
    if FRONTEND_ENV.exists():
        load_dotenv(FRONTEND_ENV)
    load_dotenv()  # also honour a local analytics/.env if present

    raw = os.environ.get("DATABASE_URL")
    if not raw:
        raise RuntimeError(
            f"DATABASE_URL is not set. Add it to {FRONTEND_ENV} (or the "
            "environment) pointing at your PostgreSQL instance."
        )
    if "CHANGE_ME" in raw:
        raise RuntimeError(
            "DATABASE_URL still contains the placeholder password 'CHANGE_ME'. "
            f"Edit {FRONTEND_ENV} with your real PostgreSQL credentials."
        )

    parts = urlsplit(raw)
    query = parse_qs(parts.query)
    search_path = query.get("schema", ["public"])[0]

    # Strip the Prisma-only query string; psycopg/libpq rejects `schema`.
    conninfo = urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
    return conninfo, search_path


def connect() -> psycopg.Connection:
    """Open a psycopg connection with the correct search_path applied."""
    conninfo, search_path = _load_database_url()
    conn = psycopg.connect(conninfo)
    with conn.cursor() as cur:
        # Identifiers can't be parameterised; search_path comes from our own URL.
        cur.execute(f'SET search_path TO "{search_path}"')
    conn.commit()
    return conn
