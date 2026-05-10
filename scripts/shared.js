const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

function log(message) {
  console.log(message);
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function warn(message) {
  console.log(`[WARN] ${message}`);
}

function fail(message) {
  console.log(`[FAIL] ${message}`);
}

function run(command, args, options = {}) {
  const executable = process.platform === 'win32' && ['npm', 'npx'].includes(command)
    ? `${command}.cmd`
    : command;
  const commandArgs = args ?? [];
  const useShell = process.platform === 'win32';
  const result = spawnSync(
    useShell ? [executable, ...commandArgs.map(quoteArg)].join(' ') : executable,
    useShell ? [] : commandArgs,
    {
    cwd: options.cwd ?? rootDir,
    encoding: 'utf8',
    shell: useShell,
    stdio: options.silent ? 'pipe' : 'inherit',
    },
  );

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function quoteArg(value) {
  if (/^[a-zA-Z0-9:_./\\-]+$/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        return env;
      }

      const separator = trimmed.indexOf('=');

      if (separator === -1) {
        return env;
      }

      const key = trimmed.slice(0, separator).trim();
      const rawValue = trimmed.slice(separator + 1).trim();
      env[key] = rawValue.replace(/^"|"$/g, '');

      return env;
    }, {});
}

function waitForPort(port, host = 'localhost', timeoutMs = 10000) {
  const start = Date.now();

  return new Promise((resolve) => {
    function attempt() {
      const socket = net.createConnection({ host, port });

      socket.once('connect', () => {
        socket.end();
        resolve(true);
      });

      socket.once('error', () => {
        socket.destroy();

        if (Date.now() - start >= timeoutMs) {
          resolve(false);
          return;
        }

        setTimeout(attempt, 300);
      });
    }

    attempt();
  });
}

function requestJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { headers }, (response) => {
      let body = '';

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve({
            statusCode: response.statusCode,
            body: body ? JSON.parse(body) : null,
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);
    request.setTimeout(10000, () => {
      request.destroy(new Error(`Request timed out: ${url}`));
    });
  });
}

function powershell(command) {
  return execFileSync('powershell.exe', ['-NoProfile', '-Command', command], {
    cwd: rootDir,
    encoding: 'utf8',
  });
}

function getPidOnPort(port) {
  if (process.platform !== 'win32') {
    return null;
  }

  try {
    const output = powershell(
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`,
    );
    const pid = output
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .find((value) => Number.isInteger(value) && value > 0);

    return pid ?? null;
  } catch {
    return null;
  }
}

module.exports = {
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
};
