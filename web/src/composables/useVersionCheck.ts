import { onBeforeUnmount, onMounted, ref } from 'vue';

const POLL_INTERVAL = 5 * 60 * 1000;

/**
 * 轮询 /version.json 检测新部署：
 * - 首次加载记录当前版本
 * - 之后在页面可见、窗口聚焦、以及每 5 分钟检查一次
 * - 版本变化则自动刷新，避免用户看到旧界面
 */
export function useVersionCheck() {
  const current = ref<string | null>(null);
  const updated = ref(false);
  let timer: number | undefined;
  let reloading = false;

  async function fetchVersion(): Promise<string | null> {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const data = (await res.json()) as { v?: string };
      return data.v ?? null;
    } catch {
      return null;
    }
  }

  async function check(): Promise<void> {
    if (document.visibilityState !== 'visible') return;
    const next = await fetchVersion();
    if (!next) return;
    if (!current.value) {
      current.value = next;
      return;
    }
    if (next !== current.value && !reloading) {
      reloading = true;
      updated.value = true;
      window.location.reload();
    }
  }

  function onVisible(): void {
    if (document.visibilityState === 'visible') void check();
  }

  onMounted(() => {
    void check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    timer = window.setInterval(() => void check(), POLL_INTERVAL);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
    window.clearInterval(timer);
  });

  return { current, updated, check };
}
