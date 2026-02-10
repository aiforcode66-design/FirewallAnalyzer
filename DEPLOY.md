# FirewallAnalyzer - Deployment Guide (VPS Full Docker)

## Prerequisites
- VPS dengan Docker & Docker Compose terinstall
- IP Public: `103.16.117.173`
- Git terinstall

---

## Quick Deploy

### 1. Clone Repository ke VPS

```bash
ssh user@103.16.117.173
git clone https://github.com/aiforcode66-design/FirewallAnalyzer.git
cd FirewallAnalyzer
```

### 2. Buat File Environment Production

```bash
cat > .env.production << 'EOF'
# Database
DB_USER=postgres
DB_PASSWORD=$(openssl rand -hex 16)
DB_NAME=firewall_analyzer

# Security
SECRET_KEY=$(openssl rand -hex 32)
EOF

# Tampilkan credentials (CATAT dan SIMPAN!)
echo "=== PRODUCTION CREDENTIALS ==="
cat .env.production
echo "=============================="
```

> ⚠️ **SIMPAN** credentials tersebut di tempat aman!

### 3. Backup Database Lokal (dari PC development)

```bash
# Di PC lokal (Windows PowerShell)
pg_dump -h localhost -p 5433 -U postgres firewall_analyzer > backup.sql

# Upload ke VPS
scp backup.sql user@103.16.117.173:~/FirewallAnalyzer/
```

### 4. Start Database & Restore Data

```bash
# Start database saja dulu
docker compose -f docker-compose.prod.yml --env-file .env.production up -d db

# Tunggu sampai ready (lihat log)
docker compose -f docker-compose.prod.yml logs -f db
# Tunggu sampai muncul "ready to accept connections", lalu Ctrl+C

# Restore backup
cat backup.sql | docker exec -i firewall_db psql -U postgres -d firewall_analyzer
```

### 5. Start Semua Service

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

### 6. Verifikasi

```bash
# Cek semua container running
docker compose -f docker-compose.prod.yml ps

# Cek logs
docker compose -f docker-compose.prod.yml logs -f

# Test API
curl http://103.16.117.173/api/dashboard/stats

# Cek database
docker exec firewall_db psql -U postgres -d firewall_analyzer -c '\dt'
```

Buka browser: `http://103.16.117.173` → harus tampil halaman login.

---

## Useful Commands

```bash
# Lihat status
docker compose -f docker-compose.prod.yml ps

# Lihat logs (semua service)
docker compose -f docker-compose.prod.yml logs -f

# Lihat logs (service tertentu)
docker compose -f docker-compose.prod.yml logs -f backend

# Restart semua
docker compose -f docker-compose.prod.yml restart

# Stop semua
docker compose -f docker-compose.prod.yml down

# Rebuild & restart (setelah update code)
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Backup database dari container
docker exec firewall_db pg_dump -U postgres firewall_analyzer > backup_$(date +%Y%m%d).sql
```

---

## Security Setup (Recommended)

```bash
# Setup UFW Firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw enable
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Frontend shows blank page | `docker compose logs frontend` - cek nginx error |
| API returns 502 | Backend belum ready: `docker compose logs backend` |
| Database connection error | `docker compose logs db` - cek healthcheck |
| Data tidak muncul | Pastikan `backup.sql` sudah di-restore dengan benar |
| Upload file gagal | Cek `client_max_body_size` di nginx.conf (default 50M) |
