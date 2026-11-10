#!/usr/bin/env node
/**
 * 重置管理员密码并清空所有会话：
 *   node scripts/reset-password.mjs --local
 *   node scripts/reset-password.mjs
 *   node scripts/reset-password.mjs --password xxx
 */
import {
  derivePepper,
  ensureSecretKey,
  executeSql,
  generatePassword,
  hashPassword,
  isLocal,
  nowIso,
  option,
  printBanner,
} from './shared.mjs';

const secret = ensureSecretKey();
if (secret.created) {
  console.log(`· 已生成 SECRET_KEY（来源：${secret.source}）`);
  console.log('  ⚠️  新密钥与远端不一致时需重新推送：npx wrangler secret put SECRET_KEY');
}

let password = option('password');
let passwordGenerated = false;
if (!password) {
  password = generatePassword();
  passwordGenerated = true;
}

const hash = hashPassword(password, derivePepper(secret.key)).replace(/'/g, "''");

executeSql(
  `UPDATE admin SET password_hash = '${hash}', must_change_password = 1, updated_at = '${nowIso()}' WHERE id = 1;`,
);
executeSql('DELETE FROM sessions;');

printBanner([
  '新密码（仅显示一次，请立即保存）',
  '',
  `  ${password}${passwordGenerated ? '' : '  (自定义)'}`,
  '',
  `范围：${isLocal() ? '本地 D1' : '远端 D1'} · 所有会话已失效`,
]);

console.log('\n首次登录后需再次修改密码。\n');
