import { describe, expect, it } from 'vitest';
import { derivePepper, hashPassword, PBKDF2_ITERATIONS, verifyPassword } from './crypto';

describe('password hashing', () => {
  it('哈希格式包含算法、迭代次数、盐与摘要', async () => {
    const pepper = await derivePepper('test-secret');
    const stored = await hashPassword('correct horse battery staple', pepper);
    const parts = stored.split('$');
    expect(parts[0]).toBe('pbkdf2');
    expect(Number(parts[1])).toBe(PBKDF2_ITERATIONS);
    expect(parts[2]?.length).toBeGreaterThan(0);
    expect(parts[3]?.length).toBeGreaterThan(0);
  });

  it('相同密码两次哈希结果不同（随机盐）', async () => {
    const pepper = await derivePepper('test-secret');
    const a = await hashPassword('same-password', pepper);
    const b = await hashPassword('same-password', pepper);
    expect(a).not.toBe(b);
  });

  it('正确密码通过，错误密码不通过', async () => {
    const pepper = await derivePepper('test-secret');
    const stored = await hashPassword('correct horse', pepper);
    await expect(verifyPassword('correct horse', stored, pepper)).resolves.toBe(true);
    await expect(verifyPassword('correct horsE', stored, pepper)).resolves.toBe(false);
  });

  it('pepper 不同则校验失败', async () => {
    const pepper = await derivePepper('secret-a');
    const stored = await hashPassword('pw-123456', pepper);
    await expect(verifyPassword('pw-123456', stored, await derivePepper('secret-b'))).resolves.toBe(false);
  });

  it('非法存储格式返回 false', async () => {
    const pepper = await derivePepper('test-secret');
    await expect(verifyPassword('x', 'not-a-hash', pepper)).resolves.toBe(false);
  });
});
