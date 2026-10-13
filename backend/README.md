```markdown
# Pharmatrix Backend

Backend API for Pharmatrix, built with FastAPI and PostgreSQL.

## Tech Stack

- Python 3.12
- FastAPI
- SQLAlchemy
- PostgreSQL
- Alembic
- Supabase
- Pydantic
- Docker
- Pytest
- Uvicorn

## Project Structure

```text
backend/
├── app/
│   ├── api/              # API routes
│   ├── core/             # Configuration, database, logging
│   ├── events/           # Application events
│   ├── models/           # SQLAlchemy models
│   ├── notifications/    # Notification functionality
│   ├── optimizer/        # Route optimization
│   ├── schemas/          # Pydantic schemas
│   ├── services/         # Business logic
│   ├── workers/          # Background processing
│   └── main.py           # FastAPI application
│
├── migrations/
│   └── versions/         # Alembic migrations
│
├── tests/                # Test suite
├── Dockerfile
├── alembic.ini
├── requirements.txt
└── README.md
```

## Local Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd backend
```

### 2. Create a virtual environment

Windows:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

Linux/macOS:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a `.env` file:

```env
APP_NAME=Pharmatrix
APP_ENV=development
DEBUG=False

DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE

SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SECRET_KEY

SUPABASE_STORAGE_BUCKET=customer-documents
SUPABASE_PICKUP_PROOF_BUCKET=pickup-proofs
SUPABASE_DISPOSAL_CERTIFICATE_BUCKET=disposal-certificates

OSRM_BASE_URL=

SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=Pharmatrix
SMTP_USE_TLS=True

WHATSAPP_PROVIDER=
WHATSAPP_API_URL=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WABA_ID=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_GRAPH_VERSION=v23.0

CORS_ORIGINS=http://localhost:3000
```

Never commit `.env` or production secrets.

## Database Migrations

Check the current migration:

```bash
alembic current
```

Check available heads:

```bash
alembic heads
```

Apply migrations:

```bash
alembic upgrade head
```

Create a new migration:

```bash
alembic revision --autogenerate -m "description"
```

Review generated migrations before applying them.

## Run Locally

Start the API with:

```bash
uvicorn app.main:app --reload
```

The API will be available at:

```text
http://localhost:8000
```

## Health Checks

API health:

```text
GET /health
```

Database health:

```text
GET /health/db
```

## API Documentation

FastAPI automatically provides interactive documentation.

Swagger UI:

```text
http://localhost:8000/docs
```

OpenAPI schema:

```text
http://localhost:8000/openapi.json
```

## Testing

Run the complete test suite:

```bash
pytest -q
```

Show slow tests:

```bash
pytest -q --durations=20
```

## Docker

Build the backend image:

```bash
docker build -t pharmatrix-backend .
```

Run the container:

```bash
docker run --env-file .env -p 8000:8000 pharmatrix-backend
```

The application will then be available at:

```text
http://localhost:8000
```

The backend uses PostgreSQL/Supabase as its database. PostgreSQL is not included in the Docker image.

## Production Migration

Before starting a new application version in production:

```bash
alembic upgrade head
```

Then start the application:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## CI

GitHub Actions runs the test suite on pushes and pull requests targeting:

- `main`
- `develop`

Required GitHub Actions secrets:

```text
DATABASE_URL
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

## Security

- Secrets must be provided through environment variables.
- `.env` files must not be committed.
- Production databases should use secure credentials and encrypted connections.
- API access should use the configured authentication and RBAC mechanisms.
- Database migrations must be reviewed before production deployment.

## License

Private project. All rights reserved.
