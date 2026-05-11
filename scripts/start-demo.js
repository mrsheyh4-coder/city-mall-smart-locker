const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { fail, ok, requestJson, rootDir, run, waitForPort } = require('./shared');

const backendLog = path.join(rootDir, 'backend-demo.log');
const frontendLog = path.join(rootDir, 'frontend-demo.log');

function runStep(label, command, args, cwd = rootDir) {
  console.log(`\n${label}`);
  const result = run(command, args, { cwd });
  if (!result.ok) {
    fail(`${label} failed`);
    process.exit(result.status || 1);
  }
  ok(label);
}

function startProcess(label, command, args, logPath, cwd = rootDir) {
  const output = fs.openSync(logPath, 'a');
  const child = spawn(command, args, {
    cwd,
    detached: true,
    shell: false,
    stdio: ['ignore', output, output],
    windowsHide: true,
  });

  child.unref();
  ok(`${label} started (pid ${child.pid}, log ${path.basename(logPath)})`);
}

async function main() {
  stopDemoProcesses();
  runStep('Resetting frontend cache', 'node', ['scripts/reset-frontend-cache.js']);
  runStep('Building backend', 'npm', ['run', 'build', '--prefix', 'backend']);
  runStep('Building static frontend', 'npm', ['run', 'build', '--prefix', 'frontend']);

  fs.writeFileSync(backendLog, '');
  fs.writeFileSync(frontendLog, '');

  startProcess('Backend API', 'node', ['dist/main'], backendLog, path.join(rootDir, 'backend'));
  const backendReady = await waitForPort(4000, 'localhost', 15000);
  if (!backendReady) {
    fail(`Backend did not open port 4000. Check ${backendLog}`);
    process.exit(1);
  }

  startProcess('Static frontend', 'node', ['scripts/serve-frontend-static.js'], frontendLog);
  const frontendReady = await waitForPort(3000, 'localhost', 15000);
  if (!frontendReady) {
    fail(`Frontend did not open port 3000. Check ${frontendLog}`);
    process.exit(1);
  }

  await assertDemoReady();

  ok('Demo mode is ready: http://localhost:3000');
}

async function assertDemoReady() {
  const headers = { 'X-API-Version': '1' };
  const lockers = await requestJson('http://localhost:4000/api/lockers', headers);
  if (lockers.statusCode !== 200 || !lockers.body?.meta?.total) {
    throw new Error('Backend API health check failed');
  }

  const frontend = await requestText('http://localhost:3000/terminal');
  if (frontend.statusCode !== 200 || !frontend.body.includes('<html')) {
    throw new Error('Frontend terminal route health check failed');
  }

  ok(`Backend API healthy (${lockers.body.meta.total} lockers)`);
  ok('Frontend terminal route is serving static HTML');
}

function requestText(url) {
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

function stopDemoProcesses() {
  console.log('\nStopping old local processes');

  if (process.platform !== 'win32') {
    runStep('Stopping old local processes', 'npm', ['run', 'stop:dev']);
    return;
  }

  const script = `
$current = ${process.pid}
$portPids = @(3000, 4000) |
  ForEach-Object {
    Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
  } |
  Where-Object { $_ -and $_ -ne $current }

$knownItems = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
  Where-Object {
    $_.ProcessId -ne $current -and (
      $portPids -contains $_.ProcessId -or
      $_.CommandLine -like '*serve-frontend-static.js*' -or
      $_.CommandLine -like '*dist/main*' -or
      $_.CommandLine -like '*next\\\\dist\\\\bin\\\\next*' -or
      $_.CommandLine -like '*@nestjs\\\\cli*'
    )
  } |
  Sort-Object ProcessId -Unique

foreach ($item in $knownItems) {
  Stop-Process -Id $item.ProcessId -Force -ErrorAction SilentlyContinue
  Write-Output $item.ProcessId
}
`;

  const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
    cwd: rootDir,
    encoding: 'utf8',
  })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (output.length > 0) {
    ok(`Stopped old local processes: ${output.join(', ')}`);
  } else {
    ok('No old local processes were running');
  }
}

main().catch((error) => {
  fail(error.message);
  process.exit(1);
});
