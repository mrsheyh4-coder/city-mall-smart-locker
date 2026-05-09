const { execFileSync } = require('node:child_process');
const { ok, warn } = require('./shared');

const projectToken = 'smart-locker-system';
const commandTokens = [
  'dev:backend',
  'dev:frontend',
  'dev:frontend:clean',
  'start:dev --prefix backend',
  'next\\dist\\bin\\next',
  'next\\dist\\server\\lib\\start-server',
  '@nestjs\\cli',
  'backend\\dist\\main',
];

if (process.platform !== 'win32') {
  warn('stop-dev currently only performs process cleanup on Windows.');
  process.exit(0);
}

const conditions = commandTokens
  .map((token) => {
    const escaped = token.replace(/'/g, "''");
    return `$_.CommandLine -like '*${escaped}*'`;
  })
  .join(' -or ');

const script = `
$current = ${process.pid}
$items = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
  Where-Object {
    $_.ProcessId -ne $current -and
    $_.CommandLine -like '*${projectToken}*' -and
    (${conditions})
  }

foreach ($item in $items) {
  Stop-Process -Id $item.ProcessId -Force -ErrorAction SilentlyContinue
  Write-Output $item.ProcessId
}
`;

try {
  const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
    encoding: 'utf8',
  })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (output.length === 0) {
    ok('No Smart Locker dev processes were running');
  } else {
    ok(`Stopped Smart Locker dev processes: ${output.join(', ')}`);
  }
} catch (error) {
  warn(`Could not stop all dev processes: ${error.message}`);
}
