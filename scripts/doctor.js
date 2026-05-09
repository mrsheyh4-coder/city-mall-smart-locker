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
    markWarning(
      'Prisma generate skipped because a running backend is locking the Prisma engine DLL',
    );
    markWarning('Stop backend and run npm run doctor again if Prisma client changed');
    return true;
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

    ok('Frontend is serving successfully');
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
