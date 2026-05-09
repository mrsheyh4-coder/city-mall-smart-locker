const fs = require('node:fs');
const path = require('node:path');
const { getPidOnPort, ok, rootDir, warn } = require('./shared');

const nextDir = path.join(rootDir, 'frontend', '.next');
const frontendPid = getPidOnPort(3000);

if (frontendPid) {
  try {
    process.kill(frontendPid, 'SIGTERM');
    ok(`Stopped frontend process on port 3000 (pid ${frontendPid})`);
  } catch {
    warn(`Could not stop frontend process ${frontendPid}; cache cleanup continues`);
  }
}

if (process.platform === 'win32') {
  try {
    require('node:child_process').execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Get-CimInstance Win32_Process -Filter "name = 'node.exe'" | Where-Object { $_.CommandLine -like '*smart-locker-system*' -and ($_.CommandLine -like '*--prefix frontend*' -or $_.CommandLine -like '*next\\\\dist\\\\bin\\\\next*' -or $_.CommandLine -like '*frontend\\\\node_modules\\\\next*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
      ],
      { stdio: 'ignore' },
    );
  } catch {
    warn('Could not stop all frontend wrapper processes; continuing cache cleanup');
  }
}

if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  ok('Removed frontend/.next cache');
} else {
  ok('frontend/.next cache is already clean');
}

ok('Frontend cache reset complete. Start frontend again with npm run dev:frontend');
