# Firewall Analyzer Backend

Backend API for Firewall Optimization Application built with FastAPI and PostgreSQL.

## Setup

1. Create virtual environment:
```bash
python -m venv venv
venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables:
Create `.env` file in the backend directory with:
```
DATABASE_URL=postgresql://username:password@localhost:5432/firewall_analyzer
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

4. Run database migrations:
```bash
alembic upgrade head
```

5. Run the server:
```bash
uvicorn app.main:app --reload
```

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Configuration settings
│   ├── database.py          # Database connection
│   ├── auth/                # Authentication logic
│   ├── models/              # SQLAlchemy models
│   ├── schemas/             # Pydantic schemas
│   ├── routers/             # API routes
│   └── services/            # Business logic
├── alembic/                 # Database migrations
├── requirements.txt
└── .env
```
