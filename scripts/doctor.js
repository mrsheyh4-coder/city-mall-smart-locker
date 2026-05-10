const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('./../backend/node_modules/pg');
const {
  fail,
  getPidOnPort,
  log,
  ok,
  readEnvFile,
  requestJson,
  rootDir,
  run,
  waitForPort,
  warn,
} = require('./shared');

const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');
const backendEnvPath = path.join(backendDir, '.env');
const frontendCachePath = path.join(frontendDir, '.next');
const prismaClientPath = path.join(backendDir, 'node_modules', '.prisma', 'client', 'index.js');
const apiHeaders = { 'X-API-Version': '1' };

let failures = 0;
let warnings = 0;

function markFailure(message) {
  failures += 1;
  fail(message);
}

function markWarning(message) {
  warnings += 1;
  warn(message);
}

async function checkEnv() {
  log('\nEnvironment');

  if (!fs.existsSync(backendEnvPath)) {
    markFailure('backend/.env is missing');
    return null;
  }

  const env = readEnvFile(backendEnvPath);

  if (!env.DATABASE_URL) {
    markFailure('DATABASE_URL is missing in backend/.env');
    return null;
  }

  try {
    const parsed = new URL(env.DATABASE_URL);
    ok(`DATABASE_URL parsed for ${parsed.hostname}:${parsed.port || '5432'}`);
  } catch {
    markFailure('DATABASE_URL is not a valid PostgreSQL URL');
    return null;
  }

  ok('backend/.env is present');
  return env;
}

async function checkDatabase(databaseUrl) {
  log('\nPostgreSQL');
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    const result = await client.query(
      'select current_database() as database, current_user as user',
    );
    ok(
      `Connected to ${result.rows[0].database} as ${result.rows[0].user}`,
    );
  } catch (error) {
    markFailure(`PostgreSQL connection failed: ${error.message}`);
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }

  return true;
}

function checkPrismaGenerate() {
  log('\nPrisma');
  const result = run('npm', ['run', 'prisma:generate'], {
    cwd: backendDir,
    silent: true,
  });

  if (result.ok) {
    ok('Prisma client generated');
    return true;
  }

  const output = `${result.stderr}\n${result.stdout}`;

  if (output.includes('EPERM') && output.includes('query_engine-windows')) {
    const backendPid = getPidOnPort(4000);

    if (fs.existsSync(prismaClientPath)) {
      const pidDetail = backendPid ? ` (backend pid ${backendPid})` : '';
      ok(`Prisma client is available; engine DLL is locked by a running Node process${pidDetail}`);
      return true;
    }

    markFailure('Prisma generate failed because the Prisma engine DLL is locked and no generated client was found');
    return false;
  }

  markFailure(`Prisma generate failed\n${result.stderr || result.stdout}`);
  return false;
}

function checkMigrationStatus() {
  const result = run('npx', ['prisma', 'migrate', 'status'], {
    cwd: backendDir,
    silent: true,
  });
  const output = `${result.stdout}\n${result.stderr}`;

  if (result.ok && output.includes('Database schema is up to date')) {
    ok('Prisma migrations are up to date');
    return true;
  }

  markWarning('Prisma migrations may not be up to date');
  log(output.trim());

  const deploy = run('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: backendDir,
    silent: true,
  });

  if (deploy.ok) {
    ok('Prisma migrate deploy completed');
    return true;
  }

  markFailure(`Prisma migrate deploy failed\n${deploy.stderr || deploy.stdout}`);
  return false;
}

async function checkSeed(databaseUrl) {
  log('\nData seed');
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    const result = await client.query('select count(*)::int as count from lockers');
    const count = result.rows[0].count;

    if (count >= 60) {
      ok(`Locker seed is healthy (${count} lockers)`);
      return true;
    }

    markWarning(`Only ${count} lockers found; backend startup should seed missing lockers`);
    return false;
  } catch (error) {
    markFailure(`Locker seed check failed: ${error.message}`);
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function checkDataConsistency(databaseUrl) {
  log('\nData consistency');
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    const activeLockerMismatches = await client.query(`
      select l.number, l.status
      from lockers l
      where l.status in ('OCCUPIED', 'RESERVED')
        and not exists (
          select 1
          from bookings b
          where b."lockerId" = l.id
            and b.status = 'ACTIVE'
            and b."expiresAt" > now()
        )
      order by l.number
      limit 8
    `);

    if (activeLockerMismatches.rowCount > 0) {
      markWarning(
        `Found ${activeLockerMismatches.rowCount} occupied/reserved locker(s) without a live active booking: ${formatLockerRows(activeLockerMismatches.rows)}`,
      );
    } else {
      ok('Occupied/reserved lockers have live active bookings');
    }

    const completedAccessMismatches = await client.query(`
      select distinct l.number
      from lockers l
      join access_codes ac on ac."lockerId" = l.id
      join bookings b on b.id = ac."bookingId"
      where ac."usedAt" is not null
        and b.status = 'ACTIVE'
        and l.status in ('OCCUPIED', 'RESERVED')
      order by l.number
      limit 8
    `);

    if (completedAccessMismatches.rowCount > 0) {
      markFailure(
        `Access was already used but booking/locker is still active: ${formatLockerRows(completedAccessMismatches.rows)}`,
      );
    } else {
      ok('Used access codes do not leave lockers active');
    }

    const availableOpenLockers = await client.query(`
      select number
      from lockers
      where status = 'AVAILABLE'
        and "isOpen" = true
      order by number
      limit 8
    `);

    if (availableOpenLockers.rowCount > 0) {
      markFailure(
        `Available locker(s) are still marked open: ${formatLockerRows(availableOpenLockers.rows)}`,
      );
    } else {
      ok('Available lockers are closed');
    }

    const activeBookingMismatches = await client.query(`
      select l.number, l.status
      from bookings b
      join lockers l on l.id = b."lockerId"
      where b.status = 'ACTIVE'
        and b."expiresAt" > now()
        and l.status not in ('OCCUPIED', 'RESERVED')
      order by l.number
      limit 8
    `);

    if (activeBookingMismatches.rowCount > 0) {
      markFailure(
        `Live active booking exists but locker is not occupied/reserved: ${formatLockerRows(activeBookingMismatches.rows)}`,
      );
    } else {
      ok('Live active bookings match locker status');
    }
  } catch (error) {
    markFailure(`Data consistency check failed: ${error.message}`);
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }

  return true;
}

function formatLockerRows(rows) {
  return rows
    .map((row) => `L-${String(row.number).padStart(2, '0')}${row.status ? `/${row.status}` : ''}`)
    .join(', ');
}

async function checkBackendApi() {
  log('\nBackend API');
  const backendPid = getPidOnPort(4000);

  if (!backendPid) {
    markWarning('Backend is not currently listening on port 4000');
    return false;
  }

  ok(`Backend process detected on port 4000 (pid ${backendPid})`);

  try {
    const response = await requestJson('http://localhost:4000/api/lockers', apiHeaders);

    if (response.statusCode !== 200) {
      markFailure(`Backend API returned HTTP ${response.statusCode}`);
      return false;
    }

    if (!response.body?.meta || response.body.meta.total < 60) {
      markFailure('Backend API response does not include 60 lockers');
      return false;
    }

    ok(`Backend API healthy (${response.body.meta.total} lockers)`);

    const health = await requestJson('http://localhost:4000/api/health', apiHeaders);
    if (health.statusCode !== 200 || health.body?.status !== 'ok') {
      markFailure(`Backend health returned HTTP ${health.statusCode}`);
      return false;
    }

    ok('Backend health endpoint is healthy');

    const tariffs = await requestJson('http://localhost:4000/api/tariffs', apiHeaders);
    if (tariffs.statusCode !== 200 || !Array.isArray(tariffs.body)) {
      markFailure(`Backend tariffs returned HTTP ${tariffs.statusCode}`);
      return false;
    }

    ok(`Backend tariffs endpoint healthy (${tariffs.body.length} tariff(s))`);
    return true;
  } catch (error) {
    markFailure(`Backend API request failed: ${error.message}`);
    return false;
  }
}

async function checkFrontend() {
  log('\nFrontend');
  const frontendPid = getPidOnPort(3000);

  if (!frontendPid) {
    markWarning('Frontend is not currently listening on port 3000');
    return false;
  }

  ok(`Frontend process detected on port 3000 (pid ${frontendPid})`);

  try {
    await waitForPort(3000, 'localhost', 2000);
    const response = await requestJsonLikeText('http://localhost:3000');

    if (response.statusCode !== 200) {
      markFailure(`Frontend returned HTTP ${response.statusCode}`);
      return false;
    }

    if (response.body.includes('Cannot find module') && response.body.includes('.next')) {
      markWarning('Frontend appears to have a stale .next cache error');
      markWarning('Run npm run fix:frontend-cache, then npm run dev:frontend');
      return false;
    }

    const routeResults = await Promise.all(
      ['terminal', 'login', 'dashboard'].map(async (route) => ({
        route,
        response: await requestJsonLikeText(`http://localhost:3000/${route}`),
      })),
    );

    const failedRoute = routeResults.find((item) => item.response.statusCode !== 200);
    if (failedRoute) {
      markFailure(`Frontend /${failedRoute.route} returned HTTP ${failedRoute.response.statusCode}`);
      return false;
    }

    ok('Frontend is serving core pages successfully');
    return true;
  } catch (error) {
    markFailure(`Frontend request failed: ${error.message}`);
    return false;
  }
}

function requestJsonLikeText(url) {
  const http = require('node:http');

  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = '';

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        resolve({ statusCode: response.statusCode, body });
      });
    });

    request.on('error', reject);
    request.setTimeout(10000, () => {
      request.destroy(new Error(`Request timed out: ${url}`));
    });
  });
}

function checkFrontendCacheFolder() {
  if (!fs.existsSync(frontendCachePath)) {
    ok('Frontend .next cache is currently absent or clean');
    return;
  }

  const serverDir = path.join(frontendCachePath, 'server');

  if (!fs.existsSync(serverDir)) {
    markWarning('Frontend .next cache exists but server output is missing');
    return;
  }

  ok('Frontend .next cache folder exists');
}

async function main() {
  log('Smart Locker Doctor started');

  const env = await checkEnv();

  if (env?.DATABASE_URL) {
    const dbOk = await checkDatabase(env.DATABASE_URL);

    if (dbOk) {
      checkPrismaGenerate();
      checkMigrationStatus();
      await checkSeed(env.DATABASE_URL);
      await checkDataConsistency(env.DATABASE_URL);
    }
  }

  await checkBackendApi();
  checkFrontendCacheFolder();
  await checkFrontend();

  log('\nSummary');

  if (failures === 0 && warnings === 0) {
    ok('System is healthy');
    return;
  }

  if (failures === 0) {
    warn(`Doctor completed with ${warnings} warning(s)`);
    return;
  }

  fail(`Doctor completed with ${failures} failure(s) and ${warnings} warning(s)`);
  process.exit(1);
}

main().catch((error) => {
  fail(error.message);
  process.exit(1);
});
