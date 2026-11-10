import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
export const DEV_VARS = path.join(PROJECT_ROOT, '.dev.vars');
export const DB_NAME = 'date-alert';
export const PBKDF2_ITERATIONS = 10_000;

export const args = process.argv.slice(2);

export function flag(name) {
  return args.includes(`--${name}`);
}

export function option(name, fallback = undefined) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

export function isLocal() {
  return flag('local');
}

/** 读取或生成 SECRET_KEY（写入 .dev.vars） */
export function ensureSecretKey() {
  if (process.env.SECRET_KEY) {
    return { key: process.env.SECRET_KEY, created: false, source: 'env' };
  }
  if (fs.existsSync(DEV_VARS)) {
    const line = fs
      .readFileSync(DEV_VARS, 'utf8')
      .split(/\r?\n/)
      .find((entry) => entry.startsWith('SECRET_KEY='));
    if (line) {
      return { key: line.slice('SECRET_KEY='.length).trim(), created: false, source: '.dev.vars' };
    }
  }
  const key = crypto.randomBytes(32).toString('base64');
  fs.writeFileSync(DEV_VARS, `SECRET_KEY=${key}\n`, { mode: 0o600 });
  return { key, created: true, source: '.dev.vars' };
}

/** 与 Worker 端一致：SHA-256(SECRET_KEY + "|password-v1") 的 hex */
export function derivePepper(secretKey) {
  return crypto.createHash('sha256').update(`${secretKey}|password-v1`).digest('hex');
}

export function hashPassword(password, pepper) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.pbkdf2Sync(`${password}|${pepper}`, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** 16 字符随机密码，保证同时含字母与数字 */
export function generatePassword(length = 16) {
  for (;;) {
    let out = '';
    for (let i = 0; i < length; i += 1) {
      out += PASSWORD_ALPHABET[crypto.randomInt(PASSWORD_ALPHABET.length)];
    }
    if (/[A-Za-z]/.test(out) && /[0-9]/.test(out)) return out;
  }
}

function runWrangler(argv, options = {}) {
  return execFileSync('npx', ['wrangler', ...argv], {
    cwd: PROJECT_ROOT,
    stdio: options.silent ? 'pipe' : 'inherit',
    encoding: 'utf8',
    ...options,
  });
}

export function executeSql(sql) {
  const scope = isLocal() ? '--local' : '--remote';
  try {
    runWrangler(['d1', 'execute', DB_NAME, scope, '--yes', '--command', sql], { silent: true });
  } catch (error) {
    console.error('\n✗ 数据库命令执行失败：');
    if (error.stdout) console.error(String(error.stdout));
    if (error.stderr) console.error(String(error.stderr));
    throw error;
  }
}

export function pushSecret(secretKey) {
  const result = spawnSync('npx', ['wrangler', 'secret', 'put', 'SECRET_KEY'], {
    cwd: PROJECT_ROOT,
    input: `${secretKey}\n`,
    encoding: 'utf8',
    timeout: 120_000,
  });
  return result.status === 0;
}

const WIDE = /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;

function displayWidth(text) {
  let width = 0;
  for (const char of text) width += WIDE.test(char) ? 2 : 1;
  return width;
}

export function printBanner(lines) {
  const width = Math.max(...lines.map(displayWidth)) + 2;
  const border = '─'.repeat(width);
  console.log(`┌${border}┐`);
  for (const line of lines) {
    const pad = width - displayWidth(line) - 1;
    console.log(`│ ${line}${' '.repeat(Math.max(0, pad))}│`);
  }
  console.log(`└${border}┘`);
}

export function nowIso() {
  return new Date().toISOString();
}
