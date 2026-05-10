# Database backup and rollback

The application code can be redeployed or rolled back, but PostgreSQL must stay persistent. Do not reset or delete the production database during deploy.

## Safe deploy rule

Allowed in production:

```bash
prisma migrate deploy
```

Never run in production:

```bash
prisma migrate reset
docker compose down -v
DROP DATABASE
```

## Manual backup

From the project root:

```bash
npm run backup:db
```

The script reads `backend/.env` or environment `DATABASE_URL`, creates a SQL dump in:

```text
backups/postgres/
```

It keeps the last 7 days by default. Change retention when needed:

```powershell
$env:BACKUP_KEEP_DAYS="14"; npm run backup:db
```

The server must have PostgreSQL client tools installed so `pg_dump` is available. On Windows, if PostgreSQL is installed but `pg_dump` is not in PATH, point to it explicitly:

```powershell
$env:PG_DUMP_PATH="C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
npm run backup:db
```

If Docker Desktop is available, the script can also use a temporary `postgres:16-alpine` container as fallback.

## Daily Windows schedule

Open PowerShell as Administrator and run:

```powershell
$project = "F:\city mall praeekt\smart-locker-system"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$project\scripts\backup-postgres.ps1`""
$trigger = New-ScheduledTaskTrigger -Daily -At 03:00
Register-ScheduledTask -TaskName "CityMallSmartLockerDailyBackup" -Action $action -Trigger $trigger -Description "Daily PostgreSQL backup for City Mall Smart Locker" -User $env:USERNAME
```

## Restore

Restore only when you are sure which database must be overwritten.

```bash
psql "postgresql://USER:PASSWORD@HOST:5432/locker_system?schema=public" < backups/postgres/locker_system_YYYY-MM-DD_HH-MM-SS.sql
```

For production incidents, prefer this order:

1. Roll back only backend/frontend code.
2. Keep PostgreSQL untouched.
3. Restore a backup only if the database itself is corrupted or wrong data was written.

## Storage guidance

For demo or trial hosting, daily backup with 7-day retention is enough. Hourly backup is not required unless the system is already used by real customers.
