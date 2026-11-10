#!/usr/bin/env node
/**
 * 首次部署初始化：
 *   node scripts/init.mjs --local            # 本地 D1
 *   node scripts/init.mjs                    # 远端 D1（并尝试写入 SECRET_KEY）
 *   node scripts/init.mjs --password xxx     # 指定初始密码
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
  pushSecret,
} from './shared.mjs';

const secret = ensureSecretKey();
if (secret.created) {
  console.log(`· 已生成 SECRET_KEY（来源：${secret.source}）`);
} else {
  console.log(`· 使用已有 SECRET_KEY（来源：${secret.source}）`);
}

let password = option('password');
let passwordGenerated = false;
if (!password) {
  password = generatePassword();
  passwordGenerated = true;
}

const pepper = derivePepper(secret.key);
const hash = hashPassword(password, pepper);
const escapedHash = hash.replace(/'/g, "''");

executeSql(
  `INSERT INTO admin (id, password_hash, must_change_password, updated_at)
   VALUES (1, '${escapedHash}', 1, '${nowIso()}')
   ON CONFLICT(id) DO UPDATE SET
     password_hash = excluded.password_hash,
     must_change_password = 1,
     updated_at = excluded.updated_at;`,
);

let secretPushed = isLocal();
if (!isLocal()) {
  console.log('· 正在写入 SECRET_KEY 到 Cloudflare ...');
  secretPushed = pushSecret(secret.key);
  console.log(secretPushed ? '  ✓ 已写入' : '  ✗ 写入失败，请手动执行：npx wrangler secret put SECRET_KEY');
}

printBanner([
  '初始密码（仅显示一次，请立即保存）',
  '',
  `  ${password}${passwordGenerated ? '' : '  (自定义)'}`,
  '',
  `范围：${isLocal() ? '本地 D1' : '远端 D1'}`,
]);

if (!secretPushed) {
  console.log('\n⚠️  SECRET_KEY 未写入，登录会失败。请执行：');
  console.log('   npx wrangler secret put SECRET_KEY');
  console.log(`   值：${secret.key}\n`);
}

console.log('下一步：');
if (!isLocal()) {
  console.log('  1) 确认已执行 npx wrangler d1 migrations apply date-alert --remote');
  console.log('  2) npm run deploy');
} else {
  console.log('  1) npm run db:local（如尚未执行迁移）');
  console.log('  2) npm run dev');
}
console.log('  首次登录后必须修改密码。\n');
