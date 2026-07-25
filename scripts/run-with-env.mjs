import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import console from 'node:console';
import process from 'node:process';

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Usage: node scripts/run-with-env.mjs <command> [...args]');
  process.exit(1);
}

function readEnvironmentFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        if (separator < 1) {
          throw new Error(`Invalid environment entry in ${path}: ${line}`);
        }

        const key = line.slice(0, separator).trim();
        const value = line
          .slice(separator + 1)
          .trim()
          .replace(/^(['"])(.*)\1$/u, '$2');
        return [key, value];
      }),
  );
}

const environmentFile = existsSync('.env') ? '.env' : '.env.example';

const child = spawn(command, args, {
  stdio: 'inherit',
  env: { ...readEnvironmentFile(environmentFile), ...process.env },
});

child.on('error', (error) => {
  console.error(`Unable to start ${command}:`, error.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
