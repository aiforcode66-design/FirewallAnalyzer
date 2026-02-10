# Firewall Analyzer

A full-stack application for analyzing firewall configurations and logs (Cisco ASA, Palo Alto, etc.).
Built with **FastAPI** (Backend), **React** (Frontend), and **PostgreSQL** (Database).

## Prerequisites

- **Docker** and **Docker Compose** installed on your machine.
- (Optional) Python 3.11+ and Node.js 18+ for local development without Docker.

## Quick Start (Docker)

1.  **Clone/Download** this repository.
2.  Open a terminal in the root directory.
3.  Run the following command to build and start all services:

    ```bash
    docker-compose up -d --build
    ```

    *The `--build` flag ensures that any changes to the code are rebuilt into the containers.*

4.  Wait a few moments for the database to initialize and the backend to start.
5.  Access the application:
    - **Frontend (UI)**: [http://localhost:3000](http://localhost:3000)
    - **Backend API**: [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger UI)

## Running with Local Database (Hybrid Mode)

If you prefer to run the Frontend and Backend in Docker but use your **Local PostgreSQL Database** (on Windows host):

1.  Make sure your local PostgreSQL is running on port 5432.
2.  Open `docker-compose.local-db.yml` and check the `DATABASE_URL` line:
    ```yaml
    DATABASE_URL: postgresql://<your_user>:<your_password>@host.docker.internal:5432/<your_db_name>
    ```
    *Update the username, password, and DB name if they differ from defaults.*
3.  Run the following command:

    ```bash
    docker-compose -f docker-compose.local-db.yml up -d --build
    ```

    *This configuration uses `host.docker.internal` to connect to your host machine's database.*

## Backup & Restore

### 1. Backup Codebase
A helper script is provided to zip the entire project (excluding heavy folders like `node_modules` or `venv`).
Run this command in the root directory:

```bash
python create_backup.py
```
This will create a `FirewallAnalyzer_Backup_YYYYMMDD_HHMMSS.zip` file.

### 2. Backup Database (PostgreSQL)
To backup the database running inside Docker:

```bash
# Dump the database to a file on your host machine
docker exec -t firewall_db pg_dump -U postgres firewall_analyzer > db_backup_$(date +%Y%m%d).sql
```

### 3. Restore Database
To restore a backup file (`db_backup.sql`) to the Docker database:

**WARNING: This will overwrite existing data.**

1.  Stop the application usage.
2.  Copy the backup file into the container (optional, or use piping):
    ```bash
    cat db_backup.sql | docker exec -i firewall_db psql -U postgres -d firewall_analyzer
    ```
    *Note: You might need to drop/recreate the DB schema first if there are conflicts.*

## Project Structure

- `backend/`: FastAPI application, Alembic migrations, Python logic.
- `UI_Template/`: React Frontend application (Vite).
- `docker-compose.yml`: Definition of services (db, backend, frontend).
- `create_backup.py`: Utility script for code backups.

## Troubleshooting

- **Database Connection Error**: Ensure the `db` container is healthy. Check logs with `docker-compose logs -f db`.
- **Frontend not loading**: Check if port 3000 is occupied. You can change the port mapping in `docker-compose.yml`.
- **Rebuild**: If you change dependencies (requirements.txt or package.json), you **MUST** rebuild:
    ```bash
    docker-compose up -d --build
    ```
