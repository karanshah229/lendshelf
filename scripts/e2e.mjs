#!/usr/bin/env node
/**
 * Runs the Maestro UI flows in maestro/ against a connected Android phone (dev project).
 *
 *   npm run e2e                                  all flows in maestro/flows
 *   npm run e2e -- maestro/flows/reading.yaml    one flow
 *   npm run e2e -- --device 32231JEGR12038       pick a phone when more than one is attached
 *
 * Sign-in codes for the dev test numbers come from CODE_1 … CODE_5 in the environment, or else
 * from the git-ignored firebase-config/TEST-NUMBERS.md. They are handed to Maestro as -e values
 * and never printed by this script.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';

/** CODE_n for +91 90000 0000n, from the environment first, then TEST-NUMBERS.md. */
function readCodes() {
  const codes = {};
  const file = join(root, 'firebase-config', 'TEST-NUMBERS.md');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\|\s*\+91\s*90000\s*0000(\d)\s*\|\s*(\d{6})\s*\|/);
      if (m) codes[`CODE_${m[1]}`] = m[2];
    }
  }
  for (const n of [1, 2, 3, 4, 5]) {
    const key = `CODE_${n}`;
    if (process.env[key]) codes[key] = process.env[key];
  }
  return codes;
}

/** The Maestro launcher: MAESTRO_BIN, then ~/.maestro/bin, then whatever is on PATH. */
function maestroBin() {
  if (process.env.MAESTRO_BIN) return process.env.MAESTRO_BIN;
  const local = join(homedir(), '.maestro', 'bin', isWindows ? 'maestro.bat' : 'maestro');
  return existsSync(local) ? local : 'maestro';
}

const args = process.argv.slice(2);
const deviceAt = args.indexOf('--device');
const device = deviceAt >= 0 ? args.splice(deviceAt, 2)[1] : process.env.ANDROID_SERIAL;
const targets = args.length ? args : [join('maestro', 'flows')];

const codes = readCodes();
const missing = [1, 2, 3, 4, 5].filter((n) => !codes[`CODE_${n}`]);
if (missing.length) {
  console.error(
    `Missing sign-in codes for test numbers ${missing.join(', ')}. Set CODE_1 … CODE_5 or ` +
      'run `npm run firebase:config` and add firebase-config/TEST-NUMBERS.md (see maestro/README.md).'
  );
  process.exit(1);
}

const maestroArgs = [
  ...(device ? ['--device', device] : []),
  'test',
  ...Object.entries(codes).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
  ...targets,
];

const bin = maestroBin();
// Through the Windows shell a path with spaces must be quoted.
const command = isWindows && /\s/.test(bin) ? `"${bin}"` : bin;

const result = spawnSync(command, maestroArgs, {
  cwd: root,
  stdio: 'inherit',
  // A .bat launcher can only be started through the shell on Windows.
  shell: isWindows,
  env: {
    ...process.env,
    MAESTRO_CLI_NO_ANALYTICS: '1',
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
  },
});
if (result.error) {
  console.error(`Could not start Maestro (${result.error.message}). See maestro/README.md.`);
  process.exit(1);
}
process.exit(result.status ?? 1);
