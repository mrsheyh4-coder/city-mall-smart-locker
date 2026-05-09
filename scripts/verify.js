const path = require('node:path');
const { spawn } = require('node:child_process');
const { fail, getPidOnPort, log, ok, rootDir, run, warn } = require('./shared');

const checks = [
  {
    name: 'Backend lint',
    command: 'npm',
    args: ['run', 'lint'],
    cwd: path.join(rootDir, 'backend'),
  },
  {
    name: 'Backend build',
    command: 'npm',
    args: ['run', 'build'],
    cwd: path.join(rootDir, 'backend'),
  },
  {
    name: 'Backend e2e tests',
    command: 'npm',
    args: ['run', 'test:e2e'],
    cwd: path.join(rootDir, 'backend'),
  },
  {
    name: 'Frontend lint',
    command: 'npm',
    args: ['run', 'lint'],
    cwd: path.join(rootDir, 'frontend'),
  },
  {
    name: 'Frontend build',
    command: 'npm',
    args: ['run', 'build'],
    cwd: path.join(rootDir, 'frontend'),
  },
];

let hasFailure = false;
let stoppedFrontendForBuild = false;

log('Smart Locker verify started\n');

for (const check of checks) {
  if (check.name === 'Frontend build') {
    stopFrontendBeforeBuild();
  }

  log(`Running: ${check.name}`);
  const result = run(check.command, check.args, { cwd: check.cwd });

  if (result.ok) {
    ok(check.name);
  } else {
    fail(check.name);
    hasFailure = true;
  }

  log('');
}

if (hasFailure) {
  fail('Verify completed with errors');
  restartFrontendAfterBuild();
  process.exit(1);
}

ok('Verify completed successfully');
restartFrontendAfterBuild();

function stopFrontendBeforeBuild() {
  const frontendPid = getPidOnPort(3000);

  if (!frontendPid) {
    return;
  }

  try {
    process.kill(frontendPid, 'SIGTERM');
    stoppedFrontendForBuild = true;
    warn(`Stopped frontend dev server before build (pid ${frontendPid})`);
  } catch {
    warn(`Could not stop frontend dev server before build (pid ${frontendPid})`);
  }
}

function restartFrontendAfterBuild() {
  if (!stoppedFrontendForBuild) {
    return;
  }

  if (process.platform === 'win32') {
    run(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory '${path.join(rootDir, 'frontend')}' -WindowStyle Hidden`,
      ],
      { silent: true },
    );
    ok('Restarted frontend dev server after verify');
    return;
  }

  const child = spawn('npm', ['run', 'dev'], {
    cwd: path.join(rootDir, 'frontend'),
    detached: true,
    stdio: 'ignore',
  });

  child.unref();
  ok('Restarted frontend dev server after verify');
}
