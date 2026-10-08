import pytest
from dotenv import dotenv_values
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


test_settings = dotenv_values(".env.test")

TEST_DATABASE_URL = test_settings.get("TEST_DATABASE_URL")

if not TEST_DATABASE_URL:
    raise RuntimeError(
        "TEST_DATABASE_URL is not set. "
        "Integration tests require a separate test database."
    )


@pytest.fixture
def db():
    engine = create_engine(
        TEST_DATABASE_URL,
        pool_pre_ping=True,
    )

    TestingSessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
    )

    session = TestingSessionLocal()

    try:
        # Start every test with a completely clean database.
        session.execute(
            text(
                """
                DO $$
                DECLARE
                    r RECORD;
                BEGIN
                    FOR r IN
                        SELECT tablename
                        FROM pg_tables
                        WHERE schemaname = 'public'
                          AND tablename <> 'alembic_version'
                    LOOP
                        EXECUTE
                            'TRUNCATE TABLE public.'
                            || quote_ident(r.tablename)
                            || ' RESTART IDENTITY CASCADE';
                    END LOOP;
                END
                $$;
                """
            )
        )
        session.commit()

        yield session

    finally:
        session.rollback()
        session.close()
        engine.dispose()