const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ok, fail, readEnvFile, rootDir, warn } = require('./shared');

const backupDir = path.join(rootDir, 'backups', 'postgres');
const keepDays = Number(process.env.BACKUP_KEEP_DAYS ?? 7);
const env = {
  ...readEnvFile(path.join(rootDir, 'backend', '.env')),
  ...process.env,
};
const databaseUrl = env.DATABASE_URL;

if (!databaseUrl) {
  fail('DATABASE_URL is missing. Add it to backend/.env or environment variables.');
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, '-')
  .replace('T', '_')
  .slice(0, 19);
const outputPath = path.join(backupDir, `locker_system_${timestamp}.sql`);

const result = runPgDump(databaseUrl, outputPath);

if (!result.ok) {
  fs.rmSync(outputPath, { force: true });
  fail(result.message);
  process.exit(1);
}

cleanupOldBackups();
ok(`PostgreSQL backup created: ${path.relative(rootDir, outputPath)}`);
ok(`Retention: keeping backups from the last ${keepDays} day(s)`);

function runPgDump(url, filePath) {
  const pgDump = findPgDump();
  const direct = pgDump
    ? spawnSync(pgDump, ['--no-owner', '--no-privileges', '--file', filePath, url], {
    cwd: rootDir,
    encoding: 'utf8',
        shell: false,
      })
    : { status: 1, stderr: 'pg_dump was not found in PATH, PG_DUMP_PATH, or common PostgreSQL install folders.' };

  if (direct.status === 0) {
    return { ok: true };
  }

  const docker = spawnSync(
    process.platform === 'win32' ? 'docker.exe' : 'docker',
    [
      'run',
      '--rm',
      '--network',
      'host',
      '-v',
      `${backupDir}:/backup`,
      'postgres:16-alpine',
      'pg_dump',
      '--no-owner',
      '--no-privileges',
      '--file',
      `/backup/${path.basename(filePath)}`,
      url,
    ],
    {
      cwd: rootDir,
      encoding: 'utf8',
      shell: false,
    },
  );

  if (docker.status === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    message:
      'Backup failed. Install pg_dump locally or run Docker Desktop. ' +
      `pg_dump: ${direct.stderr || direct.stdout || 'not available'} ` +
      `docker: ${docker.stderr || docker.stdout || 'not available'}`,
  };
}

function findPgDump() {
  if (process.env.PG_DUMP_PATH && fs.existsSync(process.env.PG_DUMP_PATH)) {
    return process.env.PG_DUMP_PATH;
  }

  if (process.platform !== 'win32') {
    return 'pg_dump';
  }

  const candidates = [
    'C:\\Program Files\\PostgreSQL',
    'C:\\Program Files (x86)\\PostgreSQL',
  ];

  for (const baseDir of candidates) {
    if (!fs.existsSync(baseDir)) {
      continue;
    }

    const versions = fs
      .readdirSync(baseDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => Number(right) - Number(left));

    for (const version of versions) {
      const pgDumpPath = path.join(baseDir, version, 'bin', 'pg_dump.exe');
      if (fs.existsSync(pgDumpPath)) {
        return pgDumpPath;
      }
    }
  }

  return 'pg_dump';
}

function cleanupOldBackups() {
  if (!Number.isFinite(keepDays) || keepDays <= 0) {
    warn('BACKUP_KEEP_DAYS is invalid; old backup cleanup skipped.');
    return;
  }

  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(backupDir);

  files.forEach((file) => {
    if (!file.endsWith('.sql')) {
      return;
    }

    const filePath = path.join(backupDir, file);
    const stat = fs.statSync(filePath);

    if (stat.mtimeMs < cutoff) {
      fs.rmSync(filePath, { force: true });
      warn(`Removed old backup: ${path.relative(rootDir, filePath)}`);
    }
  });
}
