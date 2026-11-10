import { Hono } from 'hono';
import type { Env } from './types';
import { publicRoutes } from './api/public';
import { authRoutes } from './api/auth';
import { adminRoutes } from './api/admin';
import { runCron } from './cron';

const app = new Hono<{ Bindings: Env }>();

// 接口一律不缓存，避免部署或数据变更后读到旧内容
app.use('/api/*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
});

app.route('/api/public', publicRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/admin', adminRoutes);

app.get('/api/health', (c) => c.json({ ok: true }));

app.notFound((c) =>
  c.json({ error: { code: 'NOT_FOUND', message: `${c.req.method} ${new URL(c.req.url).pathname}` } }, 404),
);

app.onError((err, c) => {
  console.error(JSON.stringify({ level: 'error', msg: err.message, stack: err.stack }));
  return c.json({ error: { code: 'INTERNAL', message: 'internal error' } }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runCron(env, new Date(event.scheduledTime)));
  },
};
